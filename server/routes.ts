import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { generateMetricInsights, generateBulkInsights } from "./services/openai";
import { insertCompetitorSchema, insertMetricSchema, insertBenchmarkSchema, insertClientSchema, insertUserSchema, insertAIInsightSchema, insertBenchmarkCompanySchema } from "@shared/schema";

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

  // Dashboard endpoint
  app.get("/api/dashboard/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      let { period = "2024-01" } = req.query;
      
      // Convert display period to database periods for averaging
      const periodMapping: Record<string, string[]> = {
        "Last Month": ["2025-06"], // Single month
        "Last Quarter": ["2025-04", "2025-05", "2025-06"], // Q2 2025
        "Last Year": ["2024-01", "2024-Q4", "2025-04", "2025-05", "2025-06"], // Multiple periods for year
        "Custom Date Range": ["2025-06"] // Default to current data for custom ranges
      };
      
      let periodsToQuery: string[];
      if (typeof period === 'string' && periodMapping[period]) {
        periodsToQuery = periodMapping[period];
      } else {
        periodsToQuery = [period as string];
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

      // Flatten and calculate averages for metrics
      const allMetrics = allMetricsArrays.flat();
      const allCompetitorMetrics = allCompetitorMetricsArrays.flat();
      
      // Calculate averages by metric name and source type
      const avgMetrics: Record<string, Record<string, number[]>> = {};
      
      // Process client and benchmark metrics
      allMetrics.forEach(metric => {
        if (!avgMetrics[metric.metricName]) {
          avgMetrics[metric.metricName] = {};
        }
        if (!avgMetrics[metric.metricName][metric.sourceType]) {
          avgMetrics[metric.metricName][metric.sourceType] = [];
        }
        avgMetrics[metric.metricName][metric.sourceType].push(parseFloat(metric.value));
      });
      
      // Process competitor metrics
      allCompetitorMetrics.forEach(metric => {
        if (!avgMetrics[metric.metricName]) {
          avgMetrics[metric.metricName] = {};
        }
        const key = `Competitor_${metric.competitorId}`;
        if (!avgMetrics[metric.metricName][key]) {
          avgMetrics[metric.metricName][key] = [];
        }
        avgMetrics[metric.metricName][key].push(parseFloat(metric.value));
      });
      
      // Convert to averaged metrics
      const processedMetrics = [];
      for (const [metricName, sourceData] of Object.entries(avgMetrics)) {
        for (const [sourceType, values] of Object.entries(sourceData)) {
          const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          
          // Debug logging for Session Duration
          if (metricName === "Session Duration" && sourceType === "Client") {
            console.log(`Session Duration averaging for ${period}:`);
            console.log(`Periods queried: ${periodsToQuery.join(', ')}`);
            console.log(`Values found: ${values.join(', ')} seconds`);
            console.log(`Average: ${avgValue} seconds = ${Math.round((avgValue / 60) * 10) / 10} minutes`);
          }
          
          if (sourceType.startsWith('Competitor_')) {
            const competitorId = sourceType.replace('Competitor_', '');
            processedMetrics.push({
              metricName,
              value: avgValue.toString(),
              sourceType: 'Competitor',
              competitorId,
              timePeriod: period as string
            });
          } else {
            processedMetrics.push({
              metricName,
              value: avgValue.toString(),
              sourceType,
              timePeriod: period as string
            });
          }
        }
      }

      res.json({
        client,
        metrics: processedMetrics,
        competitors,
        insights
      });
    } catch (error) {
      console.error("Dashboard error:", error);
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
          console.error(`Error generating insights for ${metricName}:`, error);
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
      const timePeriods = ["2025-06", "2024-Q4", "2024-01"];
      const metricNames = [
        "Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User",
        "Traffic Channels", "Device Distribution"
      ];
      
      for (const period of timePeriods) {
        for (const metricName of metricNames) {
          let sampleValue: any;
          
          if (metricName === "Traffic Channels") {
            sampleValue = [
              { name: "Organic Search", value: Math.floor(Math.random() * 20) + 35, percentage: 0, color: "#10b981" },
              { name: "Direct", value: Math.floor(Math.random() * 15) + 20, percentage: 0, color: "#3b82f6" },
              { name: "Social Media", value: Math.floor(Math.random() * 10) + 15, percentage: 0, color: "#8b5cf6" },
              { name: "Paid Search", value: Math.floor(Math.random() * 8) + 10, percentage: 0, color: "#f59e0b" },
              { name: "Email", value: Math.floor(Math.random() * 5) + 5, percentage: 0, color: "#ec4899" }
            ];
            // Calculate percentages
            const total = sampleValue.reduce((sum: number, item: any) => sum + item.value, 0);
            sampleValue = sampleValue.map((item: any) => ({
              ...item,
              percentage: Math.round((item.value / total) * 100)
            }));
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
            competitorId: competitor.id,
            metricName,
            value: sampleValue,
            timePeriod: period,
            sourceType: "Competitor"
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

  // Generate comprehensive sample data
  app.post("/api/generate-comprehensive-data", requireAuth, async (req, res) => {
    try {
      const { generateComprehensiveSampleData } = await import("./sampleDataGenerator");
      const result = await generateComprehensiveSampleData();
      res.json(result);
    } catch (error) {
      console.error("Error generating comprehensive data:", error);
      res.status(500).json({ message: "Failed to generate sample data" });
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
        
        if (!competitorHasData) {
          // Generate sample data for this competitor
          const timePeriods = ["2025-06", "2024-Q4", "2024-01"];
          const metricNames = [
            "Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User",
            "Traffic Channels", "Device Distribution"
          ];
          
          for (const period of timePeriods) {
            for (const metricName of metricNames) {
              let sampleValue: any;
              
              if (metricName === "Traffic Channels") {
                sampleValue = [
                  { name: "Organic Search", value: Math.floor(Math.random() * 20) + 35, percentage: 0, color: "#10b981" },
                  { name: "Direct", value: Math.floor(Math.random() * 15) + 20, percentage: 0, color: "#3b82f6" },
                  { name: "Social Media", value: Math.floor(Math.random() * 10) + 15, percentage: 0, color: "#8b5cf6" },
                  { name: "Paid Search", value: Math.floor(Math.random() * 8) + 10, percentage: 0, color: "#f59e0b" },
                  { name: "Email", value: Math.floor(Math.random() * 5) + 5, percentage: 0, color: "#ec4899" }
                ];
                const total = sampleValue.reduce((sum: number, item: any) => sum + item.value, 0);
                sampleValue = sampleValue.map((item: any) => ({
                  ...item,
                  percentage: Math.round((item.value / total) * 100)
                }));
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
      
      // In a real application, you would send an email here with the invitation link
      const inviteLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}&new=true`;
      
      res.json({ 
        message: "User invitation sent successfully",
        user: { ...user, password: undefined }, // Don't return password
        inviteLink // Remove this in production
      });
    } catch (error) {
      console.error("Error inviting user:", error);
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

      // In a real application, you would send an email here
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      
      res.json({ 
        message: "If an account with that email exists, a reset link has been sent.",
        resetLink // Remove this in production
      });
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

  app.get("/api/admin/benchmark-companies", requireAdmin, async (req, res) => {
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
            metricGroups[metric.metricName].client = parseFloat(metric.value);
            break;
          case "CD_Avg":
            metricGroups[metric.metricName].cdAvg = parseFloat(metric.value);
            break;
          case "Industry":
            metricGroups[metric.metricName].industry = parseFloat(metric.value);
            break;
          case "Competitor":
            metricGroups[metric.metricName].competitors.push(parseFloat(metric.value));
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
