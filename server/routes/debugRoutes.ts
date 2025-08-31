/**
 * Debug Routes for Competitor Effectiveness Scoring Analysis
 * Temporary endpoints for debugging competitor effectiveness issues
 */

import express from 'express';
import { db } from '../db';
import { competitors, effectivenessRuns, criterionScores } from '@shared/schema';
import { and, eq, desc } from 'drizzle-orm';
import logger from '../utils/logging/logger';

const router = express.Router();

/**
 * GET /api/debug/competitor-effectiveness/:clientId
 * Comprehensive inspection of competitor effectiveness data
 */
router.get('/competitor-effectiveness/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info('Debug: Inspecting competitor effectiveness data', { clientId });

    // 1. Get all competitors for this client
    const allCompetitors = await db
      .select()
      .from(competitors)
      .where(eq(competitors.clientId, clientId));

    logger.info('Debug: Found competitors', {
      clientId,
      competitorCount: allCompetitors.length,
      competitors: allCompetitors.map(c => ({
        id: c.id,
        domain: c.domain,
        label: c.label,
        status: c.status
      }))
    });

    // 2. For each competitor, get all effectiveness runs
    const competitorData = [];
    for (const competitor of allCompetitors) {
      // Get ALL runs for this competitor
      const allRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          eq(effectivenessRuns.competitorId, competitor.id)
        ))
        .orderBy(desc(effectivenessRuns.createdAt));

      // Get completed runs only
      const completedRuns = allRuns.filter(r => r.status === 'completed');
      const latestCompleted = completedRuns[0] || null;

      // Get criterion scores for latest completed run
      let criterionScoresData = [];
      if (latestCompleted) {
        criterionScoresData = await db
          .select()
          .from(criterionScores)
          .where(eq(criterionScores.runId, latestCompleted.id));
      }

      competitorData.push({
        competitor: {
          id: competitor.id,
          domain: competitor.domain,
          label: competitor.label,
          status: competitor.status
        },
        runs: {
          total: allRuns.length,
          completed: completedRuns.length,
          pending: allRuns.filter(r => r.status === 'pending').length,
          failed: allRuns.filter(r => r.status === 'failed').length,
          allRuns: allRuns.map(r => ({
            id: r.id,
            status: r.status,
            overallScore: r.overallScore,
            progress: r.progress,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          }))
        },
        latestCompleted: latestCompleted ? {
          id: latestCompleted.id,
          status: latestCompleted.status,
          overallScore: latestCompleted.overallScore,
          progress: latestCompleted.progress,
          createdAt: latestCompleted.createdAt,
          criterionScoresCount: criterionScoresData.length,
          criterionScores: criterionScoresData.map(cs => ({
            criterion: cs.criterion,
            score: cs.score
          }))
        } : null
      });
    }

    // 3. Get client effectiveness runs for comparison
    const clientRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        eq(effectivenessRuns.competitorId, null) // Client runs have null competitorId
      ))
      .orderBy(desc(effectivenessRuns.createdAt));

    const response = {
      clientId,
      timestamp: new Date().toISOString(),
      summary: {
        totalCompetitors: allCompetitors.length,
        competitorsWithCompletedRuns: competitorData.filter(cd => cd.latestCompleted).length,
        competitorsWithPendingRuns: competitorData.filter(cd => cd.runs.pending > 0).length,
        competitorsWithFailedRuns: competitorData.filter(cd => cd.runs.failed > 0).length,
        clientRuns: {
          total: clientRuns.length,
          latest: clientRuns[0] ? {
            id: clientRuns[0].id,
            status: clientRuns[0].status,
            overallScore: clientRuns[0].overallScore,
            createdAt: clientRuns[0].createdAt
          } : null
        }
      },
      competitorData,
      recommendations: []
    };

    // Add recommendations based on findings
    if (response.summary.competitorsWithCompletedRuns === 0 && allCompetitors.length > 0) {
      response.recommendations.push('No completed competitor effectiveness runs found. Background scoring may not be working.');
    }
    
    if (response.summary.competitorsWithPendingRuns > 0) {
      response.recommendations.push('Some competitors have pending runs. They may be stuck or still processing.');
    }
    
    if (response.summary.competitorsWithFailedRuns > 0) {
      response.recommendations.push('Some competitors have failed runs. Check logs for scoring errors.');
    }

    logger.info('Debug: Competitor effectiveness inspection complete', {
      clientId,
      summary: response.summary
    });

    res.json(response);

  } catch (error) {
    logger.error('Debug: Failed to inspect competitor effectiveness data', {
      clientId: req.params.clientId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INSPECTION_FAILED',
      message: 'Failed to inspect competitor effectiveness data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/debug/effectiveness-api/:clientId
 * Test the actual effectiveness API endpoint that the frontend calls
 */
router.get('/effectiveness-api/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    logger.info('Debug: Testing effectiveness API endpoint', { clientId });

    // Call the actual effectiveness API internally
    const effectivenessResponse = await fetch(`http://localhost:5000/api/effectiveness/latest/${clientId}`);
    
    if (!effectivenessResponse.ok) {
      throw new Error(`Effectiveness API returned ${effectivenessResponse.status}`);
    }

    const effectivenessData = await effectivenessResponse.json();
    
    const analysis = {
      clientId,
      timestamp: new Date().toISOString(),
      apiResponse: effectivenessData,
      analysis: {
        hasClientRun: !!effectivenessData.run,
        clientScore: effectivenessData.run?.overallScore || null,
        clientCriterionScores: effectivenessData.run?.criterionScores?.length || 0,
        hasCompetitorData: !!effectivenessData.competitorEffectivenessData,
        competitorCount: effectivenessData.competitorEffectivenessData?.length || 0,
        competitors: effectivenessData.competitorEffectivenessData?.map((cd: any) => ({
          label: cd.competitor?.label,
          domain: cd.competitor?.domain,
          hasRun: !!cd.run,
          overallScore: cd.run?.overallScore,
          criterionScoresCount: cd.run?.criterionScores?.length || 0
        })) || []
      }
    };

    logger.info('Debug: Effectiveness API analysis complete', {
      clientId,
      analysis: analysis.analysis
    });

    res.json(analysis);

  } catch (error) {
    logger.error('Debug: Failed to test effectiveness API', {
      clientId: req.params.clientId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'API_TEST_FAILED',
      message: 'Failed to test effectiveness API',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export { router as debugRoutes };