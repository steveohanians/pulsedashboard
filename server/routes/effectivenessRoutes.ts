/**
 * Website Effectiveness API Routes
 * 
 * Endpoints for website effectiveness scoring and evidence retrieval
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth';
import { storage } from '../storage';
import { EffectivenessConfigManager } from '../services/effectiveness/config';
import logger from '../utils/logging/logger';
import { effectivenessService } from '../services/EffectivenessService';
import { z } from 'zod';
import { db } from '../db';
import { effectivenessRuns, competitors } from '@shared/schema';
import { and, eq, or, desc, sql, isNotNull } from 'drizzle-orm';

const router = Router();

// Define the standard error response type
interface ApiError {
  code: string;
  message: string;
  [key: string]: any;
}

// Helper function to get competitor effectiveness data
async function getCompetitorEffectivenessData(clientId: string) {
  try {
    // Get latest competitor runs with complete data
    const competitorRuns = await db
      .select({
        runId: effectivenessRuns.id,
        competitorId: effectivenessRuns.competitorId,
        overallScore: effectivenessRuns.overallScore,
        status: effectivenessRuns.status,
        createdAt: effectivenessRuns.createdAt,
        screenshotUrl: effectivenessRuns.screenshotUrl,
        fullPageScreenshotUrl: effectivenessRuns.fullPageScreenshotUrl,
        webVitals: effectivenessRuns.webVitals,
        screenshotError: effectivenessRuns.screenshotError,
        fullPageScreenshotError: effectivenessRuns.fullPageScreenshotError,
        // Competitor details
        competitorDomain: competitors.domain,
        competitorLabel: competitors.label
      })
      .from(effectivenessRuns)
      .innerJoin(competitors, eq(effectivenessRuns.competitorId, competitors.id))
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        isNotNull(effectivenessRuns.competitorId),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(10);

    // Get criterion scores for each competitor run
    const competitorData = [];
    for (const run of competitorRuns) {
      const criterionScores = await storage.getCriterionScores(run.runId);
      
      competitorData.push({
        competitor: {
          id: run.competitorId,
          domain: run.competitorDomain,
          label: run.competitorLabel
        },
        run: {
          id: run.runId,
          overallScore: parseFloat(run.overallScore || '0'),
          status: run.status,
          createdAt: run.createdAt.toISOString(),
          criterionScores: criterionScores,
          screenshotUrl: run.screenshotUrl,
          fullPageScreenshotUrl: run.fullPageScreenshotUrl,
          webVitals: run.webVitals,
          screenshotError: run.screenshotError,
          fullPageScreenshotError: run.fullPageScreenshotError
        }
      });
    }

    logger.info('Retrieved competitor effectiveness data', { 
      clientId, 
      competitorCount: competitorData.length 
    });

    return competitorData;
    
  } catch (error) {
    logger.error('Error fetching competitor data', { 
      clientId,
      error: error instanceof Error ? error.message : String(error) 
    });
    return [];
  }
}

// Helper function to clean up stuck runs
async function cleanupStuckRuns(clientId: string) {
  const stuckRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, clientId),
      or(
        eq(effectivenessRuns.status, 'pending'),
        eq(effectivenessRuns.status, 'initializing'),
        eq(effectivenessRuns.status, 'in_progress')
      ),
      sql`${effectivenessRuns.createdAt} < NOW() - INTERVAL '5 minutes'`
    ));

  if (stuckRuns.length > 0) {
    logger.info('Cleaning up stuck runs', {
      clientId,
      stuckRunIds: stuckRuns.map(r => r.id)
    });

    await db
      .update(effectivenessRuns)
      .set({ 
        status: 'failed',
        progressDetail: JSON.stringify({ error: 'Run timed out after 5 minutes' })
      })
      .where(
        and(
          eq(effectivenessRuns.clientId, clientId),
          or(...stuckRuns.map(r => eq(effectivenessRuns.id, r.id)))
        )
      );
  }
}

// GET /latest/:clientId - Get latest effectiveness score for a client
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

    // Auto-fail runs stuck for more than 5 minutes
    await cleanupStuckRuns(clientId);

    // Get latest effectiveness run
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, clientId))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);

    if (runs.length === 0) {
      return res.json({
        hasData: false,
        message: 'No effectiveness data available'
      });
    }

    const latestRun = runs[0];

    // Get all criterion scores for this run
    const criterionScores = await storage.getCriterionScores(latestRun.id);

    // Get competitor effectiveness data
    const competitorData = await getCompetitorEffectivenessData(clientId);

    res.json({
      hasData: true,
      run: {
        id: latestRun.id,
        status: latestRun.status,
        overallScore: latestRun.overallScore,
        progress: latestRun.progress,
        progressDetail: latestRun.progressDetail,
        createdAt: latestRun.createdAt,
        criterionScores: criterionScores,
        screenshotUrl: latestRun.screenshotUrl,
        fullPageScreenshotUrl: latestRun.fullPageScreenshotUrl,
        aiInsights: latestRun.aiInsights,
        insightsGeneratedAt: latestRun.insightsGeneratedAt
      },
      competitorEffectivenessData: competitorData,
      client: {
        id: client.id,
        name: client.name,
        websiteUrl: client.websiteUrl
      }
    });

  } catch (error) {
    logger.error('Error fetching latest effectiveness score', { 
      error: error instanceof Error ? error.message : String(error),
      clientId: req.params.clientId
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch effectiveness data'
    });
  }
});

// POST /refresh/:clientId - Start a new effectiveness analysis
router.post('/refresh/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { force = false } = req.body;

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

    // Check if there's already a run in progress
    if (!force) {
      const activeRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          or(
            eq(effectivenessRuns.status, 'pending'),
            eq(effectivenessRuns.status, 'initializing'),
            eq(effectivenessRuns.status, 'in_progress')
          )
        ))
        .orderBy(desc(effectivenessRuns.createdAt))
        .limit(1);

      if (activeRuns.length > 0) {
        const activeRun = activeRuns[0];
        const timeDiff = Date.now() - activeRun.createdAt.getTime();
        
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          return res.json({
            message: 'Analysis already in progress',
            runId: activeRun.id,
            status: activeRun.status
          });
        }
      }
    }

    // Cooldown protection removed for testing

    // Use the clean EffectivenessService
    const result = await effectivenessService.startAnalysis(clientId, force);

    // Return HONEST response - analysis has started, not completed!
    res.json({
      message: 'Effectiveness analysis started',
      runId: result.runId,
      status: 'pending'
    });

  } catch (error) {
    logger.error('Error starting effectiveness analysis', { 
      error: error instanceof Error ? error.message : String(error),
      clientId: req.params.clientId
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to start effectiveness analysis'
    });
  }
});

// GET /:runId/evidence/:criterion - Get evidence for a specific criterion
router.get('/:runId/evidence/:criterion', requireAuth, async (req, res) => {
  try {
    const { runId, criterion } = req.params;

    logger.info('Fetching criterion evidence', { runId, criterion });

    // Get the run to verify access
    const run = await storage.getEffectivenessRun(runId);
    if (!run) {
      return res.status(404).json({
        code: 'RUN_NOT_FOUND',
        message: 'Effectiveness run not found'
      });
    }

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== run.clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Get criterion score with evidence
    const criterionScore = await storage.getCriterionScore(runId, criterion);
    if (!criterionScore) {
      return res.status(404).json({
        code: 'CRITERION_NOT_FOUND',
        message: 'Criterion score not found'
      });
    }

    res.json(criterionScore);

  } catch (error) {
    logger.error('Error fetching criterion evidence', { 
      error: error instanceof Error ? error.message : String(error),
      runId: req.params.runId,
      criterion: req.params.criterion
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch evidence'
    });
  }
});

// GET /:runId/evidence/all - Get all evidence for a run
router.get('/:runId/evidence/all', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;

    logger.info('Fetching all evidence', { runId });

    // Get the run to verify access
    const run = await storage.getEffectivenessRun(runId);
    if (!run) {
      return res.status(404).json({
        code: 'RUN_NOT_FOUND',
        message: 'Effectiveness run not found'
      });
    }

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== run.clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Get all criterion scores for this run
    const criterionScores = await storage.getCriterionScores(runId);

    res.json({
      runId,
      evidence: criterionScores
    });

  } catch (error) {
    logger.error('Error fetching all evidence', { 
      error: error instanceof Error ? error.message : String(error),
      runId: req.params.runId
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch all evidence'
    });
  }
});

// POST /:runId/insights - Generate AI insights for a run
router.post('/:runId/insights', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const { clientId } = req.body;

    logger.info('Generating insights', { runId, clientId });

    // Get the run to verify access and completion
    const run = await storage.getEffectivenessRun(runId);
    if (!run) {
      return res.status(404).json({
        code: 'RUN_NOT_FOUND',
        message: 'Effectiveness run not found'
      });
    }

    // Check user access
    if (req.user?.role !== 'Admin' && req.user?.clientId !== run.clientId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    // Ensure run is completed
    if (run.status !== 'completed') {
      return res.status(400).json({
        code: 'RUN_NOT_COMPLETED',
        message: 'Cannot generate insights for incomplete run'
      });
    }

    // Use EffectivenessService to generate insights
    const insights = await effectivenessService.generateInsights(clientId, runId);

    res.json({
      runId,
      insights
    });

  } catch (error) {
    logger.error('Error generating insights', { 
      error: error instanceof Error ? error.message : String(error),
      runId: req.params.runId
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate insights'
    });
  }
});

// GET /config - Get effectiveness configuration (admin only)
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = EffectivenessConfigManager.getConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching effectiveness config', { 
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch configuration'
    });
  }
});

// PUT /config - Update effectiveness configuration (admin only)
router.put('/config', requireAdmin, async (req, res) => {
  try {
    const updatedConfig = EffectivenessConfigManager.updateConfig(req.body);
    res.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    logger.error('Error updating effectiveness config', { 
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update configuration'
    });
  }
});

export default router;