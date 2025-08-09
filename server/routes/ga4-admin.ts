/**
 * GA4 Admin Routes
 * 
 * Administrative endpoints for GA4 data management and synchronization
 */

import { Router } from 'express';
import { GA4DataManager } from '../services/ga4/GA4DataManager';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import logger from '../utils/logging/logger';

const router = Router();
const ga4Manager = new GA4DataManager();

/**
 * POST /api/admin/ga4/complete-data-sync/:clientId
 * Execute complete GA4 data synchronization for a client
 * 
 * This is the packaged method that:
 * 1. Clears all existing GA4 data
 * 2. Fetches 15 months of fresh data with correct daily/monthly logic
 * 3. Processes and stores all data
 * 4. Refreshes all 6 charts
 */
router.post('/complete-data-sync/:clientId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info(`Admin triggered complete GA4 data sync for client: ${clientId}`);
    
    // Execute the complete GA4 data synchronization
    const result = await ga4Manager.executeCompleteGA4DataSync(clientId);
    
    res.json({
      success: result.success,
      message: result.summary,
      data: {
        periodsProcessed: result.periodsProcessed,
        dailyDataPeriods: result.dailyDataPeriods,
        monthlyDataPeriods: result.monthlyDataPeriods,
        chartsRefreshed: result.chartsRefreshed,
        errors: result.errors
      }
    });
    
  } catch (error) {
    logger.error('Error in complete GA4 data sync endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute complete GA4 data sync',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/ga4/clear-client-data/:clientId
 * Clear all GA4 data for a specific client
 */
router.post('/clear-client-data/:clientId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info(`Admin clearing all GA4 data for client: ${clientId}`);
    
    await ga4Manager.clearAllClientData(clientId);
    
    res.json({
      success: true,
      message: `Successfully cleared all GA4 data for client ${clientId}`
    });
    
  } catch (error) {
    logger.error('Error clearing GA4 client data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear GA4 client data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/ga4/validate-access/:clientId
 * Validate GA4 property access for a client
 */
router.get('/validate-access/:clientId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const isValid = await ga4Manager.validateClientAccess(clientId);
    
    res.json({
      success: true,
      clientId,
      hasValidAccess: isValid,
      message: isValid 
        ? 'Client has valid GA4 property access' 
        : 'Client does not have valid GA4 property access'
    });
    
  } catch (error) {
    logger.error('Error validating GA4 access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate GA4 access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;