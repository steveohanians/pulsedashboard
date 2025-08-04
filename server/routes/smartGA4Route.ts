import { Router } from 'express';
import { SmartGA4DataFetcher } from '../services/smartGA4DataFetcher';
import { isAuthenticated } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * Smart 15-month GA4 data fetch endpoint
 * POST /api/ga4-data/smart-fetch/:clientId
 */
router.post('/smart-fetch/:clientId', isAuthenticated, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logger.info(`Starting smart 15-month GA4 data fetch for client: ${clientId}`);
    
    const smartFetcher = new SmartGA4DataFetcher();
    const result = await smartFetcher.fetch15MonthData(clientId);
    
    if (result.success) {
      logger.info(`Smart fetch completed successfully for ${clientId}`, {
        periodsProcessed: result.periodsProcessed,
        dailyDataPeriods: result.dailyDataPeriods.length,
        monthlyDataPeriods: result.monthlyDataPeriods.length,
        errors: result.errors.length
      });
      
      return res.json({
        success: true,
        message: 'Smart 15-month data fetch completed',
        data: {
          periodsProcessed: result.periodsProcessed,
          dailyDataPeriods: result.dailyDataPeriods,
          monthlyDataPeriods: result.monthlyDataPeriods,
          totalPeriods: 15,
          errors: result.errors
        }
      });
    } else {
      logger.error(`Smart fetch failed for ${clientId}`, { errors: result.errors });
      
      return res.status(500).json({
        success: false,
        message: 'Smart 15-month data fetch failed',
        errors: result.errors
      });
    }
    
  } catch (error) {
    logger.error('Error in smart GA4 fetch route:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error during smart fetch',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check data status for 15-month periods
 * GET /api/ga4-data/status/:clientId
 */
router.get('/status/:clientId', isAuthenticated, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    const smartFetcher = new SmartGA4DataFetcher();
    // Note: We need to expose these methods or create a status check method
    // For now, let's create a simple response structure
    const statusMessage = 'Data status check available after implementing public methods';
    
    // Convert Map to object for JSON response
    const statusData: Record<string, any> = {};
    existingDataStatus.forEach((value, key) => {
      statusData[key] = value;
    });
    
    return res.json({
      success: true,
      message: statusMessage,
      data: {
        clientId,
        available: true
      }
    });
    
  } catch (error) {
    logger.error('Error checking GA4 data status:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check data status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;