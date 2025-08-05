import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { generateMetricInsights, generateBulkInsights } from "./services/openai";
import { ga4DataService } from "./services/ga4DataService";
import { insertCompetitorSchema, insertMetricSchema, insertBenchmarkSchema, insertClientSchema, insertUserSchema, insertAIInsightSchema, insertBenchmarkCompanySchema, insertCdPortfolioCompanySchema, insertGlobalPromptTemplateSchema, updateGlobalPromptTemplateSchema, insertMetricPromptSchema, updateMetricPromptSchema, insertInsightContextSchema, updateInsightContextSchema } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { authLimiter, uploadLimiter, adminLimiter } from "./middleware/rateLimiter";
import logger from "./utils/logger";
import { generateDynamicPeriodMapping } from "./utils/dateUtils";
import { getFiltersOptimized, getDashboardDataOptimized, getCachedData, setCachedData, clearCache, debugCacheKeys } from "./utils/queryOptimizer";
import { parseMetricValue } from "./utils/metricParser";
import { performanceCache } from "./cache/performance-cache";

import { backgroundProcessor } from "./utils/background-processor";
import ga4Routes from "./routes/ga4Routes";
import ga4DataRoute from "./routes/ga4DataRoute";
import smartGA4Route from "./routes/smartGA4Route";
import cleanupAndFetchRoute from "./routes/cleanupAndFetchRoute";
import ga4ServiceAccountRoutes from "./routes/ga4ServiceAccountRoutes";
import googleOAuthRoutes from "./routes/googleOAuthRoutes";

