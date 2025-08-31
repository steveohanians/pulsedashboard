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
        logger.info('Found completed competitor run, fetching criterion scores', {
          clientId,
          competitorId: competitor.id,
          runId: competitorRun.id,
          overallScore: competitorRun.overallScore
        });

        const competitorCriterionScores = await storage.getCriterionScores(competitorRun.id);
        
        logger.info('Retrieved competitor criterion scores', {
          clientId,
          competitorId: competitor.id,
          runId: competitorRun.id,
          criterionScoresCount: competitorCriterionScores.length,
          criterionScores: competitorCriterionScores.map(cs => ({
            criterion: cs.criterion,
            score: cs.score
          }))
        });

        competitorEffectivenessData.push({
          competitor,
          run: {
            ...competitorRun,
            criterionScores: competitorCriterionScores
          }
        });
      } else {
        logger.warn('No completed competitor run found', {
          clientId,
          competitorId: competitor.id,
          competitorDomain: competitor.domain,
          competitorLabel: competitor.label
        });
      }
    }

    logger.info('Completed competitor effectiveness data processing', {
      clientId,
      totalCompetitors: competitors.length,
      competitorsWithData: competitorEffectivenessData.length,
      competitorsWithoutData: competitors.length - competitorEffectivenessData.length
    });
    
    // Compute overall status considering both client and competitor runs
    let overallStatus = latestRun.status;
    let overallProgress = latestRun.progress;
    
    if (competitors.length > 0) {
      // Check if we have pending competitor runs (with safeguard to prevent endless loops)
      const pendingCompetitorRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          isNotNull(effectivenessRuns.competitorId),
          sql`status IN ('pending', 'initializing', 'scraping', 'analyzing')`,
          sql`created_at >= NOW() - INTERVAL '30 minutes'` // Ignore runs older than 30min
        ));
      
      if (pendingCompetitorRuns.length > 0) {
        // We have pending competitor runs
        overallStatus = 'analyzing';
        overallProgress = `Scoring competitors (${competitorEffectivenessData.length}/${competitors.length} completed)`;
        
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
        criterionScores,
        // Include AI insights if available
        aiInsights: latestRun.aiInsights || null,
        insightsGeneratedAt: latestRun.insightsGeneratedAt || null
      },
      competitorEffectivenessData,
      hasData: true
    };

    logger.info('Retrieved effectiveness data - Final Response', {
      clientId,
      runId: latestRun.id,
      overallScore: latestRun.overallScore,
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

    logger.info('🔍 DEBUG: Effectiveness refresh requested', { 
      clientId, 
      force, 
      userRole: req.user?.role,
      userId: req.user?.id 
    });

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

          // Generate insights (don't pass userId/userRole for internal generation)
          const insightsResult = await insightsService.generateInsights(
            clientId, 
            newRun.id, 
            undefined, // userId - internal generation, skip auth
            'Admin'    // userRole - internal generation, use admin privileges
          );

          aiInsights = insightsResult.insights;
          insightsGeneratedAt = new Date();
          
          logger.info('AI insights generated successfully', {
            clientId,
            runId: newRun.id,
            keyPattern: aiInsights.key_pattern,
            recommendationCount: aiInsights.recommendations.length
          });

        } catch (insightsError) {
          logger.warn('AI insights generation failed, continuing without insights', {
            clientId,
            runId: newRun.id,
            error: insightsError instanceof Error ? insightsError.message : String(insightsError)
          });
          // Don't fail the entire run if insights fail
        }

        // Update run with final results, screenshot metadata, and insights
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'completed',
          progress: 'Analysis completed successfully',
          screenshotUrl: result.screenshotUrl,
          fullPageScreenshotUrl: result.fullPageScreenshotUrl,
          webVitals: result.webVitals,
          screenshotMethod: result.screenshotMethod || null,
          screenshotError: result.screenshotError || null,
          fullPageScreenshotError: result.fullPageScreenshotError || null,
          aiInsights,
          insightsGeneratedAt
        });

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

        // Start competitor scoring process (don't wait for it to complete)
        // This runs after client scoring but doesn't block the response
        logger.info('🔍 COMPETITOR DEBUG: About to start competitor scoring section', { clientId });
        (async () => {
          try {
            const competitors = await storage.getCompetitorsByClient(clientId);
            logger.info('🔍 COMPETITOR DEBUG: Fetched competitors', { clientId, competitorCount: competitors?.length || 0 });
            if (!competitors || competitors.length === 0) {
              logger.info('No competitors found for scoring', { clientId });
              return;
            }

            logger.info('Starting competitor effectiveness scoring', {
              clientId,
              competitorCount: competitors.length,
              parentRunId: newRun.id
            });

            // Process competitors with controlled concurrency instead of sequential delays
            const competitorPromises = competitors.map(async (competitor, index) => {
              try {
                // First, clean up any stale pending runs (older than 2 hours)
                const staleRuns = await db
                  .select()
                  .from(effectivenessRuns)
                  .where(and(
                    eq(effectivenessRuns.clientId, clientId),
                    eq(effectivenessRuns.competitorId, competitor.id),
                    eq(effectivenessRuns.status, 'pending'),
                    sql`created_at < NOW() - INTERVAL '2 hours'`
                  ));

                if (staleRuns.length > 0) {
                  logger.warn('Found stale pending competitor runs, marking as failed', {
                    clientId,
                    competitorId: competitor.id,
                    competitorDomain: competitor.domain,
                    staleRunCount: staleRuns.length,
                    staleRuns: staleRuns.map(r => ({
                      id: r.id,
                      createdAt: r.createdAt,
                      ageHours: Math.round((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60))
                    }))
                  });

                  // Mark all stale pending runs as failed
                  for (const staleRun of staleRuns) {
                    await storage.updateEffectivenessRun(staleRun.id, {
                      status: 'failed',
                      progress: `Competitor run timed out after 2+ hours - marked as failed by cleanup process`
                    });
                  }

                  logger.info('Cleaned up stale pending competitor runs', {
                    clientId,
                    competitorId: competitor.id,
                    cleanedUpCount: staleRuns.length
                  });
                }

                // Check if there's already a recent run (within 24 hours) or active pending run
                const existingRun = await db
                  .select()
                  .from(effectivenessRuns)
                  .where(and(
                    eq(effectivenessRuns.clientId, clientId),
                    eq(effectivenessRuns.competitorId, competitor.id),
                    or(
                      // Active pending runs (less than 2 hours old)
                      and(
                        eq(effectivenessRuns.status, 'pending'),
                        sql`created_at > NOW() - INTERVAL '2 hours'`
                      ),
                      // Recent completed runs (within 24 hours)
                      and(
                        eq(effectivenessRuns.status, 'completed'),
                        sql`created_at > NOW() - INTERVAL '24 hours'`
                      )
                    )
                  ))
                  .orderBy(desc(effectivenessRuns.createdAt))
                  .limit(1);

                if (existingRun.length > 0) {
                  const runAge = Math.round((Date.now() - new Date(existingRun[0].createdAt).getTime()) / (1000 * 60 * 60));
                  logger.info('Skipping competitor scoring - recent or active run exists', {
                    clientId,
                    competitorId: competitor.id,
                    competitorDomain: competitor.domain,
                    existingRunStatus: existingRun[0].status,
                    existingRunCreated: existingRun[0].createdAt,
                    runAgeHours: runAge
                  });
                  return null; // Skip this competitor
                }

                // Add small staggered delay to prevent simultaneous API calls (5 seconds per competitor)
                if (index > 0) {
                  const delayMs = index * 5000; // 5 seconds between each competitor start
                  logger.info('Applying stagger delay for competitor', {
                    clientId,
                    competitorId: competitor.id,
                    competitorIndex: index,
                    delayMs
                  });
                  await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                // Create new run record for competitor
                const competitorRun = await storage.createEffectivenessRun({
                  clientId,
                  competitorId: competitor.id,
                  status: 'pending',
                  overallScore: null
                });

                logger.info('Starting competitor scoring', {
                  clientId,
                  competitorId: competitor.id,
                  competitorDomain: competitor.domain,
                  runId: competitorRun.id,
                  competitorIndex: index
                });

                // Score competitor website - normalize URL
                let competitorUrl = competitor.domain;
                if (!competitorUrl.startsWith('http://') && !competitorUrl.startsWith('https://')) {
                  competitorUrl = `https://${competitorUrl}`;
                }

                // Add timeout wrapper to prevent hanging
                const competitorResult = await Promise.race([
                  scorer.scoreWebsite(competitorUrl),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Competitor scoring timeout after 5 minutes')), 5 * 60 * 1000)
                  )
                ]) as any; // Type assertion to handle Promise.race typing
                
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

                // Update competitor run with final results (no AI insights for competitors)
                await storage.updateEffectivenessRun(competitorRun.id, {
                  status: 'completed',
                  overallScore: competitorResult.overallScore.toString(),
                  progress: 'Competitor analysis completed successfully',
                  screenshotUrl: competitorResult.screenshotUrl,
                  fullPageScreenshotUrl: competitorResult.fullPageScreenshotUrl,
                  webVitals: competitorResult.webVitals,
                  screenshotMethod: competitorResult.screenshotMethod || null,
                  screenshotError: competitorResult.screenshotError || null,
                  fullPageScreenshotError: competitorResult.fullPageScreenshotError || null
                });

                logger.info('Competitor effectiveness scoring completed successfully', {
                  clientId,
                  competitorId: competitor.id,
                  competitorDomain: competitor.domain,
                  runId: competitorRun.id,
                  overallScore: competitorResult.overallScore,
                  competitorIndex: index
                });

                return { competitor, runId: competitorRun.id, success: true };

              } catch (competitorError) {
                logger.error('Competitor effectiveness scoring failed', {
                  clientId,
                  competitorId: competitor.id,
                  competitorDomain: competitor.domain,
                  competitorIndex: index,
                  error: competitorError instanceof Error ? competitorError.message : String(competitorError)
                });
                
                // Mark the run as failed if it was created
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
                    await storage.updateEffectivenessRun(failedRun.id, {
                      status: 'failed',
                      progress: `Competitor analysis failed: ${competitorError instanceof Error ? competitorError.message : String(competitorError)}`
                    });
                  }
                } catch (updateError) {
                  logger.warn('Failed to mark competitor run as failed', {
                    clientId,
                    competitorId: competitor.id,
                    updateError: updateError instanceof Error ? updateError.message : String(updateError)
                  });
                }
                
                return { competitor, error: competitorError, success: false };
              }
            });

            // Wait for all competitor scoring to complete (or fail)
            const results = await Promise.allSettled(competitorPromises);
            
            const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success)).length;
            const skipped = results.filter(r => r.status === 'fulfilled' && r.value === null).length;
            
            logger.info('Competitor effectiveness scoring completed', {
              clientId,
              totalCompetitors: competitors.length,
              successful,
              failed,
              skipped,
              parentRunId: newRun.id
            });

          } catch (backgroundError) {
            logger.error('🔍 COMPETITOR DEBUG: Competitor scoring process failed', {
              clientId,
              parentRunId: newRun.id,
              error: backgroundError instanceof Error ? backgroundError.message : String(backgroundError)
            });
          }
          
          logger.info('🔍 COMPETITOR DEBUG: Competitor async block finished', { clientId });
        })().catch(err => {
          logger.error('Unhandled competitor scoring error', {
            clientId,
            parentRunId: newRun.id,
            error: err instanceof Error ? err.message : String(err)
          });
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
    
    // Add screenshot debugging info if available
    const screenshotInfo = {
      hasScreenshot: !!run.screenshotUrl && run.screenshotUrl !== '',
      screenshotMethod: run.screenshotMethod || null,
      screenshotError: run.screenshotError || null,
      hasFullPageScreenshot: !!run.fullPageScreenshotUrl && run.fullPageScreenshotUrl !== '',
      fullPageScreenshotError: run.fullPageScreenshotError || null
    };
    
    const evidence = {
      run: {
        ...run,
        ...screenshotInfo
      },
      criterionScores,
      summary: {
        overallScore: run.overallScore,
        criteriaCount: criterionScores.length,
        completedAt: run.createdAt,
        status: run.status,
        screenshot: screenshotInfo
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

/**
 * POST /api/effectiveness/insights/:clientId/:runId
 * Generate AI insights for effectiveness scoring results (fallback/regeneration)
 */
router.post('/insights/:clientId/:runId', requireAuth, async (req, res) => {
  try {
    const { clientId, runId } = req.params;
    const { force = false } = req.body;

    // Check if insights already exist and are recent
    if (!force) {
      const run = await storage.getEffectivenessRun(runId);
      if (run?.aiInsights && run.insightsGeneratedAt) {
        const isRecent = new Date(run.insightsGeneratedAt) > new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
        if (isRecent) {
          logger.info('Returning cached insights', { clientId, runId });
          return res.json({
            success: true,
            insights: run.aiInsights,
            clientName: run.client?.name || 'Unknown',
            overallScore: run.overallScore,
            runId,
            cached: true
          });
        }
      }
    }
    
    // Import and create insights service
    const { createInsightsService, ErrorClassifier } = await import('../services/effectiveness');
    const insightsService = createInsightsService(storage);

    // Generate fresh insights
    const result = await insightsService.generateInsights(
      clientId,
      runId,
      req.user?.clientId || undefined,
      req.user?.role
    );

    // Update the run with new insights (optional - for regeneration)
    if (force) {
      await storage.updateEffectivenessRun(runId, {
        aiInsights: result.insights,
        insightsGeneratedAt: new Date()
      });
    }

    res.json(result);

  } catch (error) {
    // Import error handling after the import of services
    const { ErrorClassifier } = await import('../services/effectiveness');
    
    logger.error('Error generating effectiveness insights', { 
      error: error instanceof Error ? error.message : String(error),
      clientId: req.params.clientId,
      runId: req.params.runId
    });

    // Use error classifier to determine appropriate response
    const statusCode = ErrorClassifier.getStatusCode(error as Error);
    const userMessage = ErrorClassifier.getUserMessage(error as Error);
    
    res.status(statusCode).json({
      code: (error as any)?.code || 'INSIGHTS_GENERATION_FAILED',
      message: userMessage
    });
  }
});

export default router;