import { Router } from 'express';
import { GA4DataManager } from '../services/ga4/GA4DataManager';
import logger from '../utils/logger';

const router = Router();

// Test endpoint to trigger GA4 data fetch
router.post('/test-ga4-fetch/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info(`🚀 TEST: Starting GA4 data fetch for client: ${clientId}`);
    
    const ga4Manager = new GA4DataManager();
    
    // Test authentication by attempting to fetch data for a recent month
    logger.info(`✅ TEST: Starting GA4 fetch test for ${clientId}`);
    
    // Trigger smart fetch
    const result = await ga4Manager.smartFetch({ clientId });
    
    logger.info(`📈 TEST: Smart fetch completed for ${clientId}`, {
      success: result.success,
      periodsProcessed: result.periodsProcessed,
      errors: result.errors
    });
    
    res.json({
      success: result.success,
      message: `GA4 data fetch ${result.success ? 'completed' : 'failed'} for ${clientId}`,
      data: {
        periodsProcessed: result.periodsProcessed,
        dailyDataPeriods: result.dailyDataPeriods.length,
        monthlyDataPeriods: result.monthlyDataPeriods.length,
        errors: result.errors
      }
    });
    
  } catch (error) {
    logger.error('❌ TEST: Error in GA4 fetch:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;