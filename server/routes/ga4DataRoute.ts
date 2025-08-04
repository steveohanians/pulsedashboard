import { Router } from 'express';
import { ga4DataService } from '../services/ga4DataService';
import logger from '../utils/logger';

// Admin middleware to check admin role
function adminRequired(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

const router = Router();

/**
 * Manually trigger GA4 data fetch for a client
 * POST /api/ga4-data/fetch/:clientId
 */
router.post('/fetch/:clientId', adminRequired, async (req, res) => {
  try {
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

  } catch (error) {
    logger.error('Manual GA4 data fetch failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GA4 data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get GA4 data for a client and period (GET endpoint for dashboard)
 * GET /api/ga4-data/:clientId/:period
 */
router.get('/:clientId/:period', async (req, res) => {
  try {
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

  } catch (error) {
    logger.error('GA4 data fetch failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GA4 data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;