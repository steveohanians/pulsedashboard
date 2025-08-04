/**
 * Sample Data Generation Routes
 * 
 * Safe sample data generation that never overwrites authentic GA4 data.
 */

import { Router } from 'express';
import { SampleDataManager } from '../services/sampleData';
import logger from '../utils/logger';
import { ErrorResponses, asyncErrorHandler } from '../utils/errorHandling';

const router = Router();
const sampleDataManager = new SampleDataManager();

// Admin middleware to check admin role
function adminRequired(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

/**
 * Generate sample data for a specific client
 * POST /api/sample-data/generate/:clientId
 */
router.post('/generate/:clientId', adminRequired, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;
  const { periods = 15, forceGeneration = false, skipGA4Check = false } = req.body;

  logger.info(`Sample data generation requested for client: ${clientId}`, {
    periods,
    forceGeneration,
    skipGA4Check
  });

  if (!clientId) {
    return res.status(400).json({
      success: false,
      error: 'Client ID is required'
    });
  }

  const result = await sampleDataManager.generateSampleData({
    clientId,
    periods,
    forceGeneration,
    skipGA4Check
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Sample data generation failed',
      errors: result.errors,
      warnings: result.warnings,
      safetyChecks: result.safetyChecks
    });
  }

  res.json({
    success: true,
    message: `Successfully generated sample data for ${clientId}`,
    data: {
      clientId: result.clientId,
      periodsGenerated: result.periodsGenerated,
      metricsCreated: result.metricsCreated,
      competitorsGenerated: result.competitorsGenerated,
      timespan: `${periods} months`,
      safetyChecks: result.safetyChecks
    },
    warnings: result.warnings
  });
}));

/**
 * Check if it's safe to generate sample data for a client
 * GET /api/sample-data/safety/:clientId
 */
router.get('/safety/:clientId', adminRequired, asyncErrorHandler(async (req, res) => {
  const { clientId } = req.params;

  logger.info(`Safety check requested for client: ${clientId}`);

  if (!clientId) {
    return res.status(400).json({
      success: false,
      error: 'Client ID is required'
    });
  }

  const safetyCheck = await sampleDataManager.checkGenerationSafety(clientId);

  res.json({
    success: true,
    clientId,
    safetyCheck,
    recommendation: safetyCheck.isSafeForSampleData 
      ? 'Safe to generate sample data' 
      : 'Sample data generation not recommended'
  });
}));

/**
 * Bulk generate sample data for multiple clients
 * POST /api/sample-data/bulk
 */
router.post('/bulk', adminRequired, asyncErrorHandler(async (req, res) => {
  const { clientIds, options = {} } = req.body;

  if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'clientIds array is required'
    });
  }

  logger.info(`Bulk sample data generation requested for ${clientIds.length} clients`);

  const results = [];
  
  for (const clientId of clientIds) {
    try {
      const result = await sampleDataManager.generateSampleData({
        clientId,
        ...options
      });
      
      results.push({
        clientId,
        success: result.success,
        periodsGenerated: result.periodsGenerated,
        metricsCreated: result.metricsCreated,
        competitorsGenerated: result.competitorsGenerated,
        errors: result.errors,
        warnings: result.warnings
      });

    } catch (error) {
      results.push({
        clientId,
        success: false,
        periodsGenerated: 0,
        metricsCreated: 0,
        competitorsGenerated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalMetrics = results.reduce((sum, r) => sum + r.metricsCreated, 0);
  const totalCompetitors = results.reduce((sum, r) => sum + r.competitorsGenerated, 0);

  res.json({
    success: successCount > 0,
    message: `Bulk generation completed: ${successCount}/${clientIds.length} clients processed`,
    summary: {
      clientsProcessed: clientIds.length,
      successfulClients: successCount,
      totalMetricsCreated: totalMetrics,
      totalCompetitorsGenerated: totalCompetitors
    },
    results
  });
}));

/**
 * Get configuration and limits for sample data generation
 * GET /api/sample-data/config
 */
router.get('/config', adminRequired, asyncErrorHandler(async (req, res) => {
  const { SAMPLE_DATA_CONFIG, METRIC_RANGES, TREND_PATTERNS } = await import('../services/sampleData/constants');

  res.json({
    success: true,
    config: {
      defaultPeriods: SAMPLE_DATA_CONFIG.DEFAULT_PERIODS,
      maxCompetitors: SAMPLE_DATA_CONFIG.MAX_COMPETITORS,
      minCompetitors: SAMPLE_DATA_CONFIG.MIN_COMPETITORS,
      variationRange: SAMPLE_DATA_CONFIG.VARIATION_RANGE,
      metricRanges: METRIC_RANGES,
      trendPatterns: Object.keys(TREND_PATTERNS),
      safetyFeatures: [
        'GA4 access validation',
        'Existing data detection',
        'Property configuration check',
        'Data conflict prevention'
      ]
    }
  });
}));

export default router;