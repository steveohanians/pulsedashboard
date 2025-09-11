/**
 * Clean Effectiveness Service
 * 
 * Extracted from proven test patterns in test_effectiveness_complete.ts
 * Simple, reliable, and honest about async operations.
 */

import { performance } from 'perf_hooks';
import { db } from '../db.js';
import { effectivenessRuns, criterionScores } from '../../shared/schema.js';
import { storage } from '../storage.js';
import { EnhancedWebsiteEffectivenessScorer } from './effectiveness/enhancedScorer.js';
import { EffectivenessConfigManager } from './effectiveness/config.js';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { logger } from '../utils/logging/logger.js';
import { createProgressTracker, getProgressTracker, clearProgressTracker } from './effectiveness/progressTracker.js';
import { EffectivenessInsightsService } from './effectiveness/insightsService.js';
import { OpenAI } from 'openai';

interface AnalysisProgress {
  runId: string;
  status: 'pending' | 'initializing' | 'scraping' | 'analyzing' | 
          'tier1_analyzing' | 'tier1_complete' | 'tier2_analyzing' | 
          'tier2_complete' | 'tier3_analyzing' | 'completed' | 'failed';
  progress: number;
  progressDetail: string;
  currentStep?: string;
}

interface AnalysisResult {
  runId: string;
  overallScore: number;
  criterionScores: any[];
  status: 'completed' | 'failed';
}

class EffectivenessService {
  private configManager: EffectivenessConfigManager;
  private scorer: EnhancedWebsiteEffectivenessScorer;
  private runningJobs = new Map<string, AnalysisProgress>();

  constructor() {
    this.configManager = new EffectivenessConfigManager();
    this.scorer = new EnhancedWebsiteEffectivenessScorer();
  }

  /**
   * Start effectiveness analysis - Returns immediately with runId
   * Based on test pattern: create run first, then process async
   */
  async startAnalysis(clientId: string, force = false): Promise<{ runId: string }> {
    logger.info('Starting effectiveness analysis', { clientId, force });

    // Get client
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Check for existing pending runs (unless forced)
    if (!force) {
      const existingPending = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          isNull(effectivenessRuns.competitorId),
          eq(effectivenessRuns.status, 'pending')
        ))
        .limit(1);

