import { Router } from 'express';
import { ga4DataService } from '../services/ga4DataService';
import { db } from '../db';
import { ga4PropertyAccess, clients } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';
import { ErrorResponses, asyncErrorHandler } from '../utils/errorHandling';

// Admin middleware to check admin role
function adminRequired(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Enhanced validation middleware with comprehensive error handling
const validateClientId = asyncErrorHandler(async (req: any, res: any, next: any) => {
  const { clientId } = req.params;
  
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' });
  }

  const context = {
    operation: 'validate_client',
    clientId,
    endpoint: req.originalUrl
  };

  // Verify client exists
  const [client] = await db.select().from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return ErrorResponses.clientNotFound(res, clientId, context);
  }

  // Check if client has GA4 property access configured
  const [propertyAccess] = await db.select().from(ga4PropertyAccess)
    .where(eq(ga4PropertyAccess.clientId, clientId))
    .limit(1);

  if (!propertyAccess) {
    return ErrorResponses.ga4NotConfigured(res, clientId, context);
  }

  if (!propertyAccess.accessVerified) {
    return ErrorResponses.ga4NotVerified(res, clientId, context);
  }

  req.client = client;
  req.propertyAccess = propertyAccess;
  next();
});

const router = Router();

/**
 * Manually trigger GA4 data fetch for a client
 * POST /api/ga4-data/fetch/:clientId
 */
router.post('/fetch/:clientId', adminRequired, validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  const { startDate, endDate, period } = req.body;
  
  logger.info(`Manual GA4 data fetch triggered for client: ${clientId}`);
  
  if (!startDate || !endDate || !period) {
    return res.status(400).json({ 
      success: false, 
      message: 'startDate, endDate, and period are required' 
    });
  }
  
  const ga4Data = await ga4DataService.fetchGA4Data(clientId, startDate, endDate);
  
  if (!ga4Data) {
    return res.status(404).json({
      success: false,
      message: 'No GA4 data available for this client'
    });
  }
  
  // Store the fetched data
  await ga4DataService.storeGA4Metrics(clientId, period, ga4Data);
  
  res.json({
    success: true,
    message: `Successfully fetched and stored GA4 data for ${clientId}`,
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
}));

/**
 * Get GA4 data for a client and period (GET endpoint for dashboard)
 * GET /api/ga4-data/:clientId/:period
 */
router.get('/:clientId/:period', validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId, period } = req.params;
  
  logger.info(`GA4 data requested for client: ${clientId}, period: ${period}`);
  
  // Convert period (YYYY-MM) to date range
  const dateRange = ga4DataService.getDateRangeForPeriod(period);
  
  // Fetch fresh GA4 data
  const ga4Data = await ga4DataService.fetchGA4Data(clientId, dateRange.startDate, dateRange.endDate);
  
  if (!ga4Data) {
    return res.status(404).json({
      success: false,
      message: 'No GA4 data available for this client'
    });
  }
  
  res.json({
    success: true,
    data: ga4Data
  });
}));

/**
 * GA4 Data Refresh endpoint - Manual refresh only when requested
 * POST /api/ga4-data/refresh/:clientId
 */
router.post('/refresh/:clientId', validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  
  logger.info(`Manual GA4 data refresh triggered for client: ${clientId}`);
  
  // Get current period
  const currentDate = new Date();
  const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const dateRange = ga4DataService.getDateRangeForPeriod(period);
  
  logger.info(`Refreshing GA4 data for period: ${period} (${dateRange.startDate} to ${dateRange.endDate})`);
  
  // Clear existing client data for this period
  const { storage } = await import('../storage');
  await storage.clearClientMetricsByPeriod(clientId, period);
  
  // Fetch and store fresh GA4 data
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
  const { performanceCache } = await import('../cache/performance-cache');
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
}));

/**
 * GA4 Data Sync endpoint for comprehensive synchronization
 * POST /api/ga4-data/sync/:clientId
 */
router.post('/sync/:clientId', adminRequired, validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  const { periods } = req.body; // Optional array of periods to sync
  
  logger.info(`GA4 data sync triggered for client: ${clientId}`, { periods });
  
  // Default to current and previous month if no periods specified
  const currentDate = new Date();
  const periodsToSync = periods || [
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`, // Current month
    `${currentDate.getFullYear()}-${String(currentDate.getMonth()).padStart(2, '0')}` // Previous month
  ];
  
  const syncResults = [];
  
  for (const period of periodsToSync) {
    try {
      const dateRange = ga4DataService.getDateRangeForPeriod(period);
      const ga4Data = await ga4DataService.fetchGA4Data(clientId, dateRange.startDate, dateRange.endDate);
      
      if (ga4Data) {
        await ga4DataService.storeGA4Metrics(clientId, period, ga4Data);
        syncResults.push({
          period,
          success: true,
          data: {
            bounceRate: `${ga4Data.bounceRate.toFixed(1)}%`,
            sessionDuration: `${ga4Data.sessionDuration.toFixed(0)}s`,
            totalSessions: ga4Data.totalSessions
          }
        });
      } else {
        syncResults.push({
          period,
          success: false,
          error: 'No data available for this period'
        });
      }
    } catch (periodError) {
      logger.error(`Failed to sync period ${period}:`, periodError);
      syncResults.push({
        period,
        success: false,
        error: periodError instanceof Error ? periodError.message : 'Unknown error'
      });
    }
  }
  
  const successCount = syncResults.filter(r => r.success).length;
  
  res.json({
    success: successCount > 0,
    message: `Synchronized ${successCount}/${periodsToSync.length} periods for ${clientId}`,
    results: syncResults
  });
}));

export default router;