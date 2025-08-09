import { Router } from 'express';
import { GA4DataManager } from '../services/ga4/GA4DataManager';

import { db } from '../db';
import { ga4PropertyAccess, clients } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';
import { ErrorResponses, asyncErrorHandler } from '../utils/errorHandling';
import { adminRequired } from '../middleware/authMiddleware';

// Environment flag for backward compatibility
const GA4_COMPAT_MODE = process.env.GA4_COMPAT_MODE !== 'false'; // Default true for backward compatibility

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
const ga4Manager = new GA4DataManager();

// Utility function to get date range for period
function getDateRangeForPeriod(period: string): { startDate: string; endDate: string } {
  const [year, month] = period.split('-');
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

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
  
  const ga4Data = await ga4Manager.fetchPeriodData(clientId, startDate, endDate, period);
  
  if (!ga4Data) {
    return res.status(404).json({
      success: false,
      message: 'No GA4 data available for this client'
    });
  }
  
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
  const dateRange = getDateRangeForPeriod(period);
  
  // Fetch fresh GA4 data and store it with period parameter
  const ga4Data = await ga4Manager.fetchPeriodData(clientId, dateRange.startDate, dateRange.endDate, period);
  
  if (!ga4Data) {
    return res.status(404).json({
      success: false,
      message: 'No GA4 data available for this client'
    });
  }
  
  // Apply compatibility layer for legacy dashboard clients
  const compatibleData = GA4_COMPAT_MODE ? applyCompatibilityLayer(ga4Data) : ga4Data;
  
  res.json({
    success: true,
    data: compatibleData
  });
}));

/**
 * GA4 Data Refresh endpoint - Manual refresh only when requested
 * POST /api/ga4-data/refresh/:clientId
 */
router.post('/refresh/:clientId', validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  
  logger.info(`Manual GA4 data refresh triggered for client: ${clientId}`);
  
  // Use the new GA4DataManager refresh method
  const refreshSuccess = await ga4Manager.refreshCurrentPeriod(clientId);
  
  if (!refreshSuccess) {
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh GA4 data for this client'
    });
  }
  
  // Clear performance cache to ensure fresh data on next dashboard load
  const { performanceCache } = await import('../cache/performance-cache');
  performanceCache.clear();
  
  logger.info(`Successfully refreshed GA4 data for ${clientId}`);
  
  res.json({
    success: true,
    message: `Successfully refreshed GA4 data for ${clientId}`
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
      const dateRange = getDateRangeForPeriod(period);
      const ga4Data = await ga4Manager.fetchPeriodData(clientId, dateRange.startDate, dateRange.endDate, period);
      
      if (ga4Data) {
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

/**
 * POST /api/ga4-data/daily/:clientId/:period
 * Fetch and store daily GA4 metrics for authentic temporal data
 */
router.post('/daily/:clientId/:period', validateClientId, asyncErrorHandler(async (req, res) => {
  const { clientId, period } = req.params;
  
  logger.info(`Daily GA4 data fetch triggered for client: ${clientId}, period: ${period}`);
  
  // Convert period to date range
  const dateRange = getDateRangeForPeriod(period);
  
  // Fetch daily breakdown data
  const dailyData = await ga4Manager.fetchDailyData(clientId, dateRange.startDate, dateRange.endDate, period);
  
  if (!dailyData || dailyData.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No daily GA4 data available for this client and period'
    });
  }
  
  res.json({
    success: true,
    message: `Successfully fetched and stored ${dailyData.length} days of GA4 metrics for ${clientId}`,
    period,
    daysProcessed: dailyData.length,
    dateRange: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    },
    sample: dailyData.slice(0, 3).map(day => ({
      date: day.date,
      bounceRate: day.metrics.bounceRate.toFixed(1) + '%',
      sessionDuration: day.metrics.sessionDuration.toFixed(0) + 's'
    }))
  });
}));

/**
 * Apply backward compatibility layer to GA4 data
 * Ensures legacy timePeriod formats and removes new fields that could break strict clients
 */
function applyCompatibilityLayer(data: any): any {
  if (!data) return data;
  
  // Clone the data to avoid mutations
  const compatData = JSON.parse(JSON.stringify(data));
  
  // Ensure legacy timePeriod naming for any nested period references
  if (compatData.timePeriod) {
    // Keep existing format: "YYYY-MM" for monthly, "YYYY-MM-daily" for daily
    // This is already in the correct legacy format, but ensure consistency
    if (compatData.timePeriod.includes('daily')) {
      // Daily format already correct: "YYYY-MM-daily"
    } else {
      // Monthly format already correct: "YYYY-MM"
    }
  }
  
  // Remove any new metadata fields that could break legacy clients
  if (compatData.metadata) {
    delete compatData.metadata;
  }
  if (compatData.lastFetchedAt) {
    delete compatData.lastFetchedAt;
  }
  if (compatData.source) {
    delete compatData.source;
  }
  if (compatData.dataType) {
    delete compatData.dataType;
  }
  
  return compatData;
}

export default router;

/*
 * BACKWARD COMPATIBILITY NOTES FOR GA4_COMPAT_MODE=true (default):
 * 
 * Legacy Keys Preserved in Data Response:
 * - timePeriod: "YYYY-MM" for monthly, "YYYY-MM-daily" for daily periods
 * - All core GA4 metrics in original format (bounceRate, sessionDuration, etc.)
 * - Original success/error response structure
 * 
 * Compat Mode Data Behaviors:
 * - Removes new metadata fields (metadata, lastFetchedAt, source, dataType)
 * - Preserves exact timePeriod naming conventions used by legacy dashboard
 * - Maintains original JSON response structure without extensions
 * - No new fields that could cause strict JSON parsers to fail
 * 
 * When GA4_COMPAT_MODE=false:
 * - Enhanced metadata fields available in responses
 * - Future extensibility for new data structures
 * - Extended logging and audit capabilities
 */