import adminGA4Route from "./routes/adminGA4Route";
import ga4AdminRoutes from "./routes/ga4-admin";

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

  // Disabled per user request

  // Cache statistics endpoint for performance monitoring
  app.get("/api/cache-stats", requireAuth, (req, res) => {
    const stats = performanceCache.getStats();
    const backgroundStatus = backgroundProcessor.getStatus();
    
    res.json({
      cache: stats,
      backgroundProcessor: backgroundStatus,
      optimizations: {
        caching: true,
        parallelQueries: true,
        backgroundProcessing: true,
        frontendOptimizations: true
      }
    });
  });

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

  // Daily metrics endpoint for authentic GA4 temporal data
  app.get("/api/metrics/daily/:clientId/:period/:metricName", requireAuth, async (req, res) => {
    const { clientId, period, metricName } = req.params;
    
    try {
      const dailyMetrics = await storage.getDailyClientMetrics(clientId, period);
      const metricsForName = dailyMetrics.filter(m => m.metricName === metricName);
      
      // Sort by date for proper time series order
      metricsForName.sort((a, b) => a.timePeriod.localeCompare(b.timePeriod));
      
      res.json({
        success: true,
        data: metricsForName,
        count: metricsForName.length
      });
    } catch (error) {
      logger.error('Error fetching daily metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily metrics'
      });
    }
  });

  // Dashboard endpoint with performance caching
  app.get("/api/dashboard/:clientId", requireAuth, async (req, res) => {
    console.error('🔵 DASHBOARD ROUTE HIT - CLIENT: ' + req.params.clientId);
    try {
      console.error('🔵 INSIDE TRY BLOCK');
      const { clientId } = req.params;
      let { 
        timePeriod = "Last Month", 
        businessSize = "All", 
        industryVertical = "All" 
      } = req.query;
      
      // 🚫 PERFORMANCE CACHING COMPLETELY DISABLED FOR DEBUGGING
      console.error('🚫 ALL CACHING DISABLED - FRESH DATA PROCESSING');
      
      // Generate dynamic period mapping based on current date
      const { generateDynamicPeriodMapping } = await import("./utils/dateUtils");
      const periodMapping = generateDynamicPeriodMapping();
      
      let periodsToQuery: string[];
      if (typeof timePeriod === 'string' && periodMapping[timePeriod]) {
        periodsToQuery = periodMapping[timePeriod];
      } else if (typeof timePeriod === 'string' && timePeriod.includes(' to ')) {
        // Handle custom date range format: "4/30/2025 to 7/31/2025"
        const [startDateStr, endDateStr] = timePeriod.split(' to ');
        try {
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);
          
          // Generate monthly periods between start and end dates
          const periods: string[] = [];
          const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
          
          while (current <= end) {
            const periodStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            periods.push(periodStr);
            current.setMonth(current.getMonth() + 1);
          }
          
          periodsToQuery = periods;
        } catch (error) {
          logger.error("Invalid custom date range format", { timePeriod, error: (error as Error).message });
          periodsToQuery = periodMapping["Last Month"];
        }
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

      // Prepare filters for industry data
      const filters = {
        businessSize: businessSize as string,
        industryVertical: industryVertical as string
      };

      // GA4 INTEGRATION: Manual refresh only - no automatic fetching on dashboard load

      // Cache clearing moved to getDashboardDataOptimized function

      // 🚀 OPTIMIZATION 3: Use optimized query function with timeout protection
      const result = await getDashboardDataOptimized(
        client,
        periodsToQuery,
        businessSize as string,
        industryVertical as string,
        timePeriod as string
      );

      // 🚀 OPTIMIZATION 4: Queue AI insights generation in background (non-blocking)
      backgroundProcessor.enqueue('AI_INSIGHT', {
        clientId,
        timePeriod: periodsToQuery[0],
        metrics: result.metrics
      }, 2); // Medium priority

      // 🚫 CACHING DISABLED - NO RESULT STORAGE
      
      // Add fresh timestamp to force frontend refresh
      (result as any).timestamp = Date.now();
      (result as any).dataFreshness = 'live';
      
      return res.json(result);


    } catch (error) {
      logger.error("Dashboard error", { error: (error as Error).message, stack: (error as Error).stack, clientId: req.params.clientId });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 🚀 Async AI Insights endpoint - loads insights in background after main dashboard
  app.get("/api/insights/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { timePeriod = "Last Month" } = req.query;
      
      // Check cache first
      const cacheKey = `insights:${clientId}:${timePeriod}`;
      const cached = performanceCache.get(cacheKey);
      if (cached) {
        return res.json({ insights: cached });
      }
      
      // Load insights from database
      const insights = await storage.getAIInsights(clientId, timePeriod as string);
      
      // Cache for future requests
      performanceCache.set(cacheKey, insights, 10 * 60 * 1000); // 10 minutes
      
      res.json({ insights });
    } catch (error) {
      logger.error("Insights loading error", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to load insights" });
    }
  });

  // Filters endpoint with caching and dynamic interdependent options  
  app.get("/api/filters", requireAuth, async (req, res) => {
    try {
      const { currentBusinessSize, currentIndustryVertical } = req.query;
      
      // 🧮 OPTIMIZATION 5: Cache filters data
      const filtersCacheKey = `filters:${currentBusinessSize}:${currentIndustryVertical}`;
      const cachedFilters = performanceCache.get(filtersCacheKey);
      if (cachedFilters) {
        logger.info(`Cache HIT for filters: ${filtersCacheKey}`);
        return res.json(cachedFilters);
      }
      
      // Get benchmark companies data ONLY (not CD Portfolio companies)
      const benchmarkCompanies = await storage.getBenchmarkCompanies();
      
      // Use only benchmark companies for industry filters
      const allCompanies = benchmarkCompanies;
      
      // Define business size order from small to large (updated to match actual filter options)
      const businessSizeOrder = [
        "Small / Startup (25-100 employees)",
        "Mid-Market (100-500 employees)", 
        "Large (500-1,000 employees)",
        "Enterprise (1,000-5,000 employees)",
        "Global Enterprise (5,000+ employees)"
      ];
      
      // Filter companies based on current selections
      let filteredForVerticals = allCompanies;
      let filteredForSizes = allCompanies;
      
      if (currentBusinessSize && currentBusinessSize !== "All") {
        filteredForVerticals = allCompanies.filter(c => c.businessSize === currentBusinessSize);
      }
      
      if (currentIndustryVertical && currentIndustryVertical !== "All") {
        filteredForSizes = allCompanies.filter(c => c.industryVertical === currentIndustryVertical);
      }
      
      // Extract available options based on current filters
      const availableBusinessSizes = Array.from(new Set(filteredForSizes.map(c => c.businessSize).filter(Boolean)));
      const availableIndustryVerticals = Array.from(new Set(filteredForVerticals.map(c => c.industryVertical).filter(Boolean)));
      
      // Sort business sizes by defined order
      const sortedBusinessSizes = businessSizeOrder.filter(size => availableBusinessSizes.includes(size));
      const unknownBusinessSizes = availableBusinessSizes.filter(size => !businessSizeOrder.includes(size)).sort();
      const businessSizes = ["All", ...sortedBusinessSizes, ...unknownBusinessSizes];
      
      // Sort industry verticals alphabetically
      const industryVerticals = ["All", ...availableIndustryVerticals.sort()];
      
      const filtersResult = {
        businessSizes,
        industryVerticals,
        timePeriods: [
          "Last Month",
          "Last Quarter", 
          "Last Year",
          "Custom Date Range"
        ]
      };
      
      // 🧮 OPTIMIZATION 5B: Cache filters result
      performanceCache.set(filtersCacheKey, filtersResult, 15 * 60 * 1000); // 15 minutes
      logger.info(`Filters data cached: ${filtersCacheKey}`);
      
      res.json(filtersResult);
    } catch (error) {
      logger.error("Filters error", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Generate metric-specific insights
  app.post("/api/generate-metric-insight/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { metricName, timePeriod, metricData } = req.body;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      logger.info('Starting metric-specific insight generation', { clientId, metricName, timePeriod });

      // Get enriched data for comprehensive analysis
      const client = await storage.getClient(clientId);
      const competitors = await storage.getCompetitorsByClient(clientId);
      
      // CRITICAL: AI insights are ALWAYS based on last month data only, regardless of user's selected time period
      // Use dashboard's "Last Month" period (July 2025) for AI insights
      const periodMapping = generateDynamicPeriodMapping();
      const targetPeriod = periodMapping["Last Month"][0]; // This is July 2025 (2025-07)
      
      logger.info('🤖 AI INSIGHTS: Forcing last month data only', { 
        userSelectedPeriod: timePeriod, 
        aiAnalysisPeriod: targetPeriod,
        rationale: 'AI insights always use July 2025 data regardless of dashboard filters'
      });
      
      logger.info('Using period for insights', { 
        timePeriod, 
        targetPeriod, 
        note: 'AI insights always use last month data only' 
      });
      const clientMetrics = await storage.getMetricsByClient(clientId, targetPeriod);
      
      // Build competitor data for this metric with actual names
      const competitorData = competitors.map((comp: any) => {
        const competitorMetric = clientMetrics.find((m: any) => 
          m.competitorId === comp.id && 
          m.metricName === metricName && 
          m.timePeriod === targetPeriod
        );
        return {
          name: comp.name || comp.domain.replace('https://', '').replace('http://', ''),
          value: competitorMetric ? parseMetricValue(competitorMetric.value) : null
        };
      }).filter((c: any) => c.value !== null);
      
      logger.info('🎯 AI COMPETITOR VALUES DEBUG', { 
        metricName, 
        targetPeriod,
        competitorCount: competitorData.length,
        competitors: competitorData.map(c => ({ name: c.name, value: c.value })),
        note: 'Competitors already use DB values for targetPeriod, not frontend averaged data'
      });

      // CRITICAL: Get actual client value for targetPeriod (July 2025) from database, not from frontend averaged data
      const clientMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Client' // Client data is stored with sourceType 'Client'
      );
      
      let clientValue = clientMetricForPeriod ? parseMetricValue(clientMetricForPeriod.value) : (metricData.Client || metricData);
      
      // Special handling for Traffic Channels - format channel data for AI analysis
      let trafficChannelFormatting = null;
      if (metricName === 'Traffic Channels') {
        try {
          const getTargetPeriod = () => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
          };
          const aiTargetPeriod = getTargetPeriod();
          
          // Get channel distribution data for AI analysis
          const clientChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', aiTargetPeriod, 'Client');
          const industryChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', aiTargetPeriod, 'Industry_Avg');
          const cdChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', aiTargetPeriod, 'CD_Avg');
          
          const formatChannelData = (channels: any[]) => {
            if (!channels.length) return 'No data available';
            
            // Handle Client data format (JSON array in value field)
            if (channels.length === 1 && typeof channels[0].value === 'string' && channels[0].value.startsWith('[')) {
              try {
                const channelArray = JSON.parse(channels[0].value);
                return channelArray.map((c: any) => `${c.channel}: ${c.percentage}%`).join(', ');
              } catch (e) {
                logger.warn('Failed to parse client channel data', { error: (e as Error).message, rawValue: channels[0].value });
                return 'No data available';
              }
            }
            
            // Handle Client data format (direct array in value field)
            if (channels.length === 1 && Array.isArray(channels[0].value)) {
              return channels[0].value.map((c: any) => `${c.channel}: ${c.percentage}%`).join(', ');
            }
            
            // Handle CD_Avg data format (individual records with channel names)
            return channels.map(c => {
              const percentage = typeof c.value === 'object' && c.value && c.value.percentage ? c.value.percentage : c.value;
              return `${c.channel}: ${percentage}%`;
            }).join(', ');
          };
          
          trafficChannelFormatting = {
            client: formatChannelData(clientChannels),
            industry: formatChannelData(industryChannels),
            cdAvg: formatChannelData(cdChannels)
          };
          
          // For Traffic Channels, use the number of channels as clientValue 
          if (typeof clientValue === 'object' && clientValue !== null) {
            clientValue = Array.isArray(clientValue) ? clientValue.length : Object.keys(clientValue).length;
          } else if (clientValue === null) {
            // If no client data found for this period, use 0 as fallback
            clientValue = 0;
          }
          
          logger.info('Traffic Channels AI data prepared', {
            clientChannelsCount: clientChannels.length,
            industryChannelsCount: industryChannels.length,
            cdChannelsCount: cdChannels.length,
            formattedClient: trafficChannelFormatting.client,
            formattedCdAvg: trafficChannelFormatting.cdAvg
          });
        } catch (error) {
          logger.warn('Failed to prepare traffic channel data for AI', { error: (error as Error).message });
        }
      }
      
      logger.info('🎯 AI CLIENT VALUE DEBUG', { 
        metricName, 
        targetPeriod,
        clientValueFromDB: clientMetricForPeriod?.value,
        clientValueFromFrontend: metricData.Client,
        finalClientValue: clientValue,
        note: 'AI should use DB value for specific period, not frontend averaged value'
      });
      
      // CRITICAL: Get actual benchmark values for targetPeriod (July 2025) from database, not frontend averaged data
      const industryMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Industry_Avg'
      );
      
      const cdMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'CD_Avg'
      );
      
      const industryAverage = industryMetricForPeriod ? parseMetricValue(industryMetricForPeriod.value) : metricData.Industry_Avg;
      const cdPortfolioAverage = cdMetricForPeriod ? parseMetricValue(cdMetricForPeriod.value) : metricData.CD_Avg;
      
      logger.info('🎯 AI BENCHMARK VALUES DEBUG', { 
        metricName, 
        targetPeriod,
        industryAvgFromDB: industryMetricForPeriod?.value,
        industryAvgFromFrontend: metricData.Industry_Avg,
        cdAvgFromDB: cdMetricForPeriod?.value,
        cdAvgFromFrontend: metricData.CD_Avg,
        finalIndustryAvg: industryAverage,
        finalCdAvg: cdPortfolioAverage
      });

      const enrichedData = {
        metric: {
          name: metricName,
          clientValue: clientValue,
          timePeriod: targetPeriod // Use actual analysis period, not user's selected period
        },
        client: {
          name: client?.name,
          industry: client?.industryVertical,
          businessSize: client?.businessSize,
          websiteUrl: client?.websiteUrl
        },
        benchmarks: {
          industryAverage: industryAverage,
          cdPortfolioAverage: cdPortfolioAverage,
          competitors: competitorData.filter((c: any) => c.value !== null).map((c: any) => ({ name: c.name, value: c.value as number }))
        },
        context: trafficChannelFormatting ? 
          `Client ${client?.name} (${client?.industryVertical}, ${client?.businessSize}) Traffic Channels for ${targetPeriod}: ${trafficChannelFormatting.client}. Industry average: ${trafficChannelFormatting.industry}, CD Portfolio average: ${trafficChannelFormatting.cdAvg}. Competitors: ${competitorData.length > 0 ? competitorData.map((c: any) => `${c.name}: ${c.value}`).join(', ') : 'No competitor data available'}.` :
          `Client ${client?.name} (${client?.industryVertical}, ${client?.businessSize}) has a ${metricName} of ${clientValue} for ${targetPeriod}. Industry average: ${industryAverage}, CD Portfolio average: ${cdPortfolioAverage}. Competitors: ${competitorData.length > 0 ? competitorData.map((c: any) => `${c.name}: ${c.value}`).join(', ') : 'No competitor data available'}.`
      };

      // Import OpenAI service dynamically
      logger.info('🚀 IMPORTING OPENAI SERVICE', { metricName, clientId });
      
      const { generateMetricSpecificInsights } = await import('./services/openai.js');
      
      logger.info('🎯 ABOUT TO CALL OPENAI', { 
        metricName, 
        clientId,
        enrichedDataKeys: Object.keys(enrichedData),
        clientValue: enrichedData.metric?.clientValue,
        cdAvg: enrichedData.benchmarks?.cdPortfolioAverage
      });
      
      // Generate metric-specific insights using OpenAI with enriched data
      const insights = await generateMetricSpecificInsights(metricName, enrichedData, clientId);
      
      logger.info('✅ OPENAI CALL COMPLETED', { 
        metricName, 
        hasInsights: !!insights,
        insightKeys: insights ? Object.keys(insights) : 'none'
      });
      
      // Normalize the insights object to handle both MetricAnalysis and fallback formats
      const normalizedInsights = {
        context: (insights as any).context,
        insight: (insights as any).insight || (insights as any).insights,
        recommendation: (insights as any).recommendation || (insights as any).recommendations,
        status: (insights as any).status || 'needs_improvement' // Default status if not provided
      };

      // Debug logging for status
      logger.info('✅ OpenAI Response Status Debug', { 
        metricName, 
        hasStatus: !!normalizedInsights.status, 
        status: normalizedInsights.status,
        allFields: Object.keys(insights)
      });
      
      // Store insights in database
      const insertInsight = {
        clientId,
        timePeriod: timePeriod,
        metricName: metricName,
        contextText: normalizedInsights.context,
        insightText: normalizedInsights.insight,
        recommendationText: normalizedInsights.recommendation,
        status: normalizedInsights.status, // Include the status field from OpenAI
        createdAt: new Date()
      };

      const savedInsight = await storage.createAIInsight(insertInsight);
      logger.info('Successfully saved metric-specific insights', { clientId, metricName, insightId: savedInsight.id });

      res.json({
        message: "Metric insights generated successfully",
        insight: {
          ...savedInsight,
          status: normalizedInsights.status // Ensure status is included in response
        }
      });

    } catch (error) {
      logger.error('Error generating metric insights', { error: (error as Error).message, clientId: req.params.clientId, metricName: req.body.metricName });
      res.status(500).json({ message: "Failed to generate metric insights" });
    }
  });

  // Get insight context for a specific metric
  app.get("/api/insight-context/:clientId/:metricName", requireAuth, async (req, res) => {
    try {
      const { clientId, metricName } = req.params;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const context = await storage.getInsightContext(clientId, metricName);
      res.json(context || { userContext: "" });
    } catch (error) {
      logger.error("Error fetching insight context", { error: (error as Error).message, clientId: req.params.clientId, metricName: req.params.metricName });
      res.status(500).json({ message: "Failed to fetch insight context" });
    }
  });

  // Save or update insight context
  app.post("/api/insight-context/:clientId/:metricName", requireAuth, async (req, res) => {
    try {
      const { clientId, metricName } = req.params;
      const { userContext } = req.body;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate the user context
      if (!userContext || typeof userContext !== 'string') {
        return res.status(400).json({ message: "User context is required and must be a string" });
      }

      // Import and apply input sanitization
      const { validateContextInput } = await import("./utils/inputSanitizer");
      const sanitizationResult = validateContextInput(userContext);
      
      // Block request if input is unsafe
      if (!sanitizationResult.isValid) {
        logger.warn('Context save blocked due to unsafe input', { 
          clientId, 
          metricName, 
          error: sanitizationResult.error 
        });
        return res.status(400).json({ 
          message: "Context input blocked due to security concerns",
          error: sanitizationResult.error
        });
      }

      // Use sanitized context for storage
      const sanitizedUserContext = sanitizationResult.sanitizedContext;

      // Log any warnings
      if (sanitizationResult.error) {
        logger.info('Context input sanitized with warnings', { 
          clientId, 
          metricName, 
          warnings: sanitizationResult.error 
        });
      }

      // Check if context already exists
      const existingContext = await storage.getInsightContext(clientId, metricName);
      
      let savedContext;
      if (existingContext) {
        // Update existing context with sanitized input
        savedContext = await storage.updateInsightContext(existingContext.id, { userContext: sanitizedUserContext });
      } else {
        // Create new context with sanitized input
        const insertContext = insertInsightContextSchema.parse({
          clientId,
          metricName,
          userContext: sanitizedUserContext
        });
        savedContext = await storage.createInsightContext(insertContext);
      }

      res.json({
        message: "Context saved successfully",
        context: savedContext
      });
    } catch (error) {
      logger.error("Error saving insight context", { error: (error as Error).message, clientId: req.params.clientId, metricName: req.params.metricName });
      res.status(500).json({ message: "Failed to save insight context" });
    }
  });

  // Delete insight context for a specific metric
  app.delete("/api/insight-context/:clientId/:metricName", requireAuth, async (req, res) => {
    try {
      const { clientId, metricName } = req.params;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingContext = await storage.getInsightContext(clientId, metricName);
      if (existingContext) {
        await storage.deleteInsightContext(existingContext.id);
        logger.info("Insight context deleted successfully", { clientId, metricName });
        res.json({ message: "Context deleted successfully" });
      } else {
        res.json({ message: "No context found to delete" });
      }
    } catch (error) {
      logger.error("Error deleting insight context", { error: (error as Error).message, clientId: req.params.clientId, metricName: req.params.metricName });
      res.status(500).json({ message: "Failed to delete insight context" });
    }
  });

  // Generate metric insights with user context
  app.post("/api/generate-metric-insight-with-context/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { metricName, timePeriod, metricData, userContext } = req.body;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Import and apply input sanitization
      const { validateContextInput } = await import("./utils/inputSanitizer");
      const sanitizationResult = validateContextInput(userContext || '');
      
      // Block request if input is unsafe
      if (!sanitizationResult.isValid) {
        logger.warn('Context generation blocked due to unsafe input', { 
          clientId, 
          metricName, 
          error: sanitizationResult.error 
        });
        return res.status(400).json({ 
          message: "Context input blocked due to security concerns",
          error: sanitizationResult.error
        });
      }

      // Log any warnings but allow request to continue
      if (sanitizationResult.error) {
        logger.info('Context input sanitized with warnings', { 
          clientId, 
          metricName, 
          warnings: sanitizationResult.error 
        });
      }

      const sanitizedUserContext = sanitizationResult.sanitizedContext;
      logger.info('Starting metric-specific insight generation with context', { 
        clientId, 
        metricName, 
        timePeriod, 
        hasContext: !!sanitizedUserContext,
        contextLength: sanitizedUserContext.length
      });

      // Get enriched data for comprehensive analysis (same as regular generation)
      const client = await storage.getClient(clientId);
      const competitors = await storage.getCompetitorsByClient(clientId);
      
      const periodMapping = generateDynamicPeriodMapping();
      // CRITICAL: AI insights always use July 2025 data regardless of user's dashboard selection
      const targetPeriod = periodMapping["Last Month"][0]; // Always use "Last Month" (July 2025)
      
      logger.info('🤖 AI INSIGHTS WITH CONTEXT: Forcing last month data only', {
        userSelectedPeriod: timePeriod,
        aiAnalysisPeriod: targetPeriod,
        rationale: 'AI insights always use July 2025 data regardless of dashboard filters'
      });
      
      const clientMetrics = await storage.getMetricsByClient(clientId, targetPeriod);
      
      const competitorData = competitors.map((comp: any) => {
        const competitorMetric = clientMetrics.find((m: any) => 
          m.competitorId === comp.id && 
          m.metricName === metricName && 
          m.timePeriod === targetPeriod
        );
        return {
          name: comp.name || comp.domain.replace('https://', '').replace('http://', ''),
          value: competitorMetric ? parseMetricValue(competitorMetric.value) : null
        };
      }).filter((c: any) => c.value !== null);

      // CRITICAL: Get actual client, industry, and CD values for targetPeriod (July 2025) from database, not from frontend averaged data
      const clientMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Client' // Client data is stored with sourceType 'Client'
      );
      
      const industryMetricsForPeriod = clientMetrics.filter((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Industry_Avg'
      );
      
      const cdMetricsForPeriod = clientMetrics.filter((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'CD_Avg'
      );

      // Import metric parser utility
      const { parseMetricValue } = await import("./utils/metricParser");

      // Calculate actual July 2025 database values with proper parsing
      const clientValueFromDB = clientMetricForPeriod ? parseMetricValue(clientMetricForPeriod.value) : null;
      const industryAvgFromDB = industryMetricsForPeriod.length > 0 ? 
        industryMetricsForPeriod.reduce((sum: number, m: any) => {
          const value = parseMetricValue(m.value);
          return value !== null ? sum + value : sum;
        }, 0) / industryMetricsForPeriod.length : null;
      const cdAvgFromDB = cdMetricsForPeriod.length > 0 ? 
        cdMetricsForPeriod.reduce((sum: number, m: any) => {
          const value = parseMetricValue(m.value);
          return value !== null ? sum + value : sum;
        }, 0) / cdMetricsForPeriod.length : null;

      logger.info('🎯 AI CONTEXT VALUES DEBUG', {
        metricName,
        targetPeriod,
        clientValueFromDB,
        clientValueFromFrontend: metricData.Client || metricData,
        industryAvgFromDB,
        industryAvgFromFrontend: metricData.Industry_Avg,
        cdAvgFromDB,
        cdAvgFromFrontend: metricData.CD_Avg,
        note: 'AI context should use DB values for specific period, not frontend averaged values'
      });

      // Build enriched context with actual database values for July 2025
      const enrichedData = {
        metric: {
          name: metricName,
          clientValue: clientValueFromDB, // Use DB value instead of frontend average
          timePeriod: timePeriod
        },
        client: {
          name: client?.name,
          industry: client?.industryVertical,
          businessSize: client?.businessSize,
          websiteUrl: client?.websiteUrl
        },
        benchmarks: {
          industryAverage: industryAvgFromDB || undefined, // Convert null to undefined
          cdPortfolioAverage: cdAvgFromDB || undefined, // Convert null to undefined
          competitors: competitorData.filter((c: any) => c.value !== null).map((c: any) => ({ name: c.name, value: c.value as number }))
        },
        context: `Client ${client?.name} (${client?.industryVertical}, ${client?.businessSize}) has a ${metricName} of ${clientValueFromDB} for ${timePeriod}. Industry average: ${industryAvgFromDB}, CD Portfolio average: ${cdAvgFromDB}. Competitors: ${competitorData.length > 0 ? competitorData.map((c: any) => `${c.name}: ${c.value}`).join(', ') : 'No competitor data available'}.`,
        userContext: sanitizedUserContext // Add sanitized user context to the enriched data
      };

      // Import OpenAI service and generate insights with context
      const { generateMetricSpecificInsightsWithContext } = await import('./services/openai.js');
      
      const insights = await generateMetricSpecificInsightsWithContext(metricName, enrichedData, clientId, sanitizedUserContext);
      
      const normalizedInsights = {
        context: (insights as any).context,
        insight: (insights as any).insight || (insights as any).insights,
        recommendation: (insights as any).recommendation || (insights as any).recommendations,
        status: (insights as any).status || 'needs_improvement'
      };

      logger.info('✅ OpenAI Response with Context Status Debug', { 
        metricName, 
        hasStatus: !!normalizedInsights.status, 
        status: normalizedInsights.status,
        hasUserContext: !!sanitizedUserContext
      });
      
      // Store insights in database
      const insertInsight = {
        clientId,
        timePeriod: timePeriod,
        metricName: metricName,
        contextText: normalizedInsights.context,
        insightText: normalizedInsights.insight,
        recommendationText: normalizedInsights.recommendation,
        status: normalizedInsights.status,
        createdAt: new Date()
      };

      const savedInsight = await storage.createAIInsight(insertInsight);
      logger.info('Successfully saved metric-specific insights with context', { clientId, metricName, insightId: savedInsight.id });

      res.json({
        message: "Metric insights with context generated successfully",
        insight: {
          ...savedInsight,
          status: normalizedInsights.status,
          hasCustomContext: true
        }
      });

    } catch (error) {
      logger.error('Error generating metric insights with context', { error: (error as Error).message, clientId: req.params.clientId, metricName: req.body.metricName });
      res.status(500).json({ message: "Failed to generate metric insights with context" });
    }
  });

  // Enhanced AI Insights generation endpoint
  app.post("/api/generate-comprehensive-insights/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { period } = req.query;
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Import services dynamically to avoid circular dependencies
      const { InsightDataAggregator } = await import('./services/insightDataAggregator.js');
      const { generateComprehensiveInsights } = await import('./services/openai.js');
      
      // Aggregate data for comprehensive analysis
      const aggregator = new InsightDataAggregator(storage);
      const context = await aggregator.aggregateDataForInsights(clientId, period as string);
      
      // Generate comprehensive insights
      const { dashboardSummary, metricInsights } = await generateComprehensiveInsights({
        ...context,
        metrics: context.metrics.map(m => ({
          ...m,
          percentageChange: m.percentageChange ?? undefined
        }))
      });
      
      // Store insights in database
      const storedInsights = [];
      
      // Store dashboard summary
      const summaryInsight = await storage.createAIInsight({
        clientId,
        metricName: "Dashboard Overview",
        timePeriod: context.period,
        contextText: dashboardSummary.context,
        insightText: dashboardSummary.insight,
        recommendationText: dashboardSummary.recommendation
      });
      storedInsights.push(summaryInsight);
      
      // Store individual metric insights
      for (const insight of metricInsights) {
        const storedInsight = await storage.createAIInsight({
          clientId,
          metricName: insight.metricName,
          timePeriod: context.period,
          contextText: insight.context,
          insightText: insight.insight,
          recommendationText: insight.recommendation
        });
        storedInsights.push(storedInsight);
      }

      res.json({
        message: "Comprehensive AI insights generated successfully",
        summary: dashboardSummary,
        insights: storedInsights,
        context: {
          period: context.period,
          previousPeriod: context.previousPeriod,
          metricsAnalyzed: context.metrics.length,
          competitorsTracked: context.totalCompetitors
        }
      });
    } catch (error) {
      logger.error("Error generating comprehensive insights", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        clientId: req.params.clientId
      });
      res.status(500).json({ message: "Failed to generate comprehensive insights" });
    }
  });

  // Fetch AI insights for a client
  app.get("/api/insights", requireAuth, async (req, res) => {
    try {
      const { period } = req.query;
      const clientId = req.user?.clientId;
      
      if (!clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const insights = await storage.getAIInsightsByClient(clientId, period as string);
      res.json(insights);
    } catch (error) {
      logger.error("Error fetching AI insights", {
        error: (error as Error).message,
        clientId: req.user?.clientId
      });
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // Clear all AI insights (debug only)
  app.delete("/api/debug/clear-all-insights", requireAuth, async (req, res) => {
    try {
      await storage.clearAllAIInsights();
      await storage.clearAllInsightContexts();
      logger.info("Cleared all AI insights and contexts for debugging", { userId: req.user?.id });
      res.json({ message: "All AI insights and contexts cleared successfully" });
    } catch (error) {
      logger.error("Error clearing AI insights and contexts", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to clear AI insights and contexts" });
    }
  });

  // AI Insights generation endpoint
  app.post("/api/generate-insights/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      // CRITICAL: AI insights are ALWAYS based on last month data only, regardless of any query parameters
      // Use dashboard's "Last Month" period (July 2025) for AI insights
      const periodMapping = generateDynamicPeriodMapping();
      const lastMonthPeriod = periodMapping["Last Month"][0]; // This is July 2025 (2025-07)
      
      logger.info('🤖 AI INSIGHTS: Forcing last month data only', { 
        queryPeriod: req.query.period,
        aiAnalysisPeriod: lastMonthPeriod,
        rationale: 'AI insights always use July 2025 data regardless of dashboard filters'
      });
      
      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const metrics = await storage.getMetricsByClient(clientId, lastMonthPeriod);
      
      // Group metrics by name
      const groupedMetrics = metrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.metricName]) {
          acc[metric.metricName] = {};
        }
        acc[metric.metricName][metric.sourceType] = parseMetricValue(metric.value) || 0;
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
            timePeriod: lastMonthPeriod,
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
      logger.error("Error generating AI insights", { error: (error as Error).message, stack: (error as Error).stack });
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
      logger.info("Created competitor successfully", { 
        competitorId: competitor.id, 
        domain: competitor.domain,
        clientId: validatedData.clientId 
      });

      // Clear both cache systems to ensure new competitor appears immediately
      clearCache(); // Clear ALL query optimizer cache
      performanceCache.clear(); // Clear ALL performance cache
      
      logger.info("Cleared caches after competitor creation", { 
        competitorId: competitor.id, 
        clientId: validatedData.clientId
      });
      
      res.status(201).json(competitor);
    } catch (error) {
      logger.error("Error creating competitor", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.delete("/api/competitors/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      logger.info("Attempting to delete competitor", { competitorId: id, user: req.user?.id });
      
      // Get competitor info before deletion for validation and cache clearing
      const competitor = await storage.getCompetitor(id);
      if (!competitor) {
        logger.warn("Competitor not found", { competitorId: id });
        return res.status(404).json({ message: "Competitor not found" });
      }
      
      // Verify user has access to this competitor's client
      if (!req.user || (req.user.clientId !== competitor.clientId && req.user.role !== "Admin")) {
        logger.warn("Access denied for competitor deletion", { 
          competitorId: id, 
          userId: req.user?.id, 
          userClientId: req.user?.clientId,
          competitorClientId: competitor.clientId 
        });
        return res.status(403).json({ message: "Access denied" });
      }
      
      const clientId = competitor.clientId;
      
      await storage.deleteCompetitor(id);
      logger.info("Deleted competitor successfully", { 
        id, 
        domain: competitor.domain, 
        clientId 
      });
      
      // Clear both cache systems after competitor deletion - force clear everything
      clearCache(); // Clear ALL query optimizer cache
      performanceCache.clear(); // Clear ALL performance cache
      
      logger.info("FORCE CLEARED ALL CACHES after competitor deletion", { 
        competitorId: id, 
        clientId,
        message: "Completely cleared both cache systems to ensure UI updates",
        beforeClear: "All caches emptied"
      });
      
      res.sendStatus(204);
    } catch (error) {
      logger.error("Error deleting competitor", { 
        error: (error as Error).message, 
        stack: (error as Error).stack, 
        competitorId: req.params.id,
        user: req.user?.id 
      });
      res.status(500).json({ message: "Internal server error", error: (error as Error).message });
    }
  });

  // Generate bounce rate sample data - Redirected to centralized system
  app.post("/api/generate-bounce-rate-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating bounce rate data", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to generate bounce rate data" });
    }
  });

  // Generate session duration sample data - Redirected to centralized system
  app.post("/api/generate-session-duration-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating session duration data", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to generate session duration data" });
    }
  });

  // Generate pages per session sample data - Redirected to centralized system
  app.post("/api/generate-pages-per-session-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating pages per session data", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to generate pages per session data" });
    }
  });

  // Generate sessions per user sample data - Redirected to centralized system
  app.post("/api/generate-sessions-per-user-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating sessions per user data", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Failed to generate sessions per user data" });
    }
  });

  // Generate comprehensive sample data
  app.post("/api/generate-comprehensive-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating comprehensive data", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to generate sample data" });
    }
  });

  // Generate dynamic benchmark data based on actual companies
  app.post("/api/generate-dynamic-data", requireAuth, async (req, res) => {
    try {
      // Legacy endpoint - redirected to new sample data package
      res.json({ 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      });
    } catch (error) {
      logger.error("Error generating dynamic data", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to generate dynamic data" });
    }
  });



  // Test benchmark data generation for current period
  app.post("/api/admin/generate-current-period-data", requireAdmin, async (req, res) => {
    try {
      // Legacy function - redirected to new sample data package
      const result = { 
        success: false, 
        message: "Legacy endpoint - use /api/sample-data/generate instead",
        redirect: "/api/sample-data/generate"
      };
      
      res.json({
        success: true,
        message: "Current period benchmark data generated successfully",
        result
      });
    } catch (error) {
      logger.error("Error generating current period data", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to generate current period data" });
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
      // Extract service account ID for GA4 setup (if provided)
      const { serviceAccountId, ...clientData } = req.body;
      const validatedData = insertClientSchema.parse(clientData);
      
      // Validate against filter_options table for data integrity
      const { FilterValidator } = await import("./utils/filterValidation");
      const validator = new FilterValidator(storage);
      const filterValidation = await validator.validateEntity({
        businessSize: validatedData.businessSize,
        industryVertical: validatedData.industryVertical
      });
      
      if (!filterValidation.isValid) {
        return res.status(400).json({ message: filterValidation.error });
      }
      
      const client = await storage.createClient(validatedData);
      
      // If both GA4 property ID and service account ID are provided, create property access
      if (validatedData.ga4PropertyId && serviceAccountId) {
        try {
          await storage.createGA4PropertyAccess({
            clientId: client.id,
            propertyId: validatedData.ga4PropertyId,
            serviceAccountId: serviceAccountId,
          });
          logger.info("Created GA4 property access for new client", { 
            clientId: client.id, 
            propertyId: validatedData.ga4PropertyId,
            serviceAccountId: serviceAccountId
          });
        } catch (ga4Error) {
          logger.warn("Failed to create GA4 property access for new client", { 
            clientId: client.id, 
            error: (ga4Error as Error).message 
          });
          // Don't fail the client creation if GA4 setup fails
        }
      }
      
      res.status(201).json(client);
    } catch (error) {
      logger.error("Client creation error", { error: (error as Error).message });
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate filter options if they are being updated
      if (req.body.businessSize || req.body.industryVertical) {
        const { FilterValidator } = await import("./utils/filterValidation");
        const validator = new FilterValidator(storage);
        
        // Get current client data to fill in missing fields for validation
        const currentClient = await storage.getClient(id);
        if (!currentClient) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        const dataToValidate = {
          businessSize: req.body.businessSize || currentClient.businessSize,
          industryVertical: req.body.industryVertical || currentClient.industryVertical
        };
        
        const filterValidation = await validator.validateEntity(dataToValidate);
        if (!filterValidation.isValid) {
          return res.status(400).json({ message: filterValidation.error });
        }
      }
      
      const client = await storage.updateClient(id, req.body);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if client exists
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Delete the client
      await storage.deleteClient(id);
      logger.info("Client deleted successfully", { clientId: id, clientName: client.name });
      
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      logger.error("Error deleting client", { error: (error as Error).message, clientId: req.params.id });
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
      
      // Validate against filter_options table for data integrity
      const { FilterValidator } = await import("./utils/filterValidation");
      const validator = new FilterValidator(storage);
      const filterValidation = await validator.validateEntity({
        businessSize: validatedData.businessSize,
        industryVertical: validatedData.industryVertical
      });
      
      if (!filterValidation.isValid) {
        return res.status(400).json({ message: filterValidation.error });
      }
      
      const newCompany = await storage.createCdPortfolioCompany(validatedData);
      
      logger.info("Created CD portfolio company", { 
        companyId: newCompany.id,
        companyName: newCompany.name, 
        admin: req.user?.id 
      });

      // SEMRUSH INTEGRATION: Automatically fetch 15 months of historical data
      try {
        logger.info("🚀 Starting SEMrush integration for new portfolio company", { 
          companyId: newCompany.id,
          companyName: newCompany.name,
          websiteUrl: newCompany.websiteUrl,
          semrushApiKeyPresent: !!process.env.SEMRUSH_API_KEY
        });

        const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration.ts');
        const integration = new PortfolioIntegration(storage);
        
        // Process SEMrush data in background (non-blocking)
        integration.processNewPortfolioCompany(newCompany).then((result) => {
          if (result.success) {
            logger.info("✅ SEMrush integration completed successfully", {
              companyId: newCompany.id,
              companyName: newCompany.name,
              periodsProcessed: result.periodsProcessed,
              metricsStored: result.metricsStored,
              trafficChannelsStored: result.trafficChannelsStored,
              deviceDistributionStored: result.deviceDistributionStored,
              averagesUpdated: result.averagesUpdated,
              totalDataPoints: (result.metricsStored || 0) + (result.trafficChannelsStored || 0) + (result.deviceDistributionStored || 0)
            });
          } else {
            logger.error("❌ SEMrush integration failed", {
              companyId: newCompany.id,
              companyName: newCompany.name,
              error: result.error,
              apiKeyPresent: !!process.env.SEMRUSH_API_KEY
            });
          }
        }).catch((error) => {
          logger.error("💥 SEMrush integration error", {
            companyId: newCompany.id,
            companyName: newCompany.name,
            error: (error as Error).message,
            stack: (error as Error).stack
          });
        });

        logger.info("🔄 SEMrush integration started in background", { 
          companyId: newCompany.id,
          estimatedCompletionTime: "30-60 seconds",
          dataToFetch: "15 months of historical data (6 metrics per month)"
        });

      } catch (error) {
        logger.error("🚨 Failed to start SEMrush integration", {
          companyId: newCompany.id,
          companyName: newCompany.name,
          error: (error as Error).message,
          apiKeyPresent: !!process.env.SEMRUSH_API_KEY
        });
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

  // Re-sync SEMrush data for existing CD Portfolio company
  app.post('/api/admin/cd-portfolio/:id/resync-semrush', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the portfolio company
      const company = await storage.getCdPortfolioCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Portfolio company not found" });
      }

      logger.info("Starting SEMrush re-sync for portfolio company", { 
        companyId: company.id,
        companyName: company.name,
        admin: req.user?.id 
      });

      // Clear existing SEMrush data for this company
      await storage.deleteMetricsByCompany(company.id, 'CD_Portfolio');
      
      // Re-run SEMrush integration with fixed device distribution API calls
      const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration.ts');
      const integration = new PortfolioIntegration(storage);
      
      const result = await integration.processNewPortfolioCompany(company);
      
      if (result.success) {
        logger.info("✅ SEMrush re-sync completed successfully", {
          companyId: company.id,
          companyName: company.name,
          periodsProcessed: result.periodsProcessed,
          metricsStored: result.metricsStored,
          trafficChannelsStored: result.trafficChannelsStored,
          deviceDistributionStored: result.deviceDistributionStored,
          averagesUpdated: result.averagesUpdated,
          admin: req.user?.id
        });

        res.json({
          message: "SEMrush re-sync completed successfully",
          result: {
            success: result.success,
            periodsProcessed: result.periodsProcessed,
            metricsStored: result.metricsStored,
            trafficChannelsStored: result.trafficChannelsStored,
            deviceDistributionStored: result.deviceDistributionStored,
            averagesUpdated: result.averagesUpdated
          }
        });
      } else {
        logger.error("❌ SEMrush re-sync failed", {
          companyId: company.id,
          companyName: company.name,
          error: result.error,
          admin: req.user?.id
        });
        res.status(500).json({ 
          message: "SEMrush re-sync failed", 
          error: result.error 
        });
      }
      
    } catch (error) {
      logger.error("Failed to re-sync SEMrush data", { 
        error: (error as Error).message,
        companyId: req.params.id,
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to re-sync SEMrush data" });
    }
  });

  // TEMPORARY: Test SEMrush integration for existing company
  app.post('/api/admin/cd-portfolio/:id/test-semrush', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const companyId = req.params.id;
      const companies = await storage.getCdPortfolioCompanies();
      const company = companies.find(c => c.id === companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      logger.info("🧪 Testing SEMrush integration manually", { 
        companyId: company.id,
        companyName: company.name,
        websiteUrl: company.websiteUrl
      });

      const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration.js');
      const integration = new PortfolioIntegration(storage);
      
      const result = await integration.processNewPortfolioCompany(company);
      
      logger.info("🧪 SEMrush test integration result", result);
      
      res.json({
        message: "SEMrush integration test completed",
        result: result
      });
    } catch (error) {
      logger.error("🧪 SEMrush test integration failed", {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      res.status(500).json({ 
        message: "SEMrush test integration failed", 
        error: (error as Error).message 
      });
    }
  });

  app.put('/api/admin/cd-portfolio/:companyId', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      const validatedData = insertCdPortfolioCompanySchema.partial().parse(req.body);
      
      // Validate filter options if they are being updated
      if (validatedData.businessSize || validatedData.industryVertical) {
        const { FilterValidator } = await import("./utils/filterValidation");
        const validator = new FilterValidator(storage);
        
        // Get current company data to fill in missing fields for validation
        const allCompanies = await storage.getCdPortfolioCompanies();
        const currentCompany = allCompanies.find(c => c.id === companyId);
        if (!currentCompany) {
          return res.status(404).json({ message: "Company not found" });
        }
        
        const dataToValidate = {
          businessSize: validatedData.businessSize || currentCompany.businessSize,
          industryVertical: validatedData.industryVertical || currentCompany.industryVertical
        };
        
        const filterValidation = await validator.validateEntity(dataToValidate);
        if (!filterValidation.isValid) {
          return res.status(400).json({ message: filterValidation.error });
        }
      }
      
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
      
      // Step 1: Delete the company
      await storage.deleteCdPortfolioCompany(companyId);
      
      // Step 2: Clear all performance caches (dashboard data depends on portfolio averages)
      performanceCache.clear();
      clearCache(); // Clear query optimizer cache
      
      // Step 3: Recalculate portfolio averages with remaining companies
      const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration');
      const portfolioIntegration = new PortfolioIntegration(storage);
      await portfolioIntegration.updatePortfolioAverages();
      
      logger.info("Deleted CD portfolio company and updated averages", { 
        companyId, 
        admin: req.user?.id 
      });
      res.json({ message: "Company deleted and portfolio averages updated successfully" });
    } catch (error) {
      logger.error("Failed to delete CD portfolio company", { 
        error: (error as Error).message, 
        companyId: req.params.companyId, 
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Admin endpoint to manually trigger portfolio averages recalculation
  app.post('/api/admin/cd-portfolio/recalculate-averages', requireAdmin, async (req, res) => {
    try {
      logger.info("Manual portfolio averages recalculation triggered", { admin: req.user?.id });
      
      const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration.ts');
      const integration = new PortfolioIntegration(storage);
      
      // Trigger portfolio averages recalculation
      await integration.updatePortfolioAverages();
      
      // Clear performance cache to ensure fresh data
      performanceCache.clear();
      clearCache(); // Clear query optimizer cache
      
      logger.info("Portfolio averages recalculation completed successfully");
      
      res.json({ 
        success: true,
        message: "Portfolio averages recalculated successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error("Error recalculating portfolio averages", { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        admin: req.user?.id 
      });
      res.status(500).json({ 
        success: false,
        message: "Failed to recalculate portfolio averages",
        error: (error as Error).message
      });
    }
  });

  // Metric Prompts management (Admin only)
  app.get("/api/admin/metric-prompts", requireAdmin, async (req, res) => {
    try {
      const prompts = await storage.getMetricPrompts();
      res.json(prompts);
    } catch (error) {
      logger.error("Error fetching metric prompts", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to fetch metric prompts" });
    }
  });

  app.post("/api/admin/metric-prompts", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertMetricPromptSchema.parse(req.body);
      const prompt = await storage.createMetricPrompt(validatedData);
      res.status(201).json(prompt);
    } catch (error) {
      logger.error("Error creating metric prompt", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to create metric prompt" });
    }
  });

  app.put("/api/admin/metric-prompts/:metricName", requireAdmin, async (req, res) => {
    try {
      const { metricName } = req.params;
      const validatedData = updateMetricPromptSchema.parse(req.body);
      const prompt = await storage.updateMetricPrompt(metricName, validatedData);
      
      if (!prompt) {
        return res.status(404).json({ message: "Metric prompt not found" });
      }
      
      res.json(prompt);
    } catch (error) {
      logger.error("Error updating metric prompt", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to update metric prompt" });
    }
  });

  app.delete("/api/admin/metric-prompts/:metricName", requireAdmin, async (req, res) => {
    try {
      const { metricName } = req.params;
      await storage.deleteMetricPrompt(metricName);
      res.json({ message: "Metric prompt deleted successfully" });
    } catch (error) {
      logger.error("Error deleting metric prompt", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to delete metric prompt" });
    }
  });

  // Global Prompt Template routes
  app.get("/api/admin/global-prompt-template", requireAdmin, async (req, res) => {
    try {
      const template = await storage.getGlobalPromptTemplate();
      if (!template) {
        return res.status(404).json({ message: "Global prompt template not found" });
      }
      res.json(template);
    } catch (error) {
      logger.error("Error fetching global prompt template", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to fetch global prompt template" });
    }
  });

  app.put("/api/admin/global-prompt-template", requireAdmin, async (req, res) => {
    try {
      const validatedData = updateGlobalPromptTemplateSchema.parse(req.body);
      const template = await storage.updateGlobalPromptTemplate(validatedData);
      
      if (!template) {
        return res.status(404).json({ message: "Global prompt template not found" });
      }
      
      res.json(template);
    } catch (error) {
      logger.error("Error updating global prompt template", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to update global prompt template" });
    }
  });

  // Filter Options management (Admin only)
  app.get("/api/admin/filter-options", requireAdmin, async (req, res) => {
    try {
      const filterOptions = await storage.getFilterOptions();
      res.json(filterOptions);
    } catch (error) {
      logger.error("Error fetching filter options", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  app.post("/api/admin/filter-options", requireAdmin, async (req, res) => {
    try {
      const { category, value, order } = req.body;
      
      if (!category || !value) {
        return res.status(400).json({ message: "Category and value are required" });
      }

      const filterOption = await storage.createFilterOption({
        category,
        value,
        order: order || 0
      });
      
      res.json({ message: "Filter option created successfully", filterOption });
    } catch (error) {
      logger.error("Error creating filter option", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to create filter option" });
    }
  });

  app.put("/api/admin/filter-options/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { value, order, active } = req.body;

      // Get the current filter option to compare values
      const currentOption = await storage.getFilterOptionById(id);
      if (!currentOption) {
        return res.status(404).json({ message: "Filter option not found" });
      }

      const updatedOption = await storage.updateFilterOption(id, {
        value,
        order,
        active
      });

      if (!updatedOption) {
        return res.status(404).json({ message: "Filter option not found" });
      }

      // If the value changed, cascade the update to all referencing entities
      if (currentOption.value !== value && currentOption.value && value) {
        logger.info("Cascading filter option value update", {
          category: currentOption.category,
          oldValue: currentOption.value,
          newValue: value,
          filterId: id
        });
        await storage.cascadeFilterOptionValueUpdate(
          currentOption.category,
          currentOption.value,
          value
        );
        logger.info("Cascade update completed");
      } else {
        logger.info("No cascade needed", {
          currentValue: currentOption.value,
          newValue: value,
          valuesEqual: currentOption.value === value
        });
      }

      res.json({ message: "Filter option updated successfully", filterOption: updatedOption });
    } catch (error) {
      logger.error("Error updating filter option", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to update filter option" });
    }
  });

  app.delete("/api/admin/filter-options/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFilterOption(id);
      res.json({ message: "Filter option deleted successfully" });
    } catch (error) {
      logger.error("Error deleting filter option", { error: (error as Error).message });
      res.status(500).json({ message: "Failed to delete filter option" });
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
      
      // Validate against filter_options table for data integrity
      const { FilterValidator } = await import("./utils/filterValidation");
      const validator = new FilterValidator(storage);
      const filterValidation = await validator.validateEntity({
        businessSize: validatedData.businessSize,
        industryVertical: validatedData.industryVertical
      });
      
      if (!filterValidation.isValid) {
        return res.status(400).json({ message: filterValidation.error });
      }
      
      const company = await storage.createBenchmarkCompany(validatedData);
      
      // Benchmark company created successfully - no additional data generation needed
      logger.info("Created benchmark company", { companyId: company.id });
      
      res.status(201).json(company);
    } catch (error) {
      logger.error("Error creating benchmark company", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.put("/api/admin/benchmark-companies/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate filter options if they are being updated
      if (req.body.businessSize || req.body.industryVertical) {
        const { FilterValidator } = await import("./utils/filterValidation");
        const validator = new FilterValidator(storage);
        
        // Get current company data to fill in missing fields for validation
        const allCompanies = await storage.getBenchmarkCompanies();
        const currentCompany = allCompanies.find(c => c.id === id);
        if (!currentCompany) {
          return res.status(404).json({ message: "Company not found" });
        }
        
        const dataToValidate = {
          businessSize: req.body.businessSize || currentCompany.businessSize,
          industryVertical: req.body.industryVertical || currentCompany.industryVertical
        };
        
        const filterValidation = await validator.validateEntity(dataToValidate);
        if (!filterValidation.isValid) {
          return res.status(400).json({ message: filterValidation.error });
        }
      }
      
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
            metricGroups[metric.metricName].client = parseMetricValue(metric.value);
            break;
          case "CD_Avg":
            metricGroups[metric.metricName].cdAvg = parseMetricValue(metric.value);
            break;
          case "Industry":
            metricGroups[metric.metricName].industry = parseMetricValue(metric.value);
            break;
          case "Competitor":
            metricGroups[metric.metricName].competitors.push(parseMetricValue(metric.value) || 0);
            break;
        }
      });

      // Generate insights for each metric
      const insights = [];
      for (const [metricName, data] of Object.entries(metricGroups)) {
        if (data.client !== null && data.cdAvg !== null && data.industry !== null) {
          try {
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
          } catch (error) {
            logger.error("Failed to generate insight for metric", { 
              metricName, 
              error: (error as Error).message 
            });
            // Continue with other metrics instead of failing the entire request
            insights.push({
              metricName,
              error: `Failed to generate insight: ${(error as Error).message}`
            });
          }
        }
      }

      res.json(insights);
    } catch (error) {
      logger.error("Error generating insights", { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GA4 Integration Routes
  app.use("/api/ga4", ga4Routes);
  app.use("/api/ga4-data", ga4DataRoute);
  app.use("/api/admin/ga4", adminGA4Route);
  app.use("/api/admin/ga4-sync", ga4AdminRoutes);

  app.use("/api", cleanupAndFetchRoute);
  
  // Simple GA4 refresh endpoint for demo client (no auth required)
  app.post("/api/refresh-ga4-data", async (req, res) => {
    try {
      const clientId = "demo-client-id";
      logger.info(`Manual GA4 data refresh triggered for ${clientId}`);
      
      // Use Last Month (July 2025) instead of current month (August)
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
      const period = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      const dateRange = ga4DataService.getDateRangeForPeriod(period);
      
      logger.info(`Refreshing GA4 data for period: ${period} (${dateRange.startDate} to ${dateRange.endDate})`);
      
      // Check for existing CLIENT data before re-fetching (following 15-month historical logic)
      const existingClientMetrics = await storage.getMetricsByClient(clientId, period);
      const clientOnlyMetrics = existingClientMetrics.filter(m => m.sourceType === 'Client');
      if (clientOnlyMetrics && clientOnlyMetrics.length > 0) {
        logger.info(`Existing GA4 client data found for ${period}, skipping re-fetch to avoid duplication`);
        return res.json({
          success: true,
          message: `GA4 data already exists for ${clientId} in ${period}`,
          data: {
            period,
            existingClientMetrics: clientOnlyMetrics.length,
            note: "Skipped re-fetch to preserve existing client data"
          }
        });
      }
      
      // Fetch and store fresh GA4 data only if no existing data
      const ga4Data = await ga4DataService.fetchGA4Data(clientId, dateRange.startDate, dateRange.endDate);
      
      if (!ga4Data) {
        return res.status(404).json({
          success: false,
          message: 'No GA4 data available for this client and period'
        });
      }
      
      // Store the refreshed data
      await ga4DataService.storeGA4Metrics(clientId, period, ga4Data);
      
      // Clear performance cache to ensure fresh data on next dashboard load
      performanceCache.clear();
      
      logger.info(`Successfully refreshed and stored GA4 data for ${clientId}`, {
        period,
        bounceRate: ga4Data.bounceRate,
        sessionDuration: ga4Data.sessionDuration,
        totalSessions: ga4Data.totalSessions
      });
      
      res.json({
        success: true,
        message: `Successfully refreshed GA4 data for ${clientId}`,
        data: {
          period,
          bounceRate: `${ga4Data.bounceRate.toFixed(1)}%`,
          sessionDuration: `${ga4Data.sessionDuration.toFixed(0)}s`,
          pagesPerSession: ga4Data.pagesPerSession.toFixed(2),
          sessionsPerUser: ga4Data.sessionsPerUser.toFixed(2),
          totalSessions: ga4Data.totalSessions,
          totalUsers: ga4Data.totalUsers,
          trafficChannelsCount: ga4Data.trafficChannels.length,
          deviceTypesCount: ga4Data.deviceDistribution.length
        }
      });
    } catch (error) {
      logger.error('GA4 refresh failed:', { error: (error as Error).message });
      res.status(500).json({ 
        success: false, 
        message: `GA4 refresh failed: ${(error as Error).message}` 
      });
    }
  });

  // Debug route to test GA4 API directly for July 2025 (no auth for testing)
  app.post("/api/debug/ga4-july", async (req, res) => {
    try {
      logger.info('DEBUG: Testing GA4 API for July 2025...');
      const result = await ga4DataService.fetchGA4Data('demo-client-id', '2025-07-01', '2025-07-31');
      
      logger.info('DEBUG: July 2025 GA4 API Response:', { 
        hasMainMetrics: !!(result as any)?.mainMetrics,
        hasTrafficChannels: !!result?.trafficChannels?.length,
        trafficChannelsCount: result?.trafficChannels?.length || 0,
        channels: result?.trafficChannels?.map((tc: any) => `${tc.channel}: ${tc.percentage}%`) || []
      });
      
      res.json({
        success: true,
        data: result,
        debug: {
          hasMainMetrics: !!(result as any)?.mainMetrics,
          hasTrafficChannels: !!result?.trafficChannels?.length,
          trafficChannelsCount: result?.trafficChannels?.length || 0,
          channels: result?.trafficChannels?.map((tc: any) => `${tc.channel}: ${tc.percentage}%`) || []
        }
      });
    } catch (error) {
      logger.error('DEBUG: July 2025 GA4 API Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // GA4 Service Account Management routes
  app.use("/api/admin", ga4ServiceAccountRoutes);
  
  // Google OAuth routes for GA4 integration
  app.use("/api/oauth/google", googleOAuthRoutes);

  // Portfolio Averaging Fix Route (Admin Only)
  app.post("/api/admin/fix-portfolio-averages", requireAdmin, async (req, res) => {
    try {
      logger.info('🔧 Admin initiated portfolio averages fix', { userId: req.user.id });
      
      const { PortfolioAverageFix } = await import('./utils/portfolioAverageFix');
      
      // Get a report first
      await PortfolioAverageFix.getAveragingReport('2025-06');
      
      // Run the fix
      await PortfolioAverageFix.fixAllCdAvgMetrics();
      
      logger.info('✅ Portfolio averages fix completed successfully');
      
      res.json({
        message: "Portfolio averages fixed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('❌ Portfolio averages fix failed', { error: (error as Error).message });
      res.status(500).json({ 
        message: "Failed to fix portfolio averages",
        error: (error as Error).message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
