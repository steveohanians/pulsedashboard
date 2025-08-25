import { Router } from 'express';
import { GA4DataManager } from '../services/ga4';
import { requireAuth } from '../auth';
import logger from '../utils/logging/logger';

const router = Router();

/**
 * Smart 15-month GA4 data fetch endpoint
 * POST /api/ga4-data/smart-fetch/:clientId
 */
router.post('/smart-fetch/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logger.info(`Starting smart 15-month GA4 data fetch for client: ${clientId}`);
    
    const ga4Manager = new GA4DataManager();
    const result = await ga4Manager.smartFetch({ clientId });
    
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
 * Validate GA4 access for client
 * GET /api/ga4-data/validate/:clientId
 */
router.get('/validate/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    const ga4Manager = new GA4DataManager();
    const isValidAccess = await ga4Manager.validateClientAccess(clientId);
    
    const statusMessage = isValidAccess 
      ? 'GA4 access validated successfully' 
      : 'GA4 access validation failed - check property configuration';
    
    return res.json({
      success: true,
      message: statusMessage,
      data: {
        clientId,
        accessValid: isValidAccess,
        available: true
      }
    });
    
  } catch (error) {
    logger.error('Error validating GA4 access:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to validate GA4 access',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;