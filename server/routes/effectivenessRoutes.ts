/**
 * Website Effectiveness API Routes
 * 
 * Endpoints for website effectiveness scoring and evidence retrieval
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth';
import { storage } from '../storage';
import { WebsiteEffectivenessScorer } from '../services/effectiveness/scorer';
import { EffectivenessConfigManager } from '../services/effectiveness/config';
import logger from '../utils/logging/logger';
import { z } from 'zod';

const router = Router();
const scorer = new WebsiteEffectivenessScorer();
const configManager = EffectivenessConfigManager.getInstance();

// Request/Response schemas
const refreshRequestSchema = z.object({
  force: z.boolean().optional()
});

/**
 * GET /api/effectiveness/:clientId/latest
 * Get the most recent effectiveness score for a client
 */
router.get('/latest/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info('Fetching latest effectiveness score', { clientId });

    // Get client to verify access and get website URL
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found'
      });
    }

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Get latest effectiveness run
    const latestRun = await storage.getLatestEffectivenessRun(clientId);
    
    if (!latestRun) {
      return res.json({
        client,
        run: null,
        hasData: false
      });
    }

    // Get criterion scores for the run
    const criterionScores = await storage.getCriterionScores(latestRun.id);
    
    const response = {
      client,
      run: {
        ...latestRun,
        criterionScores
      },
      hasData: true
    };

    logger.info('Retrieved effectiveness data', {
      clientId,
      runId: latestRun.id,
      overallScore: latestRun.overallScore,
      criteriaCount: criterionScores.length
    });

    res.json(response);

  } catch (error) {
    logger.error('Failed to fetch effectiveness data', {
      clientId: req.params.clientId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch effectiveness data'
    });
  }
});

/**
 * POST /api/effectiveness/:clientId/refresh  
 * Trigger new effectiveness scoring for a client
 */
router.post('/refresh/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const body = refreshRequestSchema.safeParse(req.body);
    
    if (!body.success) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'Invalid request body',
        details: body.error.errors
      });
    }

    const { force = false } = body.data;

    logger.info('Effectiveness refresh requested', { clientId, force });

    // Get client to verify access and get website URL
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found'
      });
    }

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Check cooldown (24 hours) unless forced or user is admin
    if (!force && req.user?.role !== 'Admin' && client.lastEffectivenessRun) {
      const cooldownHours = 24;
      const timeSinceLastRun = Date.now() - new Date(client.lastEffectivenessRun).getTime();
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      
      if (timeSinceLastRun < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastRun;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        
        return res.status(429).json({
          code: 'COOLDOWN_ACTIVE',
          message: `Effectiveness scoring is on cooldown. Try again in ${remainingHours} hours.`,
          remainingHours
        });
      }
    }

    // Create new run record
    const newRun = await storage.createEffectivenessRun({
      clientId,
      status: 'pending',
      overallScore: null
    });

    // Start scoring process asynchronously
    setImmediate(async () => {
      try {
        logger.info('Starting effectiveness scoring', { clientId, runId: newRun.id });
        
        // Update progress: Initializing
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'initializing',
          progress: 'Preparing website analysis...'
        });
        
        // Update progress: Scraping website
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'scraping',
          progress: 'Loading website and capturing screenshot...'
        });
        
        const result = await scorer.scoreWebsite(client.websiteUrl);
        
        // Update progress: Analyzing criteria
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'analyzing',
          progress: 'Scoring website effectiveness criteria...'
        });
        
        // Update run with results
        await storage.updateEffectivenessRun(newRun.id, {
          overallScore: result.overallScore.toString(),
          status: 'completed',
          progress: 'Analysis completed successfully',
          screenshotUrl: result.screenshotUrl,
          webVitals: result.webVitals
        });

        // Save criterion scores
        for (const criterionResult of result.criterionResults) {
          await storage.createCriterionScore({
            runId: newRun.id,
            criterion: criterionResult.criterion,
            score: criterionResult.score.toString(),
            evidence: criterionResult.evidence,
            passes: criterionResult.passes
          });
        }

        // Update client last run timestamp
        await storage.updateClient(clientId, {
          lastEffectivenessRun: new Date()
        });

        logger.info('Effectiveness scoring completed', {
          clientId,
          runId: newRun.id,
          overallScore: result.overallScore,
          criteriaCount: result.criterionResults.length
        });

      } catch (scoringError) {
        logger.error('Effectiveness scoring failed', {
          clientId,
          runId: newRun.id,
          error: scoringError instanceof Error ? scoringError.message : String(scoringError)
        });

        // Mark run as failed
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'failed',
          progress: `Analysis failed: ${scoringError instanceof Error ? scoringError.message : String(scoringError)}`
        });
      }
    });

    res.json({
      message: 'Effectiveness scoring started',
      runId: newRun.id,
      status: 'pending'
    });

  } catch (error) {
    logger.error('Failed to start effectiveness refresh', {
      clientId: req.params.clientId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to start effectiveness scoring'
    });
  }
});

