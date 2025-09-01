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
import { db } from '../db';
import { effectivenessRuns } from '@shared/schema';
import { and, eq, or, desc, sql, isNotNull } from 'drizzle-orm';

const router = Router();
const scorer = new WebsiteEffectivenessScorer();
const configManager = EffectivenessConfigManager.getInstance();

// Request/Response schemas
const refreshRequestSchema = z.object({
  force: z.boolean().optional()
});

/**
 * Score a website with timeout protection
 */
async function scoreWithTimeout(url: string, timeoutMs: number = 120000): Promise<any> {
  return Promise.race([
    scorer.scoreWebsite(url),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Scoring timeout after ${timeoutMs/1000} seconds`)), timeoutMs)
    )
  ]);
}

/**
 * Clean up stuck runs older than threshold
 */
async function cleanupStuckRuns(clientId: string): Promise<void> {
  const stuckThreshold = 5; // 5 minutes
  
  const stuckRuns = await db.update(effectivenessRuns)
    .set({
      status: 'failed',
      progress: 'Run timed out after 5 minutes - please retry'
    })
    .where(and(
      eq(effectivenessRuns.clientId, clientId),
      or(
        eq(effectivenessRuns.status, 'pending'),
        eq(effectivenessRuns.status, 'initializing'),
        eq(effectivenessRuns.status, 'scraping'),
        eq(effectivenessRuns.status, 'analyzing'),
        eq(effectivenessRuns.status, 'generating_insights')
      ),
      sql`created_at < NOW() - INTERVAL '${sql.raw(stuckThreshold.toString())} minutes'`
    ));
  
  if (stuckRuns.rowCount > 0) {
    logger.info('Cleaned up stuck runs', {
      clientId,
      count: stuckRuns.rowCount
    });
  }
}

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

    // Auto-fail runs stuck for more than 5 minutes
    const stuckRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        or(
          eq(effectivenessRuns.status, 'pending'),
          eq(effectivenessRuns.status, 'initializing'),
          eq(effectivenessRuns.status, 'scraping'),
          eq(effectivenessRuns.status, 'analyzing')
        ),
        sql`created_at < NOW() - INTERVAL '${sql.raw('5')} minutes'`
      ));

    if (stuckRuns.length > 0) {
      // Mark stuck runs as failed
      for (const stuckRun of stuckRuns) {
        await storage.updateEffectivenessRun(stuckRun.id, {
          status: 'failed',
          progress: 'Run timed out - please retry'
        });
      }
      
      logger.warn('Auto-failed stuck runs', {
        clientId,
        stuckRunIds: stuckRuns.map(r => r.id)
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
    
    // Get competitor effectiveness data
    logger.info('Fetching competitor effectiveness data', {
      clientId,
      function: 'getLatestEffectiveness',
      step: 'fetchingCompetitors'
    });

    const competitors = await storage.getCompetitorsByClient(clientId);
    
    logger.info('Found competitors for client', {
      clientId,
      competitorCount: competitors.length,
      competitors: competitors.map(c => ({
        id: c.id,
        domain: c.domain,
        label: c.label,
        status: c.status
      }))
    });

    const competitorEffectivenessData = [];
    
    for (const competitor of competitors) {
      logger.info('Processing competitor effectiveness data', {
        clientId,
        competitorId: competitor.id,
        competitorDomain: competitor.domain,
        competitorLabel: competitor.label
      });

      const competitorRun = await storage.getLatestEffectivenessRunByCompetitor(clientId, competitor.id);
      
      if (competitorRun) {
        const competitorScores = await storage.getCriterionScores(competitorRun.id);
        
        logger.info('Found competitor effectiveness run', {
          clientId,
          competitorId: competitor.id,
          runId: competitorRun.id,
          status: competitorRun.status,
          overallScore: competitorRun.overallScore,
          criterionScoresCount: competitorScores.length
        });
        
        competitorEffectivenessData.push({
          competitor,
          run: {
            ...competitorRun,
            criterionScores: competitorScores
          }
        });
      } else {
        logger.info('No effectiveness run found for competitor', {
          clientId,
          competitorId: competitor.id,
          competitorDomain: competitor.domain
        });
      }
    }

    // Determine overall status considering competitor runs
    let overallStatus = latestRun.status;
    let overallProgress = latestRun.progress;
    
    if (competitors.length > 0) {
      // Check if we have stuck or pending competitor runs
      const pendingCompetitorRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          isNotNull(effectivenessRuns.competitorId),
          or(
            eq(effectivenessRuns.status, 'pending'),
            eq(effectivenessRuns.status, 'initializing'),
            eq(effectivenessRuns.status, 'scraping'),
            eq(effectivenessRuns.status, 'analyzing')
          ),
          sql`created_at >= NOW() - INTERVAL '${sql.raw('5')} minutes'` // Reduced from 30 to 5 minutes
        ));
      
      if (pendingCompetitorRuns.length > 0) {
        // We have pending competitor runs
        overallStatus = 'analyzing';
        overallProgress = `Analyzing ${pendingCompetitorRuns.length} competitor websites...`;
        
        logger.info('Adjusting overall status due to pending competitor runs', {
          clientId,
          clientStatus: latestRun.status,
          pendingCompetitorRuns: pendingCompetitorRuns.length,
          completedCompetitors: competitorEffectivenessData.length,
          totalCompetitors: competitors.length,
          overallStatus,
          overallProgress,
          safeguardActive: true,
          pendingRunIds: pendingCompetitorRuns.map(r => r.id)
        });
      }
    }
    
    const response = {
      client,
      run: {
        ...latestRun,
        // Override status and progress to reflect overall completion
        status: overallStatus,
        progress: overallProgress,
        criterionScores
      },
      competitorEffectivenessData,
      hasData: true
    };

    logger.info('Effectiveness data response prepared', {
      clientId,
      overallStatus,
      overallProgress,
      clientRunStatus: latestRun.status,
      criteriaCount: criterionScores.length,
      hasInsights: !!latestRun.aiInsights,
      competitorEffectivenessDataCount: competitorEffectivenessData.length,
      finalResponse: {
        hasData: response.hasData,
        clientOverallScore: response.run?.overallScore,
        competitorData: competitorEffectivenessData.map(cd => ({
          competitorLabel: cd.competitor.label,
          overallScore: cd.run.overallScore,
          criterionScoresCount: cd.run.criterionScores.length
        }))
      }
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
      let runFailed = false;
      try {
        logger.info('Starting effectiveness scoring', { clientId, runId: newRun.id });
        
        // Clean up any stuck runs first
        await cleanupStuckRuns(clientId);

        // Update progress: Initializing
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'initializing',
          progress: 'Analyzing website effectiveness..'
        });
        
        // Update progress: Scraping website
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'scraping',
          progress: 'Scoring criteria...'
        });
        
        // Score with 2-minute timeout
        const result = await scoreWithTimeout(client.websiteUrl, 120000);
        
        // Update progress: Analyzing criteria
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'analyzing',
          progress: 'Scoring website effectiveness criteria...'
        });
        
        // Save criterion scores first (needed for insights generation)
        for (const criterionResult of result.criterionResults) {
          await storage.createCriterionScore({
            runId: newRun.id,
            criterion: criterionResult.criterion,
            score: criterionResult.score.toString(),
            evidence: criterionResult.evidence,
            passes: criterionResult.passes
          });
        }

        // Generate AI insights after scoring is complete
        let aiInsights = null;
        let insightsGeneratedAt = null;
        
        try {
          // Update progress: Generating insights
          await storage.updateEffectivenessRun(newRun.id, {
            status: 'generating_insights',
            progress: 'Generating AI-powered insights...'
          });

          // Import and create insights service
          const { createInsightsService } = await import('../services/effectiveness');
          const insightsService = createInsightsService(storage);

          // Update the run with overallScore first so insights can access it
          await storage.updateEffectivenessRun(newRun.id, {
            overallScore: result.overallScore.toString()
          });
          
          logger.info('Updated run with overallScore before insights generation', {
            clientId,
            runId: newRun.id,
            overallScore: result.overallScore
          });

          // Generate insights using OpenAI
          const insights = await insightsService.generateInsights(newRun.id);
          aiInsights = insights.insights;
          insightsGeneratedAt = new Date();

          logger.info('AI insights generated successfully', {
            clientId,
            runId: newRun.id,
            insightsLength: aiInsights?.length
          });
        } catch (insightsError) {
          logger.error('Failed to generate AI insights', {
            clientId,
            runId: newRun.id,
            error: insightsError instanceof Error ? insightsError.message : String(insightsError)
          });
          // Continue without insights - don't fail the entire run
        }

        // Complete the run with all results
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'completed',
          overallScore: result.overallScore.toString(),
          progress: 'Analyzing competitors...',
          screenshotUrl: result.screenshotUrl,
          fullPageScreenshotUrl: result.fullPageScreenshotUrl,
          webVitals: result.webVitals,
          aiInsights,
          insightsGeneratedAt,
          screenshotMethod: result.screenshotMethod || null,
          screenshotError: result.screenshotError || null,
          fullPageScreenshotError: result.fullPageScreenshotError || null
        });

        // Update client with last run time
        await storage.updateClient(clientId, {
          lastEffectivenessRun: new Date()
        });

        logger.info('Effectiveness scoring completed', {
          clientId,
          runId: newRun.id,
          overallScore: result.overallScore,
          criteriaCount: result.criterionResults.length,
          hasInsights: !!aiInsights
        });

        // Score competitors if any
        const competitors = await storage.getCompetitorsByClient(clientId);
        
        if (competitors.length > 0) {
          logger.info('Starting competitor scoring', {
            clientId,
            competitorCount: competitors.length
          });

          for (let index = 0; index < competitors.length; index++) {
            const competitor = competitors[index];
            
            try {
              // Only skip if there's an active pending run (to avoid duplicates)
              // Always create new runs for completed runs since this is a user-requested action
              const activePendingRun = await db
                .select()
                .from(effectivenessRuns)
                .where(and(
                  eq(effectivenessRuns.clientId, clientId),
                  eq(effectivenessRuns.competitorId, competitor.id),
                  eq(effectivenessRuns.status, 'pending'),
                  sql`created_at > NOW() - INTERVAL '${sql.raw('5')} minutes'` // Changed from 1 hour
                ))
                .orderBy(desc(effectivenessRuns.createdAt))
                .limit(1);

              if (activePendingRun.length > 0) {
                logger.info('Skipping competitor - active pending run exists', {
                  clientId,
                  competitorId: competitor.id,
                  competitorDomain: competitor.domain,
                  pendingRunId: activePendingRun[0].id,
                  pendingRunCreated: activePendingRun[0].createdAt
                });
                continue;
              }

              // Add delay between competitors to avoid rate limiting
              if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
              }

              // Create new run for competitor
              const competitorRun = await storage.createEffectivenessRun({
                clientId,
                competitorId: competitor.id,
                status: 'pending',
                overallScore: null
              });

              logger.info('Scoring competitor website', {
                clientId,
                competitorId: competitor.id,
                competitorDomain: competitor.domain,
                runId: competitorRun.id,
                hasScreenshotKey: !!process.env.SCREENSHOTONE_API_KEY
              });

              // Update progress
              await storage.updateEffectivenessRun(newRun.id, {
                progress: `Scoring competitors (${index + 1}/${competitors.length}): ${competitor.label || competitor.domain}...`
              });

              // Score competitor website
              let competitorUrl = competitor.domain;
              if (!competitorUrl.startsWith('http://') && !competitorUrl.startsWith('https://')) {
                competitorUrl = `https://${competitorUrl}`;
              }

              // Score competitor with 90-second timeout
              const competitorResult = await scoreWithTimeout(competitorUrl, 90000);
              
              // Save competitor criterion scores
              for (const criterionResult of competitorResult.criterionResults) {
                await storage.createCriterionScore({
                  runId: competitorRun.id,
                  criterion: criterionResult.criterion,
                  score: criterionResult.score.toString(),
                  evidence: criterionResult.evidence,
                  passes: criterionResult.passes
                });
              }

              // Update competitor run with results
              await storage.updateEffectivenessRun(competitorRun.id, {
                status: 'completed',
                overallScore: competitorResult.overallScore.toString(),
                progress: 'Competitor analysis completed',
                screenshotUrl: competitorResult.screenshotUrl,
                fullPageScreenshotUrl: competitorResult.fullPageScreenshotUrl,
                webVitals: competitorResult.webVitals,
                screenshotMethod: competitorResult.screenshotMethod || null,
                screenshotError: competitorResult.screenshotError || null,
                fullPageScreenshotError: competitorResult.fullPageScreenshotError || null
              });

              logger.info('Competitor scoring completed', {
                clientId,
                competitorId: competitor.id,
                competitorDomain: competitor.domain,
                overallScore: competitorResult.overallScore
              });

            } catch (competitorError) {
              logger.error('Competitor scoring failed', {
                clientId,
                competitorId: competitor.id,
                competitorDomain: competitor.domain,
                error: competitorError instanceof Error ? competitorError.message : String(competitorError)
              });
              
              // Mark the run as failed
              try {
                const failedRun = await db
                  .select()
                  .from(effectivenessRuns)
                  .where(and(
                    eq(effectivenessRuns.clientId, clientId),
                    eq(effectivenessRuns.competitorId, competitor.id),
                    eq(effectivenessRuns.status, 'pending')
                  ))
                  .orderBy(desc(effectivenessRuns.createdAt))
                  .limit(1);

                if (failedRun.length > 0) {
                  await storage.updateEffectivenessRun(failedRun[0].id, {
                    status: 'failed',
                    progress: `Analysis failed: ${competitorError instanceof Error ? competitorError.message : String(competitorError)}`
                  });
                }
              } catch (updateError) {
                logger.warn('Failed to mark competitor run as failed', {
                  competitorId: competitor.id,
                  error: updateError instanceof Error ? updateError.message : String(updateError)
                });
              }
            }
          }
          
          // Update final progress
          await storage.updateEffectivenessRun(newRun.id, {
            progress: 'All competitor analysis completed'
          });
        }

      } catch (scoringError) {
        runFailed = true;
        logger.error('Effectiveness scoring failed', {
          clientId,
          runId: newRun.id,
          error: scoringError instanceof Error ? scoringError.message : String(scoringError)
        });
        
        // Always mark as failed
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'failed',
          progress: `Analysis failed: ${scoringError instanceof Error ? scoringError.message : 'Unknown error'}`
        });
      } finally {
        // Ensure we don't leave runs in pending state
        if (!runFailed) {
          const finalRun = await storage.getEffectivenessRun(newRun.id);
          if (finalRun && ['pending', 'initializing', 'scraping', 'analyzing'].includes(finalRun.status)) {
            await storage.updateEffectivenessRun(newRun.id, {
              status: 'failed',
              progress: 'Run did not complete properly'
            });
          }
        }
      }
    });

    res.json({
      message: 'Effectiveness scoring completed',
      runId: newRun.id,
      status: 'completed'
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
 * GET /api/effectiveness/:runId/evidence/:criterion
 * Get detailed evidence for a specific criterion
 */
router.get('/:runId/evidence/:criterion', requireAuth, async (req, res) => {
  try {
    const { runId, criterion } = req.params;
    
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

    // Get the specific criterion score
    const scores = await storage.getCriterionScores(runId);
    const criterionScore = scores.find(s => s.criterion === criterion);

    if (!criterionScore) {
      return res.status(404).json({
        code: 'EVIDENCE_NOT_FOUND',
        message: `No evidence found for criterion: ${criterion}`
      });
    }

    res.json({
      runId,
      criterion,
      score: criterionScore.score,
      evidence: criterionScore.evidence,
      passes: criterionScore.passes
    });

  } catch (error) {
    logger.error('Failed to fetch evidence', {
      runId: req.params.runId,
      criterion: req.params.criterion,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch evidence'
    });
  }
});

/**
 * POST /api/effectiveness/:runId/insights
 * Generate AI insights for an effectiveness run
 */
router.post('/:runId/insights', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    
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

    // Check if run is completed
    if (run.status !== 'completed') {
      return res.status(400).json({
        code: 'RUN_NOT_COMPLETED',
        message: 'Effectiveness run must be completed before generating insights'
      });
    }

    // Check if insights already exist
    if (run.aiInsights) {
      return res.json({
        runId,
        insights: run.aiInsights,
        generatedAt: run.insightsGeneratedAt
      });
    }

    logger.info('Generating AI insights for run', { runId });

    // Import and create insights service
    const { createInsightsService } = await import('../services/effectiveness');
    const insightsService = createInsightsService(storage);

    // Generate insights
    const result = await insightsService.generateInsights(runId);

    // Update run with insights
    await storage.updateEffectivenessRun(runId, {
      aiInsights: result.insights,
      insightsGeneratedAt: new Date()
    });

    res.json({
      runId,
      insights: result.insights,
      generatedAt: new Date()
    });

  } catch (error) {
    logger.error('Failed to generate insights', {
      runId: req.params.runId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate insights'
    });
  }
});

/**
 * GET /api/effectiveness/config
 * Get effectiveness scoring configuration (admin only)
 */
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await configManager.getConfig();
    res.json(config);
  } catch (error) {
    logger.error('Failed to fetch effectiveness config', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch configuration'
    });
  }
});

/**
 * PUT /api/effectiveness/config
 * Update effectiveness scoring configuration (admin only)
 */
router.put('/config', requireAdmin, async (req, res) => {
  try {
    const updated = await configManager.updateConfig(req.body);
    res.json(updated);
  } catch (error) {
    logger.error('Failed to update effectiveness config', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update configuration'
    });
  }
});

export default router;