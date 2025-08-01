import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { generateMetricInsights, generateBulkInsights } from "./services/openai";
import { insertCompetitorSchema, insertMetricSchema, insertBenchmarkSchema, insertClientSchema, insertUserSchema, insertAIInsightSchema, insertBenchmarkCompanySchema, insertCdPortfolioCompanySchema } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { authLimiter, uploadLimiter, adminLimiter } from "./middleware/rateLimiter";
import logger from "./utils/logger";

// Middleware to check authentication
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware to check admin role
function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Configure multer for CSV file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    }
  });

  // Dashboard endpoint
  app.get("/api/dashboard/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      let { timePeriod = "Last Month" } = req.query;
      
      // Convert display period to database periods - return time-series data instead of averaging
      const periodMapping: Record<string, string[]> = {
        "Last Month": ["2025-06"], // Single month
        "Last Quarter": ["2025-04", "2025-05", "2025-06"], // Q2 2025
        "Last Year": ["2024-01", "2024-10", "2025-04", "2025-05", "2025-06"], // Multiple periods for year
        "Custom Date Range": ["2025-06"] // Default to current data for custom ranges
      };
      
      let periodsToQuery: string[];
      if (typeof timePeriod === 'string' && periodMapping[timePeriod]) {
        periodsToQuery = periodMapping[timePeriod];
      } else {
        // Default fallback to Last Month if unknown period
        periodsToQuery = periodMapping["Last Month"];
      }
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Fetch data for all relevant periods
      const allMetricsPromises = periodsToQuery.map(p => storage.getMetricsByClient(clientId, p));
      const allCompetitorMetricsPromises = periodsToQuery.map(p => storage.getMetricsByCompetitors(clientId, p));
      
      const [
        allMetricsArrays,
        competitors,
        allCompetitorMetricsArrays,
        insights
      ] = await Promise.all([
        Promise.all(allMetricsPromises),
        storage.getCompetitorsByClient(clientId),
        Promise.all(allCompetitorMetricsPromises),
        storage.getAIInsights(clientId, periodsToQuery[0]) // Use first period for insights
      ]);

      // For single period queries, return raw metrics to preserve channel information
      if (periodsToQuery.length === 1) {
        const allMetrics = allMetricsArrays.flat();
        const allCompetitorMetrics = allCompetitorMetricsArrays.flat();
        
        const processedMetrics = [
          ...allMetrics.map(m => ({
            metricName: m.metricName,
            value: m.value,
            sourceType: m.sourceType,
            timePeriod: m.timePeriod,
            channel: m.channel // Preserve channel information for Traffic Channels
          })),
          ...allCompetitorMetrics.map(m => ({
            metricName: m.metricName,
            value: m.value,
            sourceType: 'Competitor',
            competitorId: m.competitorId,
            timePeriod: m.timePeriod,
            channel: m.channel // Preserve channel information for Traffic Channels
          }))
        ];
        
        res.json({
          client,
          metrics: processedMetrics,
          competitors,
          insights,
          isTimeSeries: false
        });
      } else {
        // For multi-period queries, return time-series data
        const timeSeriesData: Record<string, Array<{
          metricName: string;
          value: string;
          sourceType: string;
          competitorId?: string;
          channel?: string; // Include channel for traffic channels
        }>> = {};
        
        // Process each time period separately
        periodsToQuery.forEach((timePeriod, index) => {
          const periodMetrics = allMetricsArrays[index] || [];
          const periodCompetitorMetrics = allCompetitorMetricsArrays[index] || [];
          

          
          const metrics = [
            ...periodMetrics.map(m => ({
              metricName: m.metricName,
              value: m.value,
              sourceType: m.sourceType,
              channel: m.channel, // Preserve channel information
              timePeriod
            })),
            ...periodCompetitorMetrics.map(m => ({
              metricName: m.metricName,
              value: m.value,
              sourceType: 'Competitor',
              competitorId: m.competitorId,
              channel: m.channel, // Preserve channel information
              timePeriod
            }))
          ];
          
          if (!timeSeriesData[timePeriod]) {
            timeSeriesData[timePeriod] = [];
          }
          
          timeSeriesData[timePeriod] = metrics as any;
        });
        
        // Calculate averaged performance values for "Your Performance" display
        const groupedMetrics: Record<string, Record<string, number[]>> = {};
        
        // Collect all values for each metric and source type across all periods
        Object.values(timeSeriesData).forEach((periodMetrics: any[]) => {
          periodMetrics.forEach((metric: any) => {
            if (!groupedMetrics[metric.metricName]) {
              groupedMetrics[metric.metricName] = {};
            }
            if (!groupedMetrics[metric.metricName][metric.sourceType]) {
              groupedMetrics[metric.metricName][metric.sourceType] = [];
            }
            groupedMetrics[metric.metricName][metric.sourceType].push(parseFloat(metric.value as string));
          });
        });
        
        // Calculate averages for each metric and source type
        const averagedMetrics: Record<string, Record<string, number>> = {};
        Object.entries(groupedMetrics).forEach(([metricName, sources]) => {
          averagedMetrics[metricName] = {};
          Object.entries(sources).forEach(([sourceType, values]) => {
            averagedMetrics[metricName][sourceType] = values.reduce((sum, val) => sum + val, 0) / values.length;
          });
        });
        
        res.json({
          client,
          timeSeriesData,
          competitors,
          insights,
          isTimeSeries: true,
          periods: periodsToQuery,
          metrics: averagedMetrics // Add averaged metrics for "Your Performance" display
        });
      }


    } catch (error) {
      logger.error("Dashboard error", { error: (error as Error).message, stack: (error as Error).stack, clientId: req.params.clientId });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Filters endpoint
  app.get("/api/filters", requireAuth, async (req, res) => {
    try {
      // Return available filter options
      res.json({
        businessSizes: [
          "All",
          "Medium Business (100–500 employees)",
          "Large Business (500–1,000 employees)", 
          "Enterprise (1,000–5,000 employees)",
          "Large Enterprise (5,000+ employees)"
        ],
        industryVerticals: [
          "All",
          "Technology",
          "Technology - Artificial Intelligence",
          "Technology - Cloud", 
          "Technology - Cybersecurity",
          "Technology - SaaS",
          "Technology - Services",
          "Financial Services & Insurance",
          "Healthcare",
          "Manufacturing", 
          "Semiconductor",
          "Consumer Goods",
          "Renewable Energy"
        ],
        timePeriods: [
          "Last Month",
          "Last Quarter", 
          "Last Year",
          "Custom Date Range"
        ]
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Insights generation endpoint
  app.post("/api/generate-insights/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { period = "2024-01" } = req.query;
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const metrics = await storage.getMetricsByClient(clientId, period as string);
      
      // Group metrics by name
      const groupedMetrics = metrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.metricName]) {
          acc[metric.metricName] = {};
        }
        acc[metric.metricName][metric.sourceType] = parseFloat(metric.value);
        return acc;
      }, {});

      const insights = [];
      
      // Generate insights for each metric
      for (const [metricName, metricData] of Object.entries(groupedMetrics)) {
        const data = metricData as any;
        const clientValue = data.Client || 0;
        const cdAverage = data.CD_Avg || 0;
        const industryAverage = data.Industry_Avg || 0;
        const competitorValues = [data.Competitor_Avg || 0];

        try {
          const aiInsight = await generateMetricInsights(
            metricName,
            clientValue,
            cdAverage,
            industryAverage,
            competitorValues,
            client.industryVertical,
            client.businessSize
          );

          // Store the insight in database
          const insight = await storage.createAIInsight({
            clientId,
            metricName,
            timePeriod: period as string,
            contextText: aiInsight.context,
            insightText: aiInsight.insight,
            recommendationText: aiInsight.recommendation
          });

          insights.push(insight);
        } catch (error) {
          logger.error(`Error generating insights for ${metricName}`, { error: (error as Error).message, metricName, clientId });
        }
      }

      res.json({ 
        message: "AI insights generated successfully",
        insights,
        count: insights.length
      });
    } catch (error) {
      console.error("Error generating AI insights:", error);
      res.status(500).json({ message: "Failed to generate AI insights" });
    }
  });

  // Competitors management
  app.post("/api/competitors", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCompetitorSchema.parse(req.body);
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== validatedData.clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const competitor = await storage.createCompetitor(validatedData);
      
      // Generate sample data for the new competitor across all time periods
      const timePeriods = ["2024-01", "2024-10", "2025-04", "2025-05", "2025-06"];
      const metricNames = [
        "Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User",
        "Traffic Channels", "Device Distribution"
      ];
      
      for (const period of timePeriods) {
        for (const metricName of metricNames) {
          let sampleValue: any;
          
          if (metricName === "Traffic Channels") {
            // Generate individual channel metrics with proper database structure
            const channels = ["Organic Search", "Direct", "Social Media", "Paid Search", "Email"];
            const baseValues = [40, 25, 15, 12, 8];
            
            for (let i = 0; i < channels.length; i++) {
              const variance = (competitor.id.charCodeAt(i % competitor.id.length) % 10) - 5;
              const channelValue = Math.max(5, baseValues[i] + variance);
              
              await storage.createMetric({
                clientId: validatedData.clientId,
                competitorId: competitor.id,
                metricName,
                value: channelValue.toString(),
                sourceType: "Competitor",
                timePeriod: period,
                channel: channels[i]
              });
            }
            continue; // Skip the general metric creation for Traffic Channels
          } else if (metricName === "Device Distribution") {
            // Generate individual device metrics with proper database structure
            const devices = ["Desktop", "Mobile", "Tablet"];
            const baseDeviceValues = [50, 42, 8];
            
            for (let i = 0; i < devices.length; i++) {
              const variance = (competitor.id.charCodeAt((i + 1) % competitor.id.length) % 8) - 4;
              const deviceValue = Math.max(5, baseDeviceValues[i] + variance);
              
              await storage.createMetric({
                clientId: validatedData.clientId,
                competitorId: competitor.id,
                metricName,
                value: deviceValue.toString(),
                sourceType: "Competitor",
                timePeriod: period,
                channel: devices[i]
              });
            }
            continue; // Skip the general metric creation for Device Distribution
          } else {
            // Generate realistic values for other metrics with competitor-specific variance
            const competitorId = competitor.id;
            const seed = competitorId.length + period.charCodeAt(0);
            const baseValues = {
              "Bounce Rate": Math.floor(40 + (Math.sin(seed * 1.1) * 15)) + Math.floor(Math.random() * 10),
              "Session Duration": Math.floor(150 + (Math.sin(seed * 2.2) * 90)) + Math.floor(Math.random() * 30),
              "Pages per Session": parseFloat((1.8 + (Math.sin(seed * 3.3) * 1.2) + Math.random() * 0.5).toFixed(1)),
              "Sessions per User": parseFloat((1.2 + (Math.sin(seed * 4.4) * 0.6) + Math.random() * 0.3).toFixed(1))
            };
            sampleValue = baseValues[metricName as keyof typeof baseValues];
          }
          
          await storage.createMetric({
            clientId: validatedData.clientId,
            competitorId: competitor.id,
            metricName,
            value: sampleValue.toString(),
            sourceType: "Competitor",
            timePeriod: period
          });
        }
      }
      
      res.status(201).json(competitor);
    } catch (error) {
      console.error("Error creating competitor:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/competitors/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Attempting to delete competitor with ID:', id);
      
      const deleted = await storage.deleteCompetitor(id);
      console.log('Delete result:', deleted);
      
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting competitor:', error);
      res.status(500).json({ message: "Internal server error", error: (error as Error).message });
    }
  });

  // Generate bounce rate sample data
  app.post("/api/generate-bounce-rate-data", requireAuth, async (req, res) => {
    try {
      const { generateBounceRateData } = await import("./bounceRateDataGenerator");
      const result = await generateBounceRateData();
      res.json(result);
    } catch (error) {
      console.error("Error generating bounce rate data:", error);
      res.status(500).json({ message: "Failed to generate bounce rate data" });
    }
  });

  // Generate session duration sample data
  app.post("/api/generate-session-duration-data", requireAuth, async (req, res) => {
    try {
      const { generateSessionDurationData } = await import("./sessionDurationDataGenerator");
      const result = await generateSessionDurationData();
      res.json(result);
    } catch (error) {
      console.error("Error generating session duration data:", error);
      res.status(500).json({ message: "Failed to generate session duration data" });
    }
  });

  // Generate pages per session sample data
  app.post("/api/generate-pages-per-session-data", requireAuth, async (req, res) => {
    try {
      const { generatePagesPerSessionData } = await import("./pagesPerSessionDataGenerator");
      const result = await generatePagesPerSessionData();
      res.json(result);
    } catch (error) {
      console.error("Error generating pages per session data:", error);
      res.status(500).json({ message: "Failed to generate pages per session data" });
    }
  });

  // Generate sessions per user sample data
  app.post("/api/generate-sessions-per-user-data", requireAuth, async (req, res) => {
    try {
      const { generateSessionsPerUserData } = await import("./sessionsPerUserDataGenerator");
      const result = await generateSessionsPerUserData();
      res.json(result);
    } catch (error) {
      console.error("Error generating sessions per user data:", error);
      res.status(500).json({ message: "Failed to generate sessions per user data" });
    }
  });

  // Generate comprehensive sample data
  app.post("/api/generate-comprehensive-data", requireAuth, async (req, res) => {
    try {
      const { generateComprehensiveSampleData } = await import("./sampleDataGenerator");
      const result = await generateComprehensiveSampleData();
      res.json(result);
    } catch (error) {
      logger.error("Error generating comprehensive data", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to generate sample data" });
    }
  });

  // Generate dynamic benchmark data based on actual companies
  app.post("/api/generate-dynamic-data", requireAuth, async (req, res) => {
    try {
      const { generateDynamicBenchmarkData } = await import("./sampleDataGenerator");
      const result = await generateDynamicBenchmarkData();
      res.json(result);
    } catch (error) {
      logger.error("Error generating dynamic data", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to generate dynamic data" });
    }
  });

  // Get sample data configuration status
  app.get("/api/admin/sample-data-config", requireAdmin, async (req, res) => {
    try {
      const { getSampleDataStatus, logSampleDataConfig } = await import("./sampleDataConfig");
      logSampleDataConfig(); // Log current config for admin reference
      const status = getSampleDataStatus();
      res.json(status);
    } catch (error) {
      logger.error("Error getting sample data config", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to get sample data configuration" });
    }
  });

  // Test benchmark data flow and chart compatibility
  app.post("/api/admin/test-data-flow", requireAdmin, async (req, res) => {
    try {
      const { verifyBenchmarkDataFlow, testChartDataStructure } = await import("./testDataFlow");
      
      // Verify benchmark data exists and is accessible
      const dataFlowTest = await verifyBenchmarkDataFlow();
      
      // Test chart data structure compatibility
      const chartTest = await testChartDataStructure();
      
      res.json({
        success: dataFlowTest.success && chartTest.success,
        message: "Data flow and chart compatibility test completed",
        dataFlow: dataFlowTest,
        chartCompatibility: chartTest,
        overallStatus: dataFlowTest.isReady && chartTest.success 
          ? "All benchmark data is properly connected and chart-ready" 
          : "Some issues found with data flow or chart compatibility"
      });
    } catch (error) {
      logger.error("Error testing data flow", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to test data flow" });
    }
  });

  // Generate sample data for existing competitors
  app.post("/api/generate-competitor-data/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const competitors = await storage.getCompetitorsByClient(clientId);
      
      // Check which competitors need data
      let dataGenerated = 0;
      
      for (const competitor of competitors) {
        const existingMetrics = await storage.getMetricsByCompetitors(clientId, "2025-06");
        const competitorHasData = existingMetrics.some(m => m.competitorId === competitor.id);
        
        // Always regenerate data for competitors (remove the check)
        {
          // Generate sample data for this competitor
          const timePeriods = ["2024-01", "2024-10", "2025-04", "2025-05", "2025-06"];
          const metricNames = [
            "Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User",
            "Traffic Channels", "Device Distribution"
          ];
          
          for (const period of timePeriods) {
            for (const metricName of metricNames) {
              let sampleValue: any;
              
              if (metricName === "Traffic Channels") {
                // Generate individual channel entries like client data
                const channels = [
                  { name: "Organic Search", baseValue: 35 + Math.floor(Math.random() * 20) },
                  { name: "Direct", baseValue: 20 + Math.floor(Math.random() * 15) },
                  { name: "Social Media", baseValue: 15 + Math.floor(Math.random() * 10) },
                  { name: "Paid Search", baseValue: 10 + Math.floor(Math.random() * 8) },
                  { name: "Email", baseValue: 5 + Math.floor(Math.random() * 5) }
                ];
                
                // Create separate metrics for each channel
                for (const channel of channels) {
                  await storage.createMetric({
                    competitorId: competitor.id,
                    metricName: "Traffic Channels",
                    value: channel.baseValue.toString(),
                    timePeriod: period,
                    sourceType: "Competitor",
                    channel: channel.name
                  });
                }
                continue; // Skip the regular metric creation for Traffic Channels
              } else if (metricName === "Device Distribution") {
                const desktop = Math.floor(Math.random() * 20) + 45;
                const mobile = Math.floor(Math.random() * 15) + 35;
                const tablet = Math.floor(Math.random() * 8) + 8;
                const other = 100 - (desktop + mobile + tablet);
                sampleValue = [
                  { name: "Desktop", value: desktop, percentage: desktop, color: "#3b82f6" },
                  { name: "Mobile", value: mobile, percentage: mobile, color: "#10b981" },
                  { name: "Tablet", value: tablet, percentage: tablet, color: "#8b5cf6" },
                  { name: "Other", value: other, percentage: other, color: "#6b7280" }
                ];
              } else {
                const baseValues = {
                  "Bounce Rate": Math.floor(Math.random() * 20) + 40,
                  "Session Duration": Math.floor(Math.random() * 60) + 120,
                  "Pages per Session": (Math.random() * 1.5 + 1.8).toFixed(1),
                  "Sessions per User": (Math.random() * 0.8 + 1.2).toFixed(1)
                };
                sampleValue = baseValues[metricName as keyof typeof baseValues];
              }
              
              await storage.createMetric({
                competitorId: competitor.id,
                metricName,
                value: sampleValue,
                timePeriod: period,
                sourceType: "Competitor"
              });
            }
          }
          dataGenerated++;
        }
      }
      
      res.json({ message: `Generated sample data for ${dataGenerated} competitors` });
    } catch (error) {
      console.error("Error generating competitor data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin routes
  app.get("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/clients", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const client = await storage.updateClient(id, req.body);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // CD Portfolio Company Management (separate from clients)
  app.get('/api/admin/cd-portfolio', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const portfolioCompanies = await storage.getCdPortfolioCompanies();
      logger.info("Retrieved CD portfolio companies", { 
        count: portfolioCompanies.length, 
        admin: req.user?.id 
      });
      res.json(portfolioCompanies);
    } catch (error) {
      logger.error("Failed to retrieve CD portfolio companies", { 
        error: (error as Error).message, 
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to retrieve CD portfolio companies" });
    }
  });

  app.post('/api/admin/cd-portfolio', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCdPortfolioCompanySchema.parse(req.body);
      const newCompany = await storage.createCdPortfolioCompany(validatedData);
      
      logger.info("Created CD portfolio company", { 
        companyId: newCompany.id,
        companyName: newCompany.name, 
        admin: req.user?.id 
      });

      // Auto-generate sample data for the new CD Portfolio company
      try {
        const { generateDataForNewCdPortfolioCompany } = await import("./sampleDataGenerator");
        await generateDataForNewCdPortfolioCompany(newCompany.id);
        logger.info("Auto-generated sample data for new CD portfolio company", { companyId: newCompany.id });
      } catch (sampleError) {
        logger.warn("Failed to auto-generate sample data for CD portfolio company", { 
          companyId: newCompany.id, 
          error: (sampleError as Error).message 
        });
        // Don't fail the main request if sample data generation fails
      }
      
      res.status(201).json(newCompany);
    } catch (error) {
      if ((error as any).name === 'ZodError') {
        logger.warn("Invalid CD portfolio company data", { 
          error: (error as any).errors, 
          admin: req.user?.id 
        });
        return res.status(400).json({ message: "Invalid company data", errors: (error as any).errors });
      }
      
      logger.error("Failed to create CD portfolio company", { 
        error: (error as Error).message, 
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put('/api/admin/cd-portfolio/:companyId', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      const validatedData = insertCdPortfolioCompanySchema.partial().parse(req.body);
      const updatedCompany = await storage.updateCdPortfolioCompany(companyId, validatedData);
      
      if (!updatedCompany) {
        logger.warn("CD portfolio company not found for update", { 
          companyId, 
          admin: req.user?.id 
        });
        return res.status(404).json({ message: "Company not found" });
      }
      
      logger.info("Updated CD portfolio company", { 
        companyId, 
        companyName: updatedCompany.name, 
        admin: req.user?.id 
      });
      res.json(updatedCompany);
    } catch (error) {
      if ((error as any).name === 'ZodError') {
        logger.warn("Invalid CD portfolio company update data", { 
          error: (error as any).errors, 
          admin: req.user?.id 
        });
        return res.status(400).json({ message: "Invalid company data", errors: (error as any).errors });
      }
      
      logger.error("Failed to update CD portfolio company", { 
        error: (error as Error).message, 
        companyId: req.params.companyId, 
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete('/api/admin/cd-portfolio/:companyId', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      await storage.deleteCdPortfolioCompany(companyId);
      
      logger.info("Deleted CD portfolio company", { 
        companyId, 
        admin: req.user?.id 
      });
      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete CD portfolio company", { 
        error: (error as Error).message, 
        companyId: req.params.companyId, 
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.updateUser(id, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/send-password-reset", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate a secure token
      const token = require("crypto").randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      await storage.createPasswordResetToken({
        userId: id,
        token,
        expiresAt,
      });

      // In a real application, you would send an email here
      // For now, we'll just return the reset link for testing
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      
      res.json({ 
        message: "Password reset link generated",
        resetLink // Remove this in production
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/invite", requireAdmin, async (req, res) => {
    try {
      const { name, email, role, clientId } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Create user with temporary password (they'll need to reset it)
      const tempPassword = require("crypto").randomBytes(12).toString("hex");
      const crypto = require("crypto");
      const salt = crypto.randomBytes(16);
      const hashedPassword = crypto.scryptSync(tempPassword, salt, 64).toString("hex") + ":" + salt.toString("hex");
      
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: role || "User",
        clientId: clientId === "none" ? null : clientId
      });
      
      // Generate password reset token so they can set their own password
      const token = require("crypto").randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 168); // 7 days for new user setup
      
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // In production, send email with invitation link instead of returning it
      if (process.env.NODE_ENV === 'development') {
        const inviteLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}&new=true`;
        res.json({ 
          message: "User invitation sent successfully",
          user: { ...user, password: undefined },
          inviteLink // Development only
        });
      } else {
        // TODO: Implement email sending service for production
        res.json({ 
          message: "User invitation sent successfully",
          user: { ...user, password: undefined }
        });
      }
    } catch (error) {
      logger.error("Error inviting user", { error: (error as Error).message, email: req.body.email });
      res.status(500).json({ message: "Failed to invite user" });
    }
  });

  // Password reset endpoints
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      // Generate a secure token
      const token = require("crypto").randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });

      // In production, send email with reset link instead of returning it
      if (process.env.NODE_ENV === 'development') {
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
        res.json({ 
          message: "If an account with that email exists, a reset link has been sent.",
          resetLink // Development only
        });
      } else {
        // TODO: Implement email sending service for production
        res.json({ 
          message: "If an account with that email exists, a reset link has been sent."
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash the new password using scrypt
      const crypto = require("crypto");
      const salt = crypto.randomBytes(16);
      const hashedPassword = crypto.scryptSync(newPassword, salt, 64).toString("hex") + ":" + salt.toString("hex");

      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      
      // Mark token as used
      await storage.usePasswordResetToken(token);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/benchmark-companies", requireAdmin, adminLimiter, async (req, res) => {
    try {
      const companies = await storage.getBenchmarkCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/benchmark-companies", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBenchmarkCompanySchema.parse(req.body);
      const company = await storage.createBenchmarkCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating benchmark company:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.post("/api/admin/benchmark-companies", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBenchmarkCompanySchema.parse(req.body);
      const company = await storage.createBenchmarkCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/admin/benchmark-companies/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const company = await storage.updateBenchmarkCompany(id, req.body);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/benchmark-companies/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBenchmarkCompany(id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // CSV Upload endpoint - parse CSV and return column headers for mapping
  app.post("/api/admin/benchmark-companies/csv-preview", requireAdmin, uploadLimiter, upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty or invalid" });
      }

      // Extract headers from the first record
      const headers = Object.keys(records[0] as Record<string, any>);
      
      // Return preview data (first 5 rows) and available headers
      const preview = records.slice(0, 5);
      
      res.json({
        headers,
        preview,
        totalRows: records.length,
        availableFields: [
          'name',
          'websiteUrl', 
          'industryVertical',
          'businessSize',
          'sourceVerified',
          'active'
        ]
      });
    } catch (error) {
      logger.error("Error previewing CSV", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(400).json({ message: "Failed to parse CSV file" });
    }
  });

  // CSV Import endpoint - import data with column mapping
  app.post("/api/admin/benchmark-companies/csv-import", requireAdmin, uploadLimiter, upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file || !req.body.columnMapping) {
        return res.status(400).json({ message: "CSV file and column mapping required" });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const columnMapping = JSON.parse(req.body.columnMapping);
      
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const importResults = {
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          
          // Map CSV columns to database fields
          const mappedData: any = {};
          
          Object.entries(columnMapping).forEach(([dbField, csvColumn]) => {
            if (csvColumn && (record as any)[csvColumn as string] !== undefined) {
              let value = (record as any)[csvColumn as string];
              
              // Handle boolean fields
              if (dbField === 'sourceVerified' || dbField === 'active') {
                value = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
              }
              
              mappedData[dbField] = value;
            }
          });

          // Set defaults for required fields if not mapped
          if (!mappedData.sourceVerified) mappedData.sourceVerified = false;
          if (!mappedData.active) mappedData.active = true;
          
          // Validate required fields
          if (!mappedData.name || !mappedData.websiteUrl || !mappedData.industryVertical || !mappedData.businessSize) {
            throw new Error(`Row ${i + 1}: Missing required fields (name, websiteUrl, industryVertical, businessSize)`);
          }

          // Validate the data against schema
          const validatedData = insertBenchmarkCompanySchema.parse(mappedData);
          
          // Create the benchmark company
          await storage.createBenchmarkCompany(validatedData);
          importResults.successful++;
          
        } catch (error) {
          importResults.failed++;
          importResults.errors.push(`Row ${i + 1}: ${(error as Error).message}`);
        }
      }

      res.json({
        message: `Import completed. ${importResults.successful} successful, ${importResults.failed} failed.`,
        results: importResults
      });
      
    } catch (error) {
      logger.error("Error importing CSV", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to import CSV data" });
    }
  });

  // Data ingestion endpoints
  app.post("/api/metrics", async (req, res) => {
    try {
      const validatedData = insertMetricSchema.parse(req.body);
      const metric = await storage.createMetric(validatedData);
      res.status(201).json(metric);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.post("/api/benchmarks", async (req, res) => {
    try {
      const validatedData = insertBenchmarkSchema.parse(req.body);
      const benchmark = await storage.createBenchmark(validatedData);
      res.status(201).json(benchmark);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.post("/api/insights/generate", async (req, res) => {
    try {
      const { clientId, timePeriod } = req.body;
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const metrics = await storage.getMetricsByClient(clientId, timePeriod);
      
      // Group metrics by name and calculate averages
      interface MetricGroup {
        client: number | null;
        cdAvg: number | null;
        industry: number | null;
        competitors: number[];
      }

      const metricGroups: Record<string, MetricGroup> = {};
      metrics.forEach(metric => {
        if (!metricGroups[metric.metricName]) {
          metricGroups[metric.metricName] = {
            client: null,
            cdAvg: null,
            industry: null,
            competitors: []
          };
        }
        
        switch (metric.sourceType) {
          case "Client":
            metricGroups[metric.metricName].client = parseFloat(metric.value as string);
            break;
          case "CD_Avg":
            metricGroups[metric.metricName].cdAvg = parseFloat(metric.value as string);
            break;
          case "Industry":
            metricGroups[metric.metricName].industry = parseFloat(metric.value as string);
            break;
          case "Competitor":
            metricGroups[metric.metricName].competitors.push(parseFloat(metric.value as string));
            break;
        }
      });

      // Generate insights for each metric
      const insights = [];
      for (const [metricName, data] of Object.entries(metricGroups)) {
        if (data.client !== null && data.cdAvg !== null && data.industry !== null) {
          const analysis = await generateMetricInsights(
            metricName,
            data.client,
            data.cdAvg,
            data.industry,
            data.competitors,
            client.industryVertical,
            client.businessSize
          );

          const insight = await storage.createAIInsight({
            clientId,
            metricName,
            timePeriod,
            contextText: analysis.context,
            insightText: analysis.insight,
            recommendationText: analysis.recommendation
          });
          
          insights.push(insight);
        }
      }

      res.json(insights);
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