/**
 * GET /api/effectiveness/:clientId/evidence/:runId
 * Get detailed evidence for a specific effectiveness run
 */
router.get('/evidence/:clientId/:runId', requireAuth, async (req, res) => {
  try {
    const { clientId, runId } = req.params;
    
    logger.info('Fetching effectiveness evidence', { clientId, runId });

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Get run details
    const run = await storage.getEffectivenessRun(runId);
    if (!run || run.clientId !== clientId) {
      return res.status(404).json({
        code: 'RUN_NOT_FOUND',
        message: 'Effectiveness run not found'
      });
    }

    // Debug log to check webVitals data
    logger.info('Evidence API - run data', {
      clientId,
      runId,
      hasWebVitals: !!run.webVitals,
      webVitalsData: run.webVitals,
      webVitalsType: typeof run.webVitals
    });

    // Get detailed criterion scores
    const criterionScores = await storage.getCriterionScores(runId);
    
    const evidence = {
      run,
      criterionScores,
      summary: {
        overallScore: run.overallScore,
        criteriaCount: criterionScores.length,
        completedAt: run.createdAt,
        status: run.status
      }
    };

    res.json(evidence);

  } catch (error) {
    logger.error('Failed to fetch effectiveness evidence', {
      clientId: req.params.clientId,
      runId: req.params.runId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch evidence data'
    });
  }
});

/**
 * PUT /api/admin/effectiveness/config
 * Update effectiveness scoring configuration (Admin only)
 */
router.put('/admin/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'Key and value are required'
      });
    }

    logger.info('Updating effectiveness configuration', { key, description });

    await configManager.updateConfig(key, value, description);
    
    res.json({
      message: 'Configuration updated successfully',
      key,
      description
    });

  } catch (error) {
    logger.error('Failed to update effectiveness configuration', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/admin/effectiveness/config
 * Get current effectiveness scoring configuration (Admin only)
 */
router.get('/admin/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const config = await configManager.getConfig();
    res.json(config);
  } catch (error) {
    logger.error('Failed to fetch effectiveness configuration', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch configuration'
    });
  }
});

/**
 * GET /api/effectiveness/test-screenshot
 * Test screenshot functionality (Admin only)
 */
router.get('/test-screenshot', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        code: 'INVALID_URL',
        message: 'URL parameter is required'
      });
    }

    logger.info('Testing screenshot functionality', { url });

    // Import screenshot service
    const { screenshotService } = await import('../services/effectiveness/screenshot');
    
    // First test capabilities
    const capabilities = await screenshotService.testScreenshotCapability();
    
    // Try to capture a screenshot
    const result = await screenshotService.captureWebsiteScreenshot({
      url,
      outputDir: 'uploads/screenshots',
      filename: `test_${Date.now()}.png`
    });

    // Check if file exists
    const fs = await import('fs');
    const fileExists = result.screenshotPath ? 
      await fs.promises.access(result.screenshotPath).then(() => true).catch(() => false) : 
      false;

    res.json({
      capabilities,
      screenshotResult: {
        ...result,
        fileExists,
        absolutePath: result.screenshotPath ? 
          require('path').resolve(result.screenshotPath) : null
      }
    });

  } catch (error) {
    logger.error('Screenshot test failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'SCREENSHOT_TEST_FAILED',
      message: 'Screenshot test failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;