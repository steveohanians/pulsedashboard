/**
 * GA4 Integration Routes
 * Handles GA4 data ingestion and testing endpoints
 */

import { Router } from 'express';
import { ga4DataProcessor } from '../services/ga4/PulseDataProcessor';
import { adminRequired } from '../middleware/authMiddleware';
import { asyncErrorHandler } from '../utils/errorHandling';
import logger from '../utils/logging/logger';

const router = Router();

/**
 * Test GA4 data processing with sample data
 * POST /api/ga4/test/:clientId
 */
router.post('/test/:clientId', adminRequired, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  
  logger.info(`Testing GA4 data processing for client ${clientId}`);
  
  const processedCount = await ga4DataProcessor.testDataProcessing(clientId);
  
  res.json({
    success: true,
    message: `Successfully processed ${processedCount} GA4 metrics for client ${clientId}`,
    processedCount,
  });
}));

/**
 * Process real GA4 data (placeholder for future implementation)
 * POST /api/ga4/process/:clientId
 */
router.post('/process/:clientId', adminRequired, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  const ga4Data = req.body;
  
  logger.info(`Processing real GA4 data for client ${clientId}`);
  
  const processedCount = await ga4DataProcessor.processClientGA4Data(clientId, ga4Data);
  
  res.json({
    success: true,
    message: `Successfully processed ${processedCount} real GA4 metrics for client ${clientId}`,
    processedCount,
  });
}));

export default router;