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
import logger from "./utils/logging/logger";
import { generateDynamicPeriodMapping } from "./utils/dateUtils";
import { getFiltersOptimized, getDashboardDataOptimized, getCachedData, setCachedData, clearCache, debugCacheKeys } from "./utils/query-optimization/queryOptimizer";
import { parseMetricValue } from "./utils/metricParser";

// Environment flag for backward compatibility
const GA4_COMPAT_MODE = process.env.GA4_COMPAT_MODE !== 'false'; // Default true for backward compatibility

/**
 * Enhanced parser for distribution metrics (Device Distribution, Traffic Channels)
 * Returns full distribution data for comprehensive AI analysis
 */
function parseDistributionMetricValue(value: any, metricName: string): any {
  // Special handling for Device Distribution - return full distribution
  if (metricName === 'Device Distribution') {
    try {
      let parsedData;
      
      // Handle double-encoded JSON string
      if (typeof value === 'string') {
        parsedData = JSON.parse(value);
      } else {
        parsedData = value;
      }
      
      // Handle array format (Client data)
      if (Array.isArray(parsedData)) {
        logger.info('🔥 ROUTE: Device Distribution array data provided for AI', {
          deviceBreakdown: parsedData,
          deviceCount: parsedData.length,
          source: 'Client array format'
        });
        return parsedData; // Return full array for comprehensive AI analysis
      }
      
      // Handle CD_Avg/Industry_Avg object format: {"source": "cd_portfolio_average", "sessions": 298312, "percentage": 27.8734598496723}
      if (parsedData && typeof parsedData === 'object' && 'percentage' in parsedData) {
        logger.info('🔥 ROUTE: Device Distribution percentage extracted for AI', {
          originalObject: parsedData,
          extractedPercentage: parsedData.percentage,
          source: 'CD_Avg/Industry_Avg object format'
        });
        return parsedData.percentage; // Return just the percentage for benchmarking
      }
    } catch (error) {
      logger.error('🔥 ROUTE: Failed to parse Device Distribution data for AI insights', {
        value: typeof value === 'string' ? value.substring(0, 100) : value,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return null;
  }

  // Special handling for Traffic Channels - return full distribution for AI context  
  if (metricName === 'Traffic Channels') {
    try {
      let parsedData;
      
      // Handle double-encoded JSON string
      if (typeof value === 'string') {
        parsedData = JSON.parse(value);
      } else {
        parsedData = value;
      }
      
      // Handle array format (Client data) - ALWAYS return full array for AI analysis
      if (Array.isArray(parsedData)) {
        logger.info('🔥 ROUTE: Traffic Channels FULL array preserved for AI', {
          channelBreakdown: parsedData,
          channelCount: parsedData.length,
          source: 'Client array format - keeping full data for AI context'
        });
        return parsedData; // Return full array for comprehensive AI analysis
      }
      
      // Handle CD_Avg/Industry_Avg object format: {"source": "cd_portfolio_average", "sessions": X, "percentage": Y}
      if (parsedData && typeof parsedData === 'object' && 'percentage' in parsedData) {
        logger.info('🔥 ROUTE: Traffic Channels percentage extracted for AI', {
          originalObject: parsedData,
          extractedPercentage: parsedData.percentage,
          source: 'CD_Avg/Industry_Avg object format'
        });
        return parsedData.percentage; // Return just the percentage for benchmarking
      }
    } catch (error) {
      logger.error('🔥 ROUTE: Failed to parse Traffic Channels data for AI insights', {
        value: typeof value === 'string' ? value.substring(0, 100) : value,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return null;
  }
  
  // Use standard parsing for other metrics
  return parseMetricValue(value);
}
import { performanceCache } from "./cache/performance-cache";
import { CompetitorIntegration } from "./services/semrush/competitorIntegration";

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
async function requireAuth(req: any, res: any, next: any) {
  // Development mode: auto-authenticate admin user if no one is logged in
  if (!req.isAuthenticated() && process.env.NODE_ENV === 'development') {
    try {
      const adminUser = await storage.getUser('admin-user-id');
      if (adminUser) {
        req.login(adminUser, (err: any) => {
          if (err) {
            logger.warn('Development auto-login failed in requireAuth', { error: err.message });
            return res.status(401).json({ message: "Authentication required" });
          }
          logger.info('Development auto-login successful in requireAuth', { userId: adminUser.id });
          return next();
        });
        return;
      }
    } catch (error) {
      logger.warn('Failed to auto-authenticate in requireAuth', { error: (error as Error).message });
    }
  }
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware to check admin role
function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}






export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Initialize competitor integration with storage
  const competitorIntegration = new CompetitorIntegration(storage);

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
      console.error(`🚨 DASHBOARD ROUTE: About to call getDashboardDataOptimized for client ${clientId}, periods:`, periodsToQuery);
      
      const result = await getDashboardDataOptimized(
        client,
        periodsToQuery,
        businessSize as string,
        industryVertical as string,
        timePeriod as string
      );
      
      console.error(`🚨 DASHBOARD RESULT: Got ${result.metrics?.length || 0} total metrics`);
      
      // Debug competitor metrics specifically
      const competitorMetrics = result.metrics?.filter(m => m.sourceType === 'Competitor') || [];
      console.error(`🚨 COMPETITOR METRICS IN RESULT: ${competitorMetrics.length} found`);
      
      if (competitorMetrics.length > 0) {
        console.error(`🚨 SAMPLE COMPETITOR METRIC:`, {
          name: competitorMetrics[0].metricName,
          value: competitorMetrics[0].value,
          valueType: typeof competitorMetrics[0].value,
          timePeriod: competitorMetrics[0].timePeriod,
          competitorId: competitorMetrics[0].competitorId
        });
      }

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
      
      // Apply compatibility layer for legacy dashboard clients before final response
      const compatibleResult = GA4_COMPAT_MODE ? applyDashboardCompatibilityLayer(result) : result;
      
      // JSON serialization safety check to prevent malformed responses
      try {
        console.error('Testing JSON serialization...');
        const testSerialized = JSON.stringify(compatibleResult);
        console.error('JSON serialization test passed');
        return res.json(compatibleResult);
      } catch (serializationError) {
        console.error('JSON serialization failed:', (serializationError as Error).message);
        logger.error("JSON serialization error in dashboard response", { 
          error: (serializationError as Error).message,
          resultKeys: Object.keys(result),
          metricsCount: result.metrics?.length || 0
        });
        
        // Create a safe fallback response
        const safeResult = {
          client: result.client,
          competitors: result.competitors || [],
          insights: result.insights || [],
          metrics: result.metrics?.map((m: any) => ({
            metricName: m.metricName,
            value: typeof m.value === 'number' ? m.value : parseFloat(m.value) || 0,
            sourceType: m.sourceType,
            timePeriod: m.timePeriod,
            channel: m.channel,
            competitorId: typeof m.competitorId === 'string' ? m.competitorId : undefined
          })) || [],
          timestamp: Date.now(),
          dataFreshness: 'live'
        };
        
        return res.json(safeResult);
      }


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
      
      // Check cache first (no timePeriod since we load all insights for client)
      const cacheKey = `insights:${clientId}`;
      const cached = performanceCache.get(cacheKey);
      if (cached) {
        return res.json({ insights: cached });
      }
      
      // Load insights from database (all insights for client, not filtered by timePeriod)
      const insights = await storage.getAIInsightsByClient(clientId);
      
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
      let targetPeriod = periodMapping["Last Month"][0]; // This is July 2025 (2025-07)
      
      // Check if competitor data exists for the target period across ALL metrics
      // If not, use the most recent period where competitor data is available
      if (competitors.length > 0) {
        // Check if any competitor has data for the target period for this specific metric
        const initialClientMetrics = await storage.getMetricsByClient(clientId, targetPeriod);
        const hasCompetitorData = initialClientMetrics.some((m: any) => 
          m.competitorId && m.metricName === metricName && m.timePeriod === targetPeriod
        );
        
        if (!hasCompetitorData) {
          // Find the most recent period with competitor data for this metric
          const availablePeriods = ['2025-06', '2025-05', '2025-04', '2025-03', '2025-02', '2025-01'];
          for (const period of availablePeriods) {
            const periodMetrics = await storage.getMetricsByClient(clientId, period);
            const hasPeriodCompetitorData = periodMetrics.some((m: any) => 
              m.competitorId && m.metricName === metricName && m.timePeriod === period
            );
            
            if (hasPeriodCompetitorData) {
              targetPeriod = period;
              logger.info('🔄 AI INSIGHTS: Adjusted period to find competitor data', {
                originalPeriod: periodMapping["Last Month"][0],
                adjustedPeriod: targetPeriod,
                metricName: metricName,
                reason: `No competitor data found for ${metricName} in ${periodMapping["Last Month"][0]}, using most recent available period`
              });
              break;
            }
          }
        }
      }
      
      logger.info('🤖 AI INSIGHTS: Final period selection', { 
        userSelectedPeriod: timePeriod, 
        aiAnalysisPeriod: targetPeriod,
        metricName: metricName,
        rationale: 'Using period with available competitor data for comprehensive analysis'
      });
      
      const clientMetrics = await storage.getMetricsByClient(clientId, targetPeriod);
      
      // Build competitor data for this metric with actual names
      const competitorData = competitors.map((comp: any) => {
        const competitorMetrics = clientMetrics.filter((m: any) => 
          m.competitorId === comp.id && 
          m.metricName === metricName && 
          m.timePeriod === targetPeriod
        );
        
        if (competitorMetrics.length === 0) {
          return { name: comp.name || comp.domain.replace('https://', '').replace('http://', ''), value: null };
        }
        
        // For Traffic Channels, build full channel breakdown for meaningful competitor comparison
        if (metricName === 'Traffic Channels') {
          const channelBreakdown = competitorMetrics.map((m: any) => ({
            channel: m.channel,
            percentage: parseDistributionMetricValue(m.value, metricName)
          })).filter(c => c.percentage !== null);
          
          return {
            name: comp.name || comp.domain.replace('https://', '').replace('http://', ''),
            value: channelBreakdown.length > 0 ? channelBreakdown : null
          };
        }
        
        // For other metrics, use standard parsing
        const competitorMetric = competitorMetrics[0];
        return {
          name: comp.name || comp.domain.replace('https://', '').replace('http://', ''),
          value: competitorMetric ? parseDistributionMetricValue(competitorMetric.value, metricName) : null
        };
      }).filter((c: any) => c.value !== null);
      
      logger.info('AI competitor values debug', { 
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
      
      // Enhanced parsing for distribution metrics (Device Distribution, Traffic Channels)  
      let clientValue = clientMetricForPeriod ? parseDistributionMetricValue(clientMetricForPeriod.value, metricName) : (metricData.Client || metricData);
      
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
          
          // No need to modify clientValue here - parseDistributionMetricValue already returns the correct format
          
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
      
      logger.info('AI client value debug', { 
        metricName, 
        targetPeriod,
        clientValueFromDB: clientMetricForPeriod?.value,
        clientValueFromFrontend: metricData.Client,
        finalClientValue: clientValue,
        note: 'AI should use DB value for specific period, not frontend averaged value'
      });
      
      // Get benchmark values for targetPeriod from database
      const industryMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Industry_Avg'
      );
      const industryAverage = industryMetricForPeriod ? parseDistributionMetricValue(industryMetricForPeriod.value, metricName) : metricData.Industry_Avg;
      
      // For Traffic Channels, get all CD_Avg channel data for comprehensive analysis
      let cdMetricForPeriod;
      let cdPortfolioAverage;
      
      if (metricName === 'Traffic Channels') {
        const cdChannelMetrics = clientMetrics.filter((m: any) => 
          m.metricName === metricName && 
          m.timePeriod === targetPeriod &&
          m.sourceType === 'CD_Avg'
        );
        
        if (cdChannelMetrics.length > 0) {
          // Build channel breakdown for CD portfolio for meaningful comparison
          const cdChannelBreakdown = cdChannelMetrics.map((m: any) => ({
            channel: m.channel,
            percentage: parseDistributionMetricValue(m.value, metricName)
          })).filter(c => c.percentage !== null);
          
          cdPortfolioAverage = cdChannelBreakdown.length > 0 ? cdChannelBreakdown : metricData.CD_Avg;
        } else {
          cdPortfolioAverage = metricData.CD_Avg;
        }
      } else {
        cdMetricForPeriod = clientMetrics.find((m: any) => 
          m.metricName === metricName && 
          m.timePeriod === targetPeriod &&
          m.sourceType === 'CD_Avg'
        );
        cdPortfolioAverage = cdMetricForPeriod ? parseDistributionMetricValue(cdMetricForPeriod.value, metricName) : metricData.CD_Avg;
      }
      
      logger.info('AI benchmark values debug', { 
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
      const { metricName, timePeriod, userContext } = req.body;

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
      
      // Get all necessary data separately since getMetricsByClient only returns client-specific data
      const clientMetrics = await storage.getMetricsByClient(clientId, targetPeriod);
      const industryMetrics = await storage.getFilteredIndustryMetrics(targetPeriod);
      const cdMetrics = await storage.getFilteredCdAvgMetrics(targetPeriod);
      
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

      // CRITICAL: Get actual client, industry, and CD values for targetPeriod from separate data sources
      const clientMetricForPeriod = clientMetrics.find((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod &&
        m.sourceType === 'Client'
      );
      
      const industryMetricsForPeriod = industryMetrics.filter((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod
      );
      
      const cdMetricsForPeriod = cdMetrics.filter((m: any) => 
        m.metricName === metricName && 
        m.timePeriod === targetPeriod
      );

      // Import metric parser utility
      const { parseMetricValue } = await import("./utils/metricParser");

      // Calculate actual database values with proper parsing
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

      logger.info('AI context values debug', {
        metricName,
        targetPeriod,
        clientValueFromDB,
        industryAvgFromDB,
        cdAvgFromDB,
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

  // Delete specific AI insight
  app.delete("/api/insights/:clientId/:metricName", requireAuth, async (req, res) => {
    try {
      const { clientId, metricName } = req.params;

      // Verify user has access to this client
      if (!req.user || (req.user.clientId !== clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete the insight from database
      await storage.deleteAIInsightByMetric(clientId, metricName);
      
      // Clear the insights cache for this client
      const cacheKey = `insights:${clientId}`;
      performanceCache.delete(cacheKey);
      
      logger.info("Deleted AI insight for specific metric", { clientId, metricName, userId: req.user.id });
      
      res.json({ message: "AI insight deleted successfully" });
    } catch (error) {
      logger.error("Error deleting AI insight", { error: (error as Error).message, clientId: req.params.clientId, metricName: req.params.metricName });
      res.status(500).json({ message: "Failed to delete AI insight" });
    }
  });

  // Clear all AI insights (debug only)
  app.delete("/api/debug/clear-all-insights", requireAuth, async (req, res) => {
    try {
      await storage.clearAllAIInsights();
      await storage.clearAllInsightContexts();
      
      // Clear all insights cache entries
      performanceCache.clear();
      
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
      // Verify user has access to this client before validation
      const tempData = insertCompetitorSchema.parse(req.body);
      if (!req.user || (req.user.clientId !== tempData.clientId && req.user.role !== "Admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use enhanced global creation utility for comprehensive workflow orchestration  
      const { createCompetitorEnhanced } = await import('./utils/company/creation');
      const result = await createCompetitorEnhanced(
        req.body,
        req.user,
        storage,
        insertCompetitorSchema
      );
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          validationErrors: result.validationErrors 
        });
      }
      
      const competitor = result.company!;

      // Clear both cache systems to ensure new competitor appears immediately
      clearCache(); // Clear ALL query optimizer cache
      performanceCache.clear(); // Clear ALL performance cache
      
      logger.info("Cleared caches after competitor creation", { 
        competitorId: competitor.id, 
        clientId: competitor.clientId
      });

      // Enhanced creation utility already handled SEMrush integration in background
      res.status(201).json(competitor);

    } catch (error) {
      logger.error("Error creating competitor", { error: (error as Error).message, stack: (error as Error).stack });
      
      // Return user-friendly error message while avoiding internal details
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to create competitor. Please try again." });
      }
    }
  });

  // Add competitor update route with Phase 3 validation
  app.put("/api/competitors/:id", requireAuth, async (req, res) => {
    try {
      const competitorId = req.params.id;
      const user = req.user!;
      const client = await storage.getClient(user.clientId!);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Verify that this competitor belongs to the user's client
      const competitors = await storage.getCompetitorsByClient(client.id);
      const competitor = competitors.find(c => c.id === competitorId);
      
      if (!competitor) {
        return res.status(404).json({ message: "Competitor not found or access denied" });
      }
      
      // Use Phase 3 validation for competitor updates
      const { Phase3RouteIntegration } = await import("./utils/phase3Integration");
      const phase3Integration = new Phase3RouteIntegration(storage);
      
      const result = await phase3Integration.handleCompetitorUpdate(
        competitorId,
        req.body,
        client.id
      );
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      // Clear caches to ensure UI updates
      clearCache();
      performanceCache.clear();
      
      logger.info("Competitor updated with Phase 3 validation", {
        competitorId,
        clientId: client.id,
        updateFields: Object.keys(req.body),
        warnings: result.warnings?.length || 0
      });
      
      res.json({
        competitor: result.competitor,
        warnings: result.warnings
      });
      
    } catch (error) {
      logger.error("Error updating competitor", {
        error: (error as Error).message,
        competitorId: req.params.id,
        userId: req.user?.id
      });
      res.status(500).json({ message: "Failed to update competitor" });
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
      // Use enhanced global creation utility for comprehensive workflow orchestration
      const { createClientEnhanced } = await import('./utils/company/creation');
      const result = await createClientEnhanced(
        req.body,
        req.user!,
        storage,
        insertClientSchema
      );
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          validationErrors: result.validationErrors 
        });
      }
      
      const client = result.company!;
      
      res.status(201).json(client);
    } catch (error) {
      logger.error("Client creation error", { error: (error as Error).message });
      
      // Return user-friendly error message while avoiding internal details
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to create client. Please try again." });
      }
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
      // Use enhanced global creation utility for comprehensive workflow orchestration
      const { createPortfolioCompanyEnhanced } = await import('./utils/company/creation');
      const result = await createPortfolioCompanyEnhanced(
        req.body,
        req.user!,
        storage,
        insertCdPortfolioCompanySchema
      );
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          validationErrors: result.validationErrors 
        });
      }
      
      const newCompany = result.company!
      
      // Enhanced creation utility already handled logging and SEMrush integration
      // All workflows executed or started in background by global utility
      
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
      const companies = await storage.getCdPortfolioCompanies();
      const company = companies.find(c => c.id === id);
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

  // Re-sync SEMrush data for existing competitor
  app.post('/api/admin/competitors/:id/resync-semrush', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the competitor
      const competitor = await storage.getCompetitor(id);
      if (!competitor) {
        return res.status(404).json({ message: "Competitor not found" });
      }

      logger.info("Starting SEMrush re-sync for competitor", { 
        competitorId: competitor.id,
        competitorLabel: competitor.label,
        domain: competitor.domain,
        admin: req.user?.id 
      });

      // Clear existing SEMrush data for this competitor
      await storage.deleteMetricsByCompany(competitor.id, 'Competitor');
      
      // Re-run SEMrush integration
      const { CompetitorIntegration } = await import('./services/semrush/competitorIntegration.js');
      const integration = new CompetitorIntegration(storage);
      
      const result = await integration.processNewCompetitor(competitor);
      
      if (result.success) {
        logger.info("✅ Competitor SEMrush re-sync completed successfully", {
          competitorId: competitor.id,
          competitorLabel: competitor.label,
          periodsProcessed: result.periodsProcessed,
          metricsStored: result.metricsStored,
          trafficChannelsStored: result.trafficChannelsStored,
          deviceDistributionStored: result.deviceDistributionStored,
          admin: req.user?.id
        });

        res.json({
          message: "Competitor SEMrush re-sync completed successfully",
          result: {
            success: result.success,
            periodsProcessed: result.periodsProcessed,
            metricsStored: result.metricsStored,
            trafficChannelsStored: result.trafficChannelsStored,
            deviceDistributionStored: result.deviceDistributionStored
          }
        });
      } else {
        logger.error("❌ Competitor SEMrush re-sync failed", {
          competitorId: competitor.id,
          competitorLabel: competitor.label,
          error: result.error,
          admin: req.user?.id
        });
        res.status(500).json({ 
          message: "Competitor SEMrush re-sync failed", 
          error: result.error 
        });
      }
      
    } catch (error) {
      logger.error("Failed to re-sync competitor SEMrush data", { 
        error: (error as Error).message,
        competitorId: req.params.id,
        admin: req.user?.id 
      });
      res.status(500).json({ message: "Failed to re-sync competitor SEMrush data" });
    }
  });

  app.put('/api/admin/cd-portfolio/:companyId', adminLimiter, requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      const validatedData = insertCdPortfolioCompanySchema.partial().parse(req.body);
      
      // Use Phase 3 comprehensive validation for portfolio company updates
      const { Phase3RouteIntegration } = await import("./utils/phase3Integration");
      const phase3Integration = new Phase3RouteIntegration(storage);
      
      const result = await phase3Integration.handlePortfolioCompanyUpdate(
        companyId,
        validatedData
      );
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      const updatedCompany = result.company;
      
      if (!updatedCompany) {
        logger.warn("CD portfolio company not found for update", { 
          companyId, 
          admin: req.user?.id 
        });
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Trigger portfolio averaging recalculation after company update
      const { PortfolioIntegration } = await import('./services/semrush/portfolioIntegration');
      const portfolioIntegration = new PortfolioIntegration(storage);
      await portfolioIntegration.updatePortfolioAverages();
      
      logger.info("Updated CD portfolio company with Phase 3 validation", { 
        companyId, 
        companyName: updatedCompany.name, 
        admin: req.user?.id,
        warnings: result.warnings?.length || 0
      });
      
      res.json({
        company: updatedCompany,
        warnings: result.warnings
      });
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

  // Get CD Portfolio Company Data for Admin Viewing
  app.get('/api/admin/cd-portfolio/:companyId/data', requireAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`[${new Date().toISOString()}] INFO: Fetching portfolio company data`, { companyId, admin: req.user?.id });
      
      // Get company info
      const companies = await storage.getCdPortfolioCompanies();
      const company = companies.find(c => c.id === companyId);
      
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Get all metrics for this company
      const metrics = await storage.getMetricsByCompanyId(companyId);

      // Group metrics by type and time period
      const groupedData = metrics.reduce((acc: any, metric: any) => {
        const metricKey = metric.metricName;
        const timePeriod = metric.timePeriod;
        
        if (!acc[metricKey]) {
          acc[metricKey] = {};
        }
        
        if (!acc[metricKey][timePeriod]) {
          acc[metricKey][timePeriod] = [];
        }
        
        acc[metricKey][timePeriod].push({
          id: metric.id,
          value: metric.value,
          channel: metric.channel,
          deviceType: metric.deviceType || metric.channel,
          sourceType: metric.sourceType,
          createdAt: metric.createdAt
        });
        
        return acc;
      }, {});

      res.json({
        company: {
          id: company.id,
          name: company.name,
          websiteUrl: company.websiteUrl,
          industryVertical: company.industryVertical,
          businessSize: company.businessSize
        },
        metrics: groupedData,
        totalMetrics: metrics.length
      });
    } catch (error) {
      console.error('Error fetching portfolio company data:', error);
      res.status(500).json({ error: 'Failed to fetch company data' });
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
      // Use enhanced global creation utility for comprehensive validation
      const { createBenchmarkCompanyEnhanced } = await import('./utils/company/creation');
      const result = await createBenchmarkCompanyEnhanced(
        req.body,
        req.user!,
        storage,
        insertBenchmarkCompanySchema
      );
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          validationErrors: result.validationErrors 
        });
      }
      
      const company = result.company!;
      
      res.status(201).json(company);
    } catch (error) {
      logger.error("Error creating benchmark company", { error: (error as Error).message, stack: (error as Error).stack });
      
      // Return user-friendly error message while avoiding internal details
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to create benchmark company. Please try again." });
      }
    }
  });

  app.put("/api/admin/benchmark-companies/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Use Phase 3 validation with diversity checks for benchmark companies
      const { Phase3RouteIntegration } = await import("./utils/phase3Integration");
      const phase3Integration = new Phase3RouteIntegration(storage);
      
      const result = await phase3Integration.handleBenchmarkCompanyUpdate(
        id,
        req.body
      );
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      logger.info("Updated benchmark company with Phase 3 validation", {
        companyId: id,
        companyName: result.company?.name,
        admin: req.user?.id,
        warnings: result.warnings?.length || 0
      });
      
      res.json({
        company: result.company,
        warnings: result.warnings
      });
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
      logger.error("Error creating metric", { error: (error as Error).message });
      
      // Return user-friendly error message while avoiding internal details
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to create metric. Please try again." });
      }
    }
  });

  app.post("/api/benchmarks", async (req, res) => {
    try {
      const validatedData = insertBenchmarkSchema.parse(req.body);
      const benchmark = await storage.createBenchmark(validatedData);
      res.status(201).json(benchmark);
    } catch (error) {
      logger.error("Error creating benchmark", { error: (error as Error).message });
      
      // Return user-friendly error message while avoiding internal details
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to create benchmark. Please try again." });
      }
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
      logger.info('🔧 Admin initiated portfolio averages fix', { userId: req.user?.id });
      
      const { PortfolioAverageFix } = await import('./utils/company/portfolio-average');
      
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

/**
 * Apply backward compatibility layer to dashboard data
 * Ensures legacy timePeriod formats and removes new fields that could break strict clients
 */
function applyDashboardCompatibilityLayer(data: any): any {
  if (!data) return data;
  
  // Clone the data to avoid mutations
  const compatData = JSON.parse(JSON.stringify(data));
  
  // Process metrics array for compatibility
  if (compatData.metrics && Array.isArray(compatData.metrics)) {
    compatData.metrics = compatData.metrics.map((metric: any) => {
      // Ensure legacy timePeriod format (already correct in current system)
      if (metric.timePeriod) {
        // Keep existing format: "YYYY-MM" for monthly, "YYYY-MM-daily" for daily
        // Current system already uses correct legacy format
      }
      
      // Ensure legacy sourceType (already correct: Client, Competitor, CD_Avg)
      // No changes needed as current system uses correct values
      
      // Remove any new metadata fields that could break legacy clients
      const cleanMetric = { ...metric };
      delete cleanMetric.metadata;
      delete cleanMetric.lastFetchedAt;
      delete cleanMetric.source;
      delete cleanMetric.dataType;
      
      return cleanMetric;
    });
  }
  
  // Remove top-level metadata fields that could break legacy parsing
  delete compatData.metadata;
  delete compatData.lastFetchedAt;
  delete compatData.source;
  delete compatData.dataType;
  
  // Keep timestamp and dataFreshness as they were added for frontend optimization
  // and are handled by existing frontend code
  
  return compatData;
}

/*
 * BACKWARD COMPATIBILITY NOTES FOR GA4_COMPAT_MODE=true (default):
 * 
 * Legacy Keys Preserved in Dashboard Response:
 * - metrics[].timePeriod: "YYYY-MM" for monthly, "YYYY-MM-daily" for daily periods  
 * - metrics[].sourceType: "Client", "Competitor", "CD_Avg" (unchanged from historical)
 * - metrics[].metricName: Core metric names unchanged
 * - metrics[].value: Numerical/string values in original format
 * - metrics[].competitorId: String IDs for competitor metrics
 * - client, competitors, insights: Original structure preserved
 * 
 * Compat Mode Dashboard Behaviors:
 * - Removes new metadata fields (metadata, lastFetchedAt, source, dataType) from metrics
 * - Preserves exact timePeriod naming conventions used by legacy dashboard
 * - Maintains original JSON response structure without extensions  
 * - No new fields that could cause strict JSON parsers to fail
 * - Keeps timestamp/dataFreshness for frontend optimization (handled by existing code)
 * 
 * When GA4_COMPAT_MODE=false:
 * - Enhanced metadata fields available in all responses
 * - Future extensibility for new data structures and tracking
 * - Extended logging and audit capabilities throughout the pipeline
 */