      if (existingPending.length > 0) {
        const runId = existingPending[0].id;
        
        // ✅ CRITICAL: Only reuse pending run if it has an active job (not stale)
        if (this.runningJobs.has(runId)) {
          logger.info('Returning active pending run', { 
            clientId, 
            runId 
          });
          return { runId };
        } else {
          // Stale pending run - restart processing instead of creating new run
          logger.info('Found stale pending run, restarting processing', { 
            clientId, 
            runId 
          });
          
          // Initialize progress tracking for restarted run
          this.runningJobs.set(runId, {
            runId,
            status: 'pending',
            progress: 0,
            progressDetail: 'Analysis restarted',
            currentStep: 'Initializing'
          });

          // Restart async processing
          setImmediate(() => this.processAnalysisAsync(runId, client));
          
          return { runId };
        }
      }
    }

    // Create new run record
    const run = await storage.createEffectivenessRun({
      clientId,
      status: 'pending',
      overallScore: null
    });

    logger.info('Created new effectiveness run', { 
      clientId, 
      runId: run.id 
    });

    // Initialize progress tracking
    this.runningJobs.set(run.id, {
      runId: run.id,
      status: 'pending',
      progress: 0,
      progressDetail: 'Analysis queued',
      currentStep: 'Initializing'
    });

    // Start async processing (don't await)
    setImmediate(() => this.processAnalysisAsync(run.id, client));

    return { runId: run.id };
  }

  /**
   * Get analysis progress for a specific run
   */
  async getProgress(runId: string): Promise<AnalysisProgress | null> {
    // Check in-memory first for active jobs
    const activeJob = this.runningJobs.get(runId);
    if (activeJob) {
      return activeJob;
    }

    // Check database for completed/failed runs
    const run = await storage.getEffectivenessRun(runId);
    if (!run) {
      return null;
    }

    return {
      runId: run.id,
      status: run.status,
      progress: this.parseProgress(run.progress),
      progressDetail: run.progressDetail || run.progress || 'No progress info',
      currentStep: run.status === 'completed' ? 'Completed' : 'Processing'
    };
  }

  /**
   * Get latest completed analysis for client
   * Based on our fixed storage method
   */
  async getLatestResults(clientId: string): Promise<any> {
    return await storage.getLatestEffectivenessRun(clientId);
  }

  /**
   * Async processing method - Based on test file patterns
   * Follows the exact step structure from test_effectiveness_complete.ts
   */
  private async processAnalysisAsync(runId: string, client: any): Promise<void> {
    const tracker = createProgressTracker(client.id);
    
    try {
      logger.info('Starting async analysis processing', { runId, clientId: client.id });

      // ✅ CRITICAL: Mark run as 'processing' to prevent stale-pending reuse on reruns
      await storage.updateEffectivenessRun(runId, {
        status: 'processing',
        progress: '0%',
        progressDetail: 'Analysis started - initializing...'
      });

      // Update in-memory tracking to reflect processing state
      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = 'processing';
        job.progressDetail = 'Analysis started - initializing...';
      }

      // Get competitors and initialize tracker
      const competitors = await storage.getCompetitorsByClient(client.id);
      tracker.setTotalSteps(1, competitors.length); // Fix: use setTotalSteps instead of setCompetitorCount
      
      // Update initial progress
      await this.syncProgressFromTracker(runId, tracker);

      // Process client (main analysis)
      await this.processClient(runId, client, tracker);

      // Process competitors
      await this.processCompetitors(runId, client.id, competitors, tracker);

      // Complete analysis
      await this.completeAnalysis(runId, tracker);

    } catch (error) {
      logger.error('Analysis failed', { runId, error: error instanceof Error ? error.message : String(error) });
      
      await storage.updateEffectivenessRun(runId, {
        status: 'failed',
        progress: '0%',
        progressDetail: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`
      });

      // Update in-memory tracking
      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = 'failed';
        job.progressDetail = `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    } finally {
      // Clean up progress tracker
      clearProgressTracker();
      
      // Clean up in-memory tracking after completion/failure
      setTimeout(() => this.runningJobs.delete(runId), 60000); // Keep for 1 minute for status checks
    }
  }

  /**
   * Process client analysis - Extracted from test file
   */
  private async processClient(runId: string, client: any, tracker: any): Promise<void> {
    const url = client.websiteUrl;
    
    // Start client analysis - use client name for display
    tracker.startClient(client.name);
    await this.syncProgressFromTracker(runId, tracker);
    
    // Run Progressive Analysis with real-time criterion completion callbacks
    // Let the scorer handle its own data collection
    const finalResults = await this.scorer.scoreWebsiteProgressive(
      url, 
      runId,
      async (criterion: string) => {
        // Update tracker when each criterion completes
        tracker.completeCriterion(criterion, true);
        await this.syncProgressFromTracker(runId, tracker);
      }
    );

    // Criteria completion now handled in real-time by callback above

    // Log results structure for debugging
    logger.info('Scorer returned results', { 
      runId, 
      hasOverallScore: !!finalResults.overallScore,
      hasCriterionResults: !!finalResults.criterionResults,
      criteriaCount: finalResults.criterionResults?.length,
      hasScreenshotUrl: !!finalResults.screenshotUrl,
      hasFullPageUrl: !!finalResults.fullPageScreenshotUrl
    });

    // Save to database atomically - use finalResults for screenshot URLs since scorer handles its own data collection
    await this.saveClientResults(runId, finalResults, finalResults);
  }

  /**
   * Process competitors - Run effectiveness analysis on competitor URLs
   */
  private async processCompetitors(mainRunId: string, clientId: string, competitors: any[], tracker: any): Promise<void> {
    if (competitors.length === 0) {
      logger.info('No competitors to process', { mainRunId });
      return;
    }

    logger.info('Processing competitors', { mainRunId, count: competitors.length });
    
    // Process competitors sequentially with incremental progress updates
    let successful = 0;
    
    // Register all competitor names first for proper display
    for (let i = 0; i < competitors.length; i++) {
      tracker.setCompetitorDomain(i, competitors[i].label);
    }
    
    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      // Use competitor label for display
      tracker.startCompetitor(competitor.label, i);
      await this.syncProgressFromTracker(mainRunId, tracker);
      
      try {
        logger.info('Starting competitor analysis', { 
          mainRunId, 
          competitorId: competitor.id, 
          competitorDomain: competitor.domain,
          progress: `${i + 1}/${competitors.length}`
        });

        // Create competitor effectiveness run
        const competitorRun = await storage.createEffectivenessRun({
          clientId,
          competitorId: competitor.id,
          status: 'pending',
          overallScore: null
        });

        // Process competitor website using same analysis flow as client
        const competitorUrl = competitor.domain.startsWith('http') 
          ? competitor.domain 
          : `https://${competitor.domain}`;

        // Run progressive analysis WITH progress callback for proper tracking
        // Let the scorer handle its own data collection
        const finalResults = await this.scorer.scoreWebsiteProgressive(
          competitorUrl, 
          competitorRun.id,
          async (criterion: string) => {
            // Track competitor criterion completion
            tracker.completeCriterion(criterion, false); // false = not client
            await this.syncProgressFromTracker(mainRunId, tracker);
          }
        );

        // Save competitor results using same structure as client
        // Use finalResults for screenshots since scorer collects its own data
        await this.saveCompetitorResults(competitorRun.id, finalResults, finalResults);
        
        logger.info('Competitor analysis completed', {
          mainRunId,
          competitorId: competitor.id,
          competitorRunId: competitorRun.id,
          overallScore: finalResults.overallScore
        });

        successful++;
        
        // Mark competitor as complete and update main run progress
        tracker.completeCompetitor();
        await this.syncProgressFromTracker(mainRunId, tracker);
        
        // Also update with traditional progress for compatibility
        const progressPercent = 40 + ((i + 1) / competitors.length) * 50; // 40% to 90%
        await this.updateProgress(mainRunId, 'analyzing', progressPercent, 
          `Analyzed ${i + 1} of ${competitors.length} competitors`);

      } catch (error) {
        logger.error('Competitor analysis failed', {
          mainRunId,
          competitorId: competitor.id,
          competitorDomain: competitor.domain,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with next competitor
      }
    }
    
    logger.info('All competitor analyses completed', {
      mainRunId,
      total: competitors.length,
      successful,
      failed: competitors.length - successful
    });
  }

  /**
   * Complete analysis - Only mark as completed if client actually has full results
   */
  private async completeAnalysis(runId: string, tracker: any): Promise<void> {
    // Add mutex check - prevent double completion
    const job = this.runningJobs.get(runId);
    if (job?.status === 'completed') {
      return; // Already completed, don't update again
    }

    tracker.startInsights();
    await this.syncProgressFromTracker(runId, tracker);
    
    // Best effort insights generation - non-blocking
    try {
      // Get client ID from the run
      const run = await storage.getEffectivenessRun(runId);
      if (run?.clientId) {
        logger.info('Attempting to generate insights', { runId, clientId: run.clientId });
        
        // Set a timeout for insights generation (30 seconds max)
        const insightsPromise = this.generateInsights(run.clientId, runId);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Insights generation timeout')), 30000)
        );
        
        await Promise.race([insightsPromise, timeoutPromise]);
        logger.info('Insights generated successfully', { runId });
      }
    } catch (error) {
      // Log but don't fail the analysis - insights are best effort
      logger.warn('Insights generation failed (non-blocking)', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    tracker.complete();
    await this.syncProgressFromTracker(runId, tracker);
    // Check if client run actually completed successfully
    const run = await storage.getEffectivenessRun(runId);
    if (!run) {
      logger.error('Cannot complete analysis - run not found', { runId });
      return;
    }

    // Get criterion scores to check completeness
    const scores = await db.select().from(criterionScores).where(eq(criterionScores.runId, runId));
    const expectedCriteria = 8; // We expect 8 criteria for complete analysis
    const hasCompleteResults = scores.length >= expectedCriteria;

    if (hasCompleteResults) {
      // Truly completed - all criteria succeeded
      await storage.updateEffectivenessRun(runId, {
        status: 'completed',
        progress: '100%',
        progressDetail: 'Analysis completed successfully'
      });

      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.progressDetail = 'Analysis completed successfully';
      }

      logger.info('Analysis completed successfully', { runId, criteriaCompleted: scores.length });
    } else {
      // Partial results - mark as failed but results exist (will be handled as "partial" by frontend)
      await storage.updateEffectivenessRun(runId, {
        status: 'failed',
        progress: `${Math.round((scores.length / expectedCriteria) * 100)}%`,
        progressDetail: `Analysis completed with limitations - ${scores.length}/${expectedCriteria} criteria`
      });

      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = 'failed';
        job.progress = 95; // High progress but not complete
        job.progressDetail = `Partial results available - ${scores.length}/${expectedCriteria} criteria completed`;
      }

      logger.info('Analysis completed with partial results', { 
        runId, 
        criteriaCompleted: scores.length, 
        expectedCriteria,
        status: 'partial_success' 
      });
    }
  }

  /**
   * Save competitor results atomically - Same structure as client results
   */
  private async saveCompetitorResults(runId: string, results: any, dataResult: any): Promise<void> {
    try {
      logger.info('Starting competitor database save transaction', { 
        runId, 
        overallScore: results.overallScore, 
        criteriaCount: results.criterionResults?.length 
      });
      
      await db.transaction(async (tx) => {
        // Update run with final score
        await tx.update(effectivenessRuns)
          .set({
            overallScore: results.overallScore.toString(),
            status: 'completed',
            screenshotUrl: dataResult.screenshotUrl,
            fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
          })
          .where(eq(effectivenessRuns.id, runId));

        logger.info('Updated competitor effectiveness run with final results', { runId });

        // Save criterion scores
        for (const criterion of results.criterionResults) {
          await tx.insert(criterionScores).values({
            runId: runId,
            criterion: criterion.criterion,
            score: criterion.score.toString(),
            evidence: criterion.evidence,
            passes: criterion.passes,
            tier: criterion.tier || 1
          });
        }
        
        logger.info('Saved competitor criterion scores', { runId, count: results.criterionResults.length });
      });
      
      logger.info('Competitor database transaction completed successfully', { runId });
    } catch (error) {
      logger.error('Competitor database save transaction failed', { 
        runId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Save client results atomically - Based on test patterns
   */
  private async saveClientResults(runId: string, results: any, dataResult: any): Promise<void> {
    try {
      logger.info('Starting database save transaction', { 
        runId, 
        overallScore: results.overallScore, 
        criteriaCount: results.criterionResults?.length 
      });
      
      await db.transaction(async (tx) => {
        // Update run with final score
        await tx.update(effectivenessRuns)
          .set({
            overallScore: results.overallScore.toString(),
            // status: 'completed',  // REMOVE THIS LINE - let progress tracker handle status
            screenshotUrl: dataResult.screenshotUrl,
            fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
          })
          .where(eq(effectivenessRuns.id, runId));

        logger.info('Updated effectiveness run with final results', { runId });

        // Save criterion scores
        for (const criterion of results.criterionResults) {
          await tx.insert(criterionScores).values({
            runId: runId,
            criterion: criterion.criterion,
            score: criterion.score.toString(),
            evidence: criterion.evidence,
            passes: criterion.passes,
            tier: criterion.tier || 1
          });
        }
        
        logger.info('Saved criterion scores', { runId, count: results.criterionResults.length });
      });
      
      logger.info('Database transaction completed successfully', { runId });
    } catch (error) {
      logger.error('Database save transaction failed', { 
        runId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Update progress tracking
   */
  private async updateProgress(runId: string, status: any, progress: number, detail: string): Promise<void> {
    // Update in-memory
    const job = this.runningJobs.get(runId);
    if (job) {
      job.status = status;
      job.progress = progress;
      job.progressDetail = detail;
    }

    // Update database - SAVE BOTH progress and progressDetail
    await storage.updateEffectivenessRun(runId, {
      status,
      progress: `${progress}%`,
      progressDetail: detail  // ADD THIS LINE - save the actual progress text!
    });

    logger.info('Progress updated', { 
      runId: runId.slice(0, 8), 
      status, 
      progress, 
      detail 
    });
  }

  /**
   * Sync progress from tracker to database and in-memory tracking atomically
   */
  private async syncProgressFromTracker(runId: string, tracker: any): Promise<void> {
    const state = tracker.getState();
    
    try {
      // Update database with smooth progress - use atomic transaction to prevent race conditions
      await db.transaction(async (tx) => {
        await tx.update(effectivenessRuns)
          .set({
            status: state.currentPhase === 'completed' ? 'completed' : 'analyzing',
            progress: `${state.overallPercent}%`,  // PERCENTAGE, not message!
            progressDetail: state.message,          // Message goes in progressDetail
            updatedAt: new Date()
          })
          .where(eq(effectivenessRuns.id, runId));
      });

      // Update in-memory tracking after successful database update
      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = state.currentPhase === 'completed' ? 'completed' : 'analyzing';
        job.progress = state.overallPercent;
        job.progressDetail = state.message;
        job.currentStep = state.currentOperation;
      }

      logger.info('Progress synced from tracker', { 
        runId: runId.slice(0, 8), 
        percent: state.overallPercent,
        phase: state.currentPhase,
        message: state.message 
      });
    } catch (error) {
      logger.error('Failed to sync progress from tracker', {
        runId: runId.slice(0, 8),
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - progress sync failures shouldn't break the analysis
    }
  }

  /**
   * Parse progress percentage from string
   */
  private parseProgress(progress: string | null | undefined): number {
    if (!progress) return 0;
    const match = progress.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Generate AI insights for a completed effectiveness run
   * This is called by the API route handler
   */
  async generateInsights(clientId: string, runId: string): Promise<any> {
    try {
      logger.info('Generating insights via API', { clientId, runId });
      
      // Initialize the insights service with OpenAI
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const insightsService = new EffectivenessInsightsService({
        storage,
        openaiClient
      });
      
      // Generate insights (userId and userRole will be handled by the route)
      const result = await insightsService.generateInsights(
        clientId,
        runId,
        undefined, // userId will be passed from route context
        'Admin' // Assume admin for internal service calls
      );
      
      // Save insights to database if successful
      if (result.success && result.insights) {
        await db.update(effectivenessRuns)
          .set({
            aiInsights: result.insights,
            insightsGeneratedAt: new Date()
          })
          .where(eq(effectivenessRuns.id, runId));
        
        logger.info('Insights saved to database', { runId });
      }
      
      return result;
      
    } catch (error) {
      logger.error('Failed to generate insights', {
        clientId,
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export const effectivenessService = new EffectivenessService();
export default effectivenessService;