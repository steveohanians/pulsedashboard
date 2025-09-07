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
import { parallelDataCollector } from './effectiveness/parallelDataCollector.js';
import { EffectivenessConfigManager } from './effectiveness/config.js';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { logger } from '../utils/logging/logger.js';

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
        logger.info('Returning existing pending run', { 
          clientId, 
          runId: existingPending[0].id 
        });
        return { runId: existingPending[0].id };
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
    try {
      logger.info('Starting async analysis processing', { runId, clientId: client.id });

      // Update progress
      await this.updateProgress(runId, 'initializing', 5, 'Initializing analysis...');

      // Get competitors
      const competitors = await storage.getCompetitorsByClient(client.id);
      
      // Process client (main analysis)
      await this.processClient(runId, client);

      // Process competitors
      await this.processCompetitors(runId, client.id, competitors);

      // Complete analysis
      await this.completeAnalysis(runId);

    } catch (error) {
      logger.error('Analysis failed', { runId, error: error instanceof Error ? error.message : String(error) });
      
      await storage.updateEffectivenessRun(runId, {
        status: 'failed',
        progress: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`
      });

      // Update in-memory tracking
      const job = this.runningJobs.get(runId);
      if (job) {
        job.status = 'failed';
        job.progressDetail = `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    } finally {
      // Clean up in-memory tracking after completion/failure
      setTimeout(() => this.runningJobs.delete(runId), 60000); // Keep for 1 minute for status checks
    }
  }

  /**
   * Process client analysis - Extracted from test file
   */
  private async processClient(runId: string, client: any): Promise<void> {
    const url = client.websiteUrl;
    
    // Step 1: Data Collection (10% -> 25%)
    await this.updateProgress(runId, 'scraping', 10, 'Collecting website data...');
    
    const config = await this.configManager.getConfig();
    const dataResult = await parallelDataCollector.collectAllData(url, config);
    
    // Step 2: Tier 1 Analysis (25% -> 40%)
    await this.updateProgress(runId, 'tier1_analyzing', 25, 'Running fast HTML analysis...');
    
    const tier1Results = await this.scorer.runTier1Analysis(url, dataResult);
    
    await this.updateProgress(runId, 'tier1_complete', 40, 'Tier 1 analysis complete');

    // Step 3: Tier 2 AI Analysis (40% -> 70%)
    await this.updateProgress(runId, 'tier2_analyzing', 40, 'Running AI-powered analysis...');
    
    const tier2Results = await this.scorer.runTier2Analysis(url, dataResult, tier1Results);
    
    await this.updateProgress(runId, 'tier2_complete', 70, 'Tier 2 analysis complete');

    // Step 4: Tier 3 External APIs (70% -> 85%)
    await this.updateProgress(runId, 'tier3_analyzing', 70, 'Running external API analysis...');
    
    const tier3Results = await this.scorer.runTier3Analysis(url, dataResult);

    // Step 5: Final Scoring (85% -> 95%)
    await this.updateProgress(runId, 'analyzing', 85, 'Calculating final scores...');
    
    const finalResults = await this.scorer.aggregateResults({
      ...tier1Results,
      ...tier2Results, 
      ...tier3Results
    });

    // Save to database atomically
    await this.saveClientResults(runId, finalResults, dataResult);
    
    await this.updateProgress(runId, 'analyzing', 95, 'Client analysis complete');
  }

  /**
   * Process competitors - Simplified version
   */
  private async processCompetitors(runId: string, clientId: string, competitors: any[]): Promise<void> {
    if (competitors.length === 0) {
      logger.info('No competitors to process', { runId });
      return;
    }

    logger.info('Processing competitors', { runId, count: competitors.length });
    
    // For now, just log - competitor processing can be added later
    // The main client analysis is the priority
  }

  /**
   * Complete analysis
   */
  private async completeAnalysis(runId: string): Promise<void> {
    await storage.updateEffectivenessRun(runId, {
      status: 'completed',
      progress: 'Analysis completed successfully'
    });

    const job = this.runningJobs.get(runId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.progressDetail = 'Analysis completed successfully';
    }

    logger.info('Analysis completed', { runId });
  }

  /**
   * Save client results atomically - Based on test patterns
   */
  private async saveClientResults(runId: string, results: any, dataResult: any): Promise<void> {
    await db.transaction(async (tx) => {
      // Update run with final score
      await tx.update(effectivenessRuns)
        .set({
          overallScore: results.overallScore.toString(),
          status: 'analyzing', // Still processing
          screenshotUrl: dataResult.screenshotUrl,
          fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
        })
        .where(eq(effectivenessRuns.id, runId));

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
    });
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

    // Update database
    await storage.updateEffectivenessRun(runId, {
      status,
      progress: `${progress}%`
    });

    logger.info('Progress updated', { runId, status, progress, detail });
  }

  /**
   * Parse progress percentage from string
   */
  private parseProgress(progress: string | null | undefined): number {
    if (!progress) return 0;
    const match = progress.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }
}

export const effectivenessService = new EffectivenessService();
export default effectivenessService;