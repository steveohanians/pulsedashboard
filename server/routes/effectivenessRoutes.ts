/**
 * Website Effectiveness API Routes
 * 
 * Endpoints for website effectiveness scoring and evidence retrieval
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth';
import { storage } from '../storage';
import { EnhancedWebsiteEffectivenessScorer } from '../services/effectiveness/enhancedScorer';
import { EffectivenessConfigManager } from '../services/effectiveness/config';
import { screenshotService } from '../services/effectiveness/screenshot';
import logger from '../utils/logging/logger';
import { z } from 'zod';
import { db } from '../db';
import { effectivenessRuns } from '@shared/schema';
import { and, eq, or, desc, sql, isNotNull } from 'drizzle-orm';

const router = Router();
const enhancedScorer = new EnhancedWebsiteEffectivenessScorer();
const configManager = EffectivenessConfigManager.getInstance();

/**
 * Get tier number for a criterion
 */
function getCriterionTier(criterion: string): number {
  const tierMap: Record<string, number> = {
    'ux': 1,
    'trust': 1,
    'accessibility': 1,
    'seo': 1,
    'positioning': 2,
    'brand_story': 2,
    'ctas': 2,
    'speed': 3
  };
  return tierMap[criterion] || 1;
}

// Request/Response schemas
const refreshRequestSchema = z.object({
  force: z.boolean().optional()
});

/**
 * Score a website with timeout protection and progressive updates
 */
async function scoreWithTimeout(url: string, runId?: string, timeoutMs: number = 90000): Promise<any> {
  return Promise.race([
    enhancedScorer.scoreWebsiteProgressive(url, runId, async (status, progress, results, progressDetail) => {
      // Update database with progress (progressDetail will be added to UI via real-time updates)
      if (runId) {
        // Create enhanced progress message that includes detail info when available
        let enhancedProgress = progress;
        
        if (progressDetail && typeof progressDetail === 'object') {
          try {
            // Use the clean progress messages from enhancedScorer - no modifications needed
            
            logger.info('Enhanced progress detail received', { 
              runId, 
              originalProgress: progress,
              enhancedProgress,
              progressDetail 
            });
          } catch (error) {
            logger.warn('Failed to enhance progress message', { runId, error });
          }
        }
        
        // Save both enhanced progress text and progressDetail for serialization testing
        const progressData = {
          message: enhancedProgress,
          progressDetail: progressDetail
        };
        
        await storage.updateEffectivenessRun(runId, {
          status,
          progress: JSON.stringify(progressData)
        });
      }
      logger.info('Progressive scoring update', { url, runId, status, progress, progressDetail });
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Scoring timeout after ${timeoutMs/1000} seconds`)), timeoutMs)
    )
  ]);
}

/**
 * Score a website without progressive updates (for competitors)
 */
async function scoreWithTimeoutBasic(url: string, timeoutMs: number = 90000): Promise<any> {
  return Promise.race([
    enhancedScorer.scoreWebsite(url),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Scoring timeout after ${timeoutMs/1000} seconds`)), timeoutMs)
    )
  ]);
}

/**
 * Classify competitor error for better retry logic
 */
function classifyCompetitorError(errorMessage: string): string {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('screenshot')) return 'screenshot_failure';
  if (message.includes('network') || message.includes('fetch')) return 'network_error';
  if (message.includes('browser') || message.includes('playwright')) return 'browser_error';
  if (message.includes('50') || message.includes('server')) return 'server_error';
  if (message.includes('ai') || message.includes('openai')) return 'ai_error';
  
  return 'unknown_error';
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
    
    // Ensure we have valid data to show
    if (!criterionScores || criterionScores.length === 0) {
      logger.warn('No criterion scores found for latest run', {
        clientId,
        runId: latestRun.id,
        runStatus: latestRun.status,
        runCreatedAt: latestRun.createdAt
      });
      
      // If the run is still in progress, show it with empty scores
      if (['pending', 'initializing', 'scraping', 'analyzing', 'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing', 'generating_insights'].includes(latestRun.status)) {
        logger.info('Run is still in progress, showing with empty scores', { clientId, runId: latestRun.id });
      } else {
        // Run is complete but has no scores - this is a problem
        logger.error('Completed run has no criterion scores - data corruption?', {
          clientId,
          runId: latestRun.id,
          status: latestRun.status
        });
      }
    }
    
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

    // Aggregate progress from client run + all active competitor runs
    let overallStatus = latestRun.status;
    let overallProgress = latestRun.progress;
    
    // Get all recent competitor runs with their current status
    const activeCompetitorRuns = competitors.length > 0 ? await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          isNotNull(effectivenessRuns.competitorId),
          sql`created_at >= NOW() - INTERVAL '${sql.raw('2')} minutes'`
        ))
        .orderBy(desc(effectivenessRuns.createdAt)) : [];
    
    if (competitors.length > 0) {

      // Find the most recent active competitor run in sequential order
      // Priority: currently running > most recently created
      const runningStates = ['pending', 'initializing', 'scraping', 'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing'];
      const completedStates = ['tier1_complete', 'tier2_complete', 'generating_insights'];
      
      // First try to find a currently running competitor
      let activeRun = activeCompetitorRuns.find(run => runningStates.includes(run.status));
      
      // If no running competitors, check for recently completed ones showing progress
      if (!activeRun) {
        activeRun = activeCompetitorRuns.find(run => completedStates.includes(run.status));
      }

      if (activeRun) {
        // Show progress from the active competitor run
        const competitor = competitors.find(c => c.id === activeRun.competitorId);
        const competitorName = competitor?.label || competitor?.domain || 'competitor';
        
        overallStatus = 'analyzing';
        
        // Use existing progress if it exists, otherwise generate standard message
        if (activeRun.progress) {
          overallProgress = activeRun.progress;
        } else {
          // Simple, consistent progress messages
          switch (activeRun.status) {
            case 'pending':
            case 'initializing':
            case 'scraping':
              overallProgress = `Analyzing competitors...`;
              break;
            case 'analyzing':
            case 'tier1_analyzing':
            case 'tier1_complete':
            case 'tier2_analyzing':
            case 'tier2_complete':
            case 'tier3_analyzing':
              overallProgress = `Analyzing competitors...`;
              break;
            case 'generating_insights':
              overallProgress = `Finishing competitor analysis...`;
              break;
            default:
              overallProgress = `Analyzing competitors...`;
          }
        }
      } else if (latestRun.status === 'completed') {
        // Client is done, no active competitors, check if all competitors are done
        const allCompletedOrFailed = activeCompetitorRuns.length === 0 || 
          activeCompetitorRuns.every(run => ['completed', 'failed'].includes(run.status));
        
        if (allCompletedOrFailed) {
          // All analysis truly complete
          overallProgress = latestRun.progress || `All analysis completed - ${client.name} and ${competitors.length} competitor${competitors.length > 1 ? 's' : ''} analyzed`;
        } else {
          // Some competitors might still be pending/queued
          const pendingCount = activeCompetitorRuns.filter(run => 
            !['completed', 'failed'].includes(run.status)
          ).length;
          overallProgress = `Preparing competitor analysis... (${pendingCount} pending)`;
          overallStatus = 'analyzing';
        }
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

    // Debug logging for status transitions
    logger.info('Status aggregation result', {
      clientId,
      clientRunStatus: latestRun.status,
      overallStatus,
      overallProgress,
      activeCompetitorRunsCount: competitors.length > 0 ? activeCompetitorRuns.length : 0,
      competitorStatuses: competitors.length > 0 ? activeCompetitorRuns.map(run => ({
        competitorId: run.competitorId,
        status: run.status,
        createdAt: run.createdAt
      })) : []
    });

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

    // Add comprehensive response debugging
    logger.info('API Response Summary', {
      clientId,
      hasData: response.hasData,
      runExists: !!response.run,
      runStatus: response.run?.status,
      runProgress: response.run?.progress,
      criterionScoresCount: response.run?.criterionScores?.length || 0,
      competitorDataCount: response.competitorEffectivenessData?.length || 0,
      overallScore: response.run?.overallScore,
      hasAiInsights: !!response.run?.aiInsights
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
        // Track memory usage at start
        const startMemory = process.memoryUsage();
        logger.info('Starting effectiveness scoring', { 
          clientId, 
          runId: newRun.id,
          memoryMB: {
            rss: Math.round(startMemory.rss / 1024 / 1024),
            heapUsed: Math.round(startMemory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(startMemory.heapTotal / 1024 / 1024)
          }
        });
        
        // Clean up any stuck runs first
        await cleanupStuckRuns(clientId);

        // Update progress: Initializing (with JSON format)
        const initProgressData = {
          message: `Starting ${client.name} analysis...`,
          progressDetail: {
            phase: 'initialization',
            subPhase: 'preparing',
            progress: 5,
            completedItems: [],
            currentItem: 'Initializing analysis',
            estimatedTimeRemaining: 60
          }
        };
        
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'initializing',
          progress: JSON.stringify(initProgressData)
        });
        
        // Update progress: Scraping website (with JSON format) 
        const scrapingProgressData = {
          message: `Collecting ${client.name} data...`,
          progressDetail: {
            phase: 'data_collection',
            subPhase: 'starting',
            progress: 10,
            completedItems: [],
            currentItem: 'Starting data collection',
            estimatedTimeRemaining: 50
          }
        };
        
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'scraping',
          progress: JSON.stringify(scrapingProgressData)
        });
        
        // Score with enhanced approach (90s timeout, includes progressive updates)
        const result = await scoreWithTimeout(client.websiteUrl, newRun.id, 90000);
        
        // Enhanced scoring saves criterion scores progressively during execution

        // AI insights will be generated after all competitor analysis is complete

        // Complete the run with all results (AI insights added later)
        // Preserve JSON format for progress with embedded progressDetail
        const completionProgressMessage = `${client.name} analysis completed. Starting competitor analysis...`;
        const completionProgressData = {
          message: completionProgressMessage,
          progressDetail: {
            phase: 'competitor_analysis',
            subPhase: 'starting',
            progress: 100,
            completedItems: ['Client Analysis'],
            currentItem: 'Starting competitor analysis',
            estimatedTimeRemaining: 30,
            overallScore: result.overallScore
          }
        };
        
        await storage.updateEffectivenessRun(newRun.id, {
          status: 'completed',
          overallScore: result.overallScore.toString(),
          progress: JSON.stringify(completionProgressData),
          screenshotUrl: result.screenshotUrl,
          fullPageScreenshotUrl: result.fullPageScreenshotUrl,
          webVitals: result.webVitals,
          screenshotMethod: result.screenshotMethod || null,
          screenshotError: result.screenshotError || null,
          fullPageScreenshotError: result.fullPageScreenshotError || null
        });

        // Update client with last run time
        await storage.updateClient(clientId, {
          lastEffectivenessRun: new Date()
        });

        // Track memory usage after client completion
        const clientMemory = process.memoryUsage();
        logger.info('Client effectiveness scoring completed', {
          clientId,
          runId: newRun.id,
          overallScore: result.overallScore,
          criteriaCount: result.criterionResults.length,
          hasInsights: false, // Will be set to true after insights generation
          memoryMB: {
            rss: Math.round(clientMemory.rss / 1024 / 1024),
            heapUsed: Math.round(clientMemory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(clientMemory.heapTotal / 1024 / 1024)
          }
        });

        // Score competitors if any
        const competitors = await storage.getCompetitorsByClient(clientId);
        
        if (competitors.length > 0) {
          logger.info('Starting competitor scoring', {
            clientId,
            competitorCount: competitors.length
          });

          const failedCompetitors = [];
          
          // Wrap each competitor in comprehensive error handling
          for (let index = 0; index < competitors.length; index++) {
            const competitor = competitors[index];
            let competitorAttempts = 0;
            const maxCompetitorRetries = 3; // Increased for better reliability
            let competitorSuccess = false;
            let competitorRun;
            
            while (competitorAttempts < maxCompetitorRetries && !competitorSuccess) {
              try {
                competitorAttempts++;
                
                // Don't update client run progress during competitor analysis
                // This was causing the progress bar to go backward
                logger.info('Processing competitor', {
                  competitorIndex: index + 1,
                  totalCompetitors: competitors.length,
                  competitorName: competitor.label || competitor.domain,
                  attempt: competitorAttempts
                });

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
                  competitorSuccess = true;
                  continue;
                }

                // Add delay between competitors to avoid rate limiting and database conflicts
                if (index > 0) {
                  await new Promise(resolve => setTimeout(resolve, retryDelay)); // 3 second delay
                }
                
                // Small additional delay to prevent database race conditions
                await new Promise(resolve => setTimeout(resolve, 100));

                // Create new run for competitor
                competitorRun = await storage.createEffectivenessRun({
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
                  attempt: competitorAttempts,
                  hasScreenshotKey: !!process.env.SCREENSHOTONE_API_KEY
                });

                // Score competitor website
                let competitorUrl = competitor.domain;
                if (!competitorUrl.startsWith('http://') && !competitorUrl.startsWith('https://')) {
                  competitorUrl = `https://${competitorUrl}`;
                }

                // Score competitor with progressive timeout handling for problematic domains
                let timeoutMs = 90000; // Start with 90s
                let competitorResult;
                
                try {
                  competitorResult = await scoreWithTimeoutBasic(competitorUrl, timeoutMs);
                } catch (timeoutError) {
                  if (timeoutError instanceof Error && timeoutError.message.includes('timeout')) {
                    logger.warn(`Competitor scoring timeout, retrying with extended timeout`, {
                      clientId,
                      competitorDomain: competitor.domain,
                      initialTimeout: timeoutMs,
                      retryTimeout: 150000 // 2.5 minutes
                    });
                    
                    // Retry with longer timeout for problematic domains
                    timeoutMs = 150000;
                    competitorResult = await scoreWithTimeoutBasic(competitorUrl, timeoutMs);
                  } else {
                    throw timeoutError;
                  }
                }

                // Save competitor results atomically using transaction to prevent partial data
                try {
                  await db.transaction(async (tx) => {
                    // Save competitor criterion scores atomically
                    for (const criterionResult of competitorResult.criterionResults) {
                      await storage.createCriterionScoreInTransaction(tx, {
                        runId: competitorRun.id,
                        criterion: criterionResult.criterion,
                        score: criterionResult.score.toString(),
                        evidence: criterionResult.evidence,
                        passes: criterionResult.passes,
                        tier: getCriterionTier(criterionResult.criterion),
                        completedAt: new Date()
                      });
                    }

                    // Update competitor run with results (only after all scores saved)
                    await storage.updateEffectivenessRunInTransaction(tx, competitorRun.id, {
                      status: 'completed',
                      overallScore: competitorResult.overallScore.toString(),
                      progress: 'Competitor analysis completed',
                      progressDetail: JSON.stringify({
                        phase: 'competitor_analysis',
                        subPhase: 'completed',
                        competitorName: competitor.label || competitor.domain,
                        overallScore: competitorResult.overallScore,
                        attempt: competitorAttempts
                      }),
                      screenshotUrl: competitorResult.screenshotUrl,
                      fullPageScreenshotUrl: competitorResult.fullPageScreenshotUrl,
                      webVitals: competitorResult.webVitals,
                      screenshotMethod: competitorResult.screenshotMethod || null,
                      screenshotError: competitorResult.screenshotError || null,
                      fullPageScreenshotError: competitorResult.fullPageScreenshotError || null
                    });
                    
                    logger.info('Competitor results saved atomically', {
                      runId: competitorRun.id,
                      criterionCount: competitorResult.criterionResults.length,
                      overallScore: competitorResult.overallScore
                    });
                  });

                } catch (dbSaveError) {
                  logger.error('Failed to save competitor results to database', {
                    clientId,
                    competitorId: competitor.id,
                    competitorDomain: competitor.domain,
                    runId: competitorRun.id,
                    error: dbSaveError instanceof Error ? dbSaveError.message : String(dbSaveError)
                  });
                  
                  // Mark run as failed if database save fails
                  await storage.updateEffectivenessRun(competitorRun.id, {
                    status: 'failed',
                    progress: `Database save failed: ${dbSaveError instanceof Error ? dbSaveError.message : String(dbSaveError)}`
                  }).catch(updateError => {
                    logger.error('Failed to mark competitor run as failed after DB error', {
                      competitorId: competitor.id,
                      runId: competitorRun.id,
                      updateError: updateError instanceof Error ? updateError.message : String(updateError)
                    });
                  });
                  
                  throw dbSaveError;
                }

                logger.info('Competitor scoring completed', {
                  clientId,
                  competitorId: competitor.id,
                  competitorDomain: competitor.domain,
                  overallScore: competitorResult.overallScore,
                  attempt: competitorAttempts
                });

                competitorSuccess = true;

              } catch (competitorError) {
                logger.error('Competitor attempt failed', {
                  competitor: competitor.domain,
                  attempt: competitorAttempts,
                  error: competitorError instanceof Error ? competitorError.message : String(competitorError)
                });
                
                if (competitorAttempts >= maxCompetitorRetries) {
                  // Mark as failed but continue with other competitors
                  if (competitorRun) {
                    await storage.updateEffectivenessRun(competitorRun.id, {
                      status: 'failed',
                      progress: `Failed after ${competitorAttempts} attempts: ${competitorError instanceof Error ? competitorError.message : String(competitorError)}`,
                      progressDetail: JSON.stringify({
                        phase: 'competitor_analysis',
                        subPhase: 'failed',
                        competitorName: competitor.label || competitor.domain,
                        error: competitorError instanceof Error ? competitorError.message : String(competitorError),
                        finalAttempt: competitorAttempts
                      })
                    });
                  }
                  
                  // Add to failed list for UI
                  failedCompetitors.push({
                    id: competitor.id,
                    domain: competitor.domain,
                    label: competitor.label,
                    reason: competitorError instanceof Error ? competitorError.message : String(competitorError),
                    attempts: competitorAttempts
                  });
                } else {
                  // Calculate exponential backoff delay
                  const retryDelay = Math.min(1000 * Math.pow(2, competitorAttempts - 1), 10000); // 1s, 2s, 4s max
                  const errorType = classifyCompetitorError(competitorError instanceof Error ? competitorError.message : String(competitorError));
                  
                  logger.info(`Retrying competitor ${competitor.domain} with exponential backoff (attempt ${competitorAttempts + 1}/${maxCompetitorRetries})`, {
                    delay: retryDelay,
                    errorType,
                    clientId,
                    competitorId: competitor.id
                  });
                  await new Promise(r => setTimeout(r, 3000));
                }
              }
            }
          }

          // After all competitors, log summary
          const successfulCompetitors = competitors.length - failedCompetitors.length;
          if (failedCompetitors.length > 0) {
            logger.info('Some competitors failed, generating insights with partial data', {
              clientId,
              successful: successfulCompetitors,
              failed: failedCompetitors.length,
              failedCompetitors: failedCompetitors.map(fc => ({ domain: fc.domain, reason: fc.reason }))
            });
          }
          
          // Generate AI insights after all competitor analysis is complete
          try {
            logger.info('Generating AI insights after competitor analysis', {
              clientId,
              runId: newRun.id,
              competitorCount: competitors.length
            });

            // Generate AI insights after all competitor analysis is complete
            logger.info('Starting AI insights generation', {
              clientId,
              runId: newRun.id,
              hasOpenAI: !!process.env.OPENAI_API_KEY
            });

            try {
              const { createInsightsService } = await import('../services/effectiveness');
              const insightsService = createInsightsService(storage);
              
              try {
                // Try to generate with OpenAI
                const insights = await insightsService.generateInsights(
                  clientId, 
                  newRun.id, 
                  undefined, 
                  'Admin'
                );
                
                await storage.updateEffectivenessRun(newRun.id, {
                  aiInsights: insights.insights,
                  insightsGeneratedAt: new Date()
                });
                
                logger.info('AI insights generated successfully', {
                  clientId,
                  runId: newRun.id
                });
                
              } catch (openAIError) {
                logger.error('OpenAI insights generation failed, using fallback', {
                  clientId,
                  runId: newRun.id,
                  error: openAIError instanceof Error ? openAIError.message : String(openAIError)
                });
                
                // Generate fallback insights
                const criterionScores = await storage.getCriterionScores(newRun.id);
                const lowestScore = criterionScores.reduce((min, c) => 
                  c.score < min.score ? c : min
                );
                
                const fallbackInsights = {
                  insight: `Website effectiveness score: ${result.overallScore}/10. The primary area for improvement is ${lowestScore.criterion.replace(/_/g, ' ')} (${lowestScore.score}/10). Focus on this area for the most impact.`,
                  recommendations: [
                    `Improve ${lowestScore.criterion.replace(/_/g, ' ')} - currently your weakest area`,
                    'Review detailed evidence in the report for specific improvements',
                    'Compare with competitor scores to identify competitive gaps',
                    'Focus on quick wins in higher-scoring areas for immediate gains'
                  ],
                  confidence: 0.5,
                  key_pattern: lowestScore.score < 4 ? 'critical_issues' : 'optimization_needed',
                  fallback: true
                };
                
                await storage.updateEffectivenessRun(newRun.id, {
                  aiInsights: fallbackInsights,
                  insightsGeneratedAt: new Date()
                });
                
                logger.info('Fallback insights generated', {
                  clientId,
                  runId: newRun.id
                });
              }
              
            } catch (criticalError) {
              logger.error('Critical insights generation failure', {
                clientId,
                runId: newRun.id,
                error: criticalError instanceof Error ? criticalError.message : String(criticalError)
              });
              
              // Absolute fallback - ensure something is saved
              const minimalInsights = {
                insight: `Analysis complete with score ${result.overallScore}/10.`,
                recommendations: ['View detailed scores for improvement areas'],
                confidence: 0.3,
                key_pattern: 'analysis_complete',
                fallback: true
              };
              
              await storage.updateEffectivenessRun(newRun.id, {
                aiInsights: minimalInsights,
                insightsGeneratedAt: new Date()
              });
            }
          } catch (insightsError) {
            logger.error('Failed to generate AI insights after competitor analysis', {
              clientId,
              runId: newRun.id,
              error: insightsError instanceof Error ? insightsError.message : String(insightsError)
            });
            // Continue without insights - don't fail the entire run
          }

          // Track final memory usage
          const finalMemory = process.memoryUsage();
          
          // Update final progress with failure details
          const finalProgressMessage = failedCompetitors.length > 0 
            ? `Analysis completed - ${client.name} and ${successfulCompetitors}/${competitors.length} competitors analyzed (${failedCompetitors.length} failed)`
            : `All analysis completed - ${client.name} and ${competitors.length} competitor${competitors.length > 1 ? 's' : ''} analyzed`;
          
          await storage.updateEffectivenessRun(newRun.id, {
            progress: finalProgressMessage,
            progressDetail: JSON.stringify({
              phase: 'complete',
              subPhase: 'finished',
              totalCompetitors: competitors.length,
              successfulCompetitors,
              failedCompetitors: failedCompetitors.length,
              failedCompetitorDetails: failedCompetitors.length > 0 ? failedCompetitors : undefined
            })
          });

          logger.info('All effectiveness analysis completed', {
            clientId,
            runId: newRun.id,
            totalCompetitors: competitors.length,
            finalMemoryMB: {
              rss: Math.round(finalMemory.rss / 1024 / 1024),
              heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
              heapTotal: Math.round(finalMemory.heapTotal / 1024 / 1024)
            },
            memoryGrowth: {
              rss: Math.round((finalMemory.rss - startMemory.rss) / 1024 / 1024),
              heapUsed: Math.round((finalMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
            }
          });
        } else {
          // No competitors - generate AI insights for client-only analysis
          try {
            // Generate AI insights for client-only analysis
            logger.info('Starting AI insights generation for client-only analysis', {
              clientId,
              runId: newRun.id,
              hasOpenAI: !!process.env.OPENAI_API_KEY
            });

            try {
              const { createInsightsService } = await import('../services/effectiveness');
              const insightsService = createInsightsService(storage);
              
              try {
                // Try to generate with OpenAI
                const insights = await insightsService.generateInsights(
                  clientId, 
                  newRun.id, 
                  undefined, 
                  'Admin'
                );
                
                await storage.updateEffectivenessRun(newRun.id, {
                  aiInsights: insights.insights,
                  insightsGeneratedAt: new Date(),
                  progress: `Analysis completed - ${client.name} analyzed`
                });
                
                logger.info('AI insights generated successfully for client-only analysis', {
                  clientId,
                  runId: newRun.id
                });
                
              } catch (openAIError) {
                logger.error('OpenAI insights generation failed, using fallback for client-only analysis', {
                  clientId,
                  runId: newRun.id,
                  error: openAIError instanceof Error ? openAIError.message : String(openAIError)
                });
                
                // Generate fallback insights
                const criterionScores = await storage.getCriterionScores(newRun.id);
                const lowestScore = criterionScores.reduce((min, c) => 
                  c.score < min.score ? c : min
                );
                const highestScore = criterionScores.reduce((max, c) => 
                  c.score > max.score ? c : max
                );
                
                const fallbackInsights = {
                  insight: `Website effectiveness score: ${result.overallScore}/10. Your strongest area is ${highestScore.criterion.replace(/_/g, ' ')} (${highestScore.score}/10) and your primary improvement opportunity is ${lowestScore.criterion.replace(/_/g, ' ')} (${lowestScore.score}/10).`,
                  recommendations: [
                    `Improve ${lowestScore.criterion.replace(/_/g, ' ')} - currently your weakest area`,
                    `Maintain your strength in ${highestScore.criterion.replace(/_/g, ' ')}`,
                    'Review detailed evidence for specific improvement actions',
                    'Consider adding competitor analysis for benchmarking'
                  ],
                  confidence: 0.5,
                  key_pattern: lowestScore.score < 4 ? 'critical_issues' : 'optimization_needed',
                  fallback: true
                };
                
                await storage.updateEffectivenessRun(newRun.id, {
                  aiInsights: fallbackInsights,
                  insightsGeneratedAt: new Date(),
                  progress: `Analysis completed - ${client.name} analyzed`
                });
                
                logger.info('Fallback insights generated for client-only analysis', {
                  clientId,
                  runId: newRun.id
                });
              }
              
            } catch (criticalError) {
              logger.error('Critical insights generation failure for client-only analysis', {
                clientId,
                runId: newRun.id,
                error: criticalError instanceof Error ? criticalError.message : String(criticalError)
              });
              
              // Absolute fallback - ensure something is saved
              const minimalInsights = {
                insight: `Analysis complete with score ${result.overallScore}/10 for ${client.name}.`,
                recommendations: ['View detailed scores for improvement areas', 'Consider adding competitor analysis'],
                confidence: 0.3,
                key_pattern: 'analysis_complete',
                fallback: true
              };
              
              await storage.updateEffectivenessRun(newRun.id, {
                aiInsights: minimalInsights,
                insightsGeneratedAt: new Date(),
                progress: `Analysis completed - ${client.name} analyzed`
              });
            }
          } catch (insightsError) {
            logger.error('Failed to generate AI insights for client-only analysis', {
              clientId,
              runId: newRun.id,
              error: insightsError instanceof Error ? insightsError.message : String(insightsError)
            });
            // Continue without insights - don't fail the entire run
          }
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
        
        // Clean up browser resources to prevent zombie processes
        try {
          await screenshotService.cleanup();
          logger.info('Browser cleanup completed successfully', { runId: newRun.id });
        } catch (cleanupError) {
          logger.error('Browser cleanup failed', { 
            runId: newRun.id,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
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
 * GET /api/effectiveness/:runId/evidence/all
 * Get all evidence data for an effectiveness run (used by evidence drawer)
 */
router.get('/:runId/evidence/all', requireAuth, async (req, res) => {
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

    // Get all criterion scores for this run
    const criterionScores = await storage.getCriterionScores(runId);
    
    res.json({
      run: {
        ...run,
        criterionScores
      }
    });

  } catch (error) {
    logger.error('Failed to fetch all evidence', {
      runId: req.params.runId,
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
    const result = await insightsService.generateInsights(run.clientId, runId, req.user?.clientId, req.user?.role);

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