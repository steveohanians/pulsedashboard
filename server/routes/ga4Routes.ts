/**
 * GA4 Integration Routes
 * Handles GA4 data ingestion and testing endpoints
 */

import { Router } from 'express';
import { ga4DataProcessor } from '../services/ga4DataProcessor';
// Admin middleware to check admin role
function adminRequired(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
import logger from '../utils/logger';

const router = Router();

/**
 * Test GA4 data processing with sample data
 * POST /api/ga4/test/:clientId
 */
router.post('/test/:clientId', adminRequired, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info(`Testing GA4 data processing for client ${clientId}`);
    
    const processedCount = await ga4DataProcessor.testDataProcessing(clientId);
    
    res.json({
      success: true,
      message: `Successfully processed ${processedCount} GA4 metrics for client ${clientId}`,
      processedCount,
    });

  } catch (error) {
    logger.error('GA4 test processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process GA4 test data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Process real GA4 data (placeholder for future implementation)
 * POST /api/ga4/process/:clientId
 */
router.post('/process/:clientId', adminRequired, async (req, res) => {
  try {
    const { clientId } = req.params;
    const ga4Data = req.body;
    
    logger.info(`Processing real GA4 data for client ${clientId}`);
    
    const processedCount = await ga4DataProcessor.processClientGA4Data(clientId, ga4Data);
    
    res.json({
      success: true,
      message: `Successfully processed ${processedCount} real GA4 metrics for client ${clientId}`,
      processedCount,
    });

  } catch (error) {
    logger.error('GA4 data processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process GA4 data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;