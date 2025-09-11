/**
 * Enhanced Website Effectiveness Scorer
 * 
 * Optimized scorer using parallel data collection and tiered execution
 * for 3x faster performance with progressive results
 */

import { OpenAI } from "openai";
import { EffectivenessResult, ScoringContext, CriterionResult } from "./types";
import { EffectivenessConfigManager } from "./config";
import { parallelDataCollector } from "./parallelDataCollector";
import { TieredCriterionExecutor, ProgressiveResults, TierResult } from "./tieredExecutor";
import { storage } from "../../storage";
import logger from "../../utils/logging/logger";
import { smartTimeoutManager } from "./smartTimeoutManager";

// Enhanced checkpoint recovery interface that includes context
interface CheckpointRecoveryResult extends Partial<EffectivenessResult> {
  context?: ScoringContext;
  dataResult?: any;
}


export class EnhancedWebsiteEffectivenessScorer {
  private openai: OpenAI;
  private configManager: EffectivenessConfigManager;
  private tieredExecutor: TieredCriterionExecutor;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.configManager = EffectivenessConfigManager.getInstance();
    this.tieredExecutor = new TieredCriterionExecutor(this.openai);
  }

  /**
   * Score a website with progressive results and real-time status updates
   * Enhanced with smart timeout management and checkpoint recovery
   */
  public async scoreWebsiteProgressive(
    websiteUrl: string,
    runId?: string,
    onCriterionComplete?: (criterion: string) => Promise<void>
  ): Promise<EffectivenessResult> {
    
    const scoringStartTime = Date.now();
    
    try {
      logger.info("Starting enhanced website effectiveness scoring", { 
        websiteUrl, 
        runId,
        targetDuration: "45-75s",
        hasTimeoutManagement: true
      });

      // ✅ CHECKPOINT RECOVERY: Check if we can continue from a previous checkpoint
      let skipToPhase: string | null = null;
      let existingResults: CheckpointRecoveryResult = {};
      let progressiveResults: ProgressiveResults;
      
      if (runId) {
        const recovery = await smartTimeoutManager.canContinueFromCheckpoint(runId);
        if (recovery.canContinue) {
          logger.info("Continuing from checkpoint", {
            runId,
            lastPhase: recovery.lastPhase,
            completedComponents: recovery.completedComponents?.length
          });
          skipToPhase = recovery.lastPhase || null;
          existingResults = recovery.partialResults || {};
          
        }
      }

      // Phase 1: Data Collection (skip if resuming from later phase)
      let context: ScoringContext;
      let config = await this.configManager.getConfig();
      
      if (skipToPhase === null || skipToPhase === 'data_collection') {

        // ✅ TIMEOUT MANAGEMENT: Start data collection with timeout
        const dataTimeoutId = runId ? await smartTimeoutManager.startComponentTimeout(
          runId,
          'data_collection',
          'dataCollection',
          // Warning handler - ask if user wants to continue or abort
          async () => {
            logger.warn("Data collection taking longer than expected", {
              websiteUrl,
              elapsed: "80% of timeout reached"
            });
            // For now, continue automatically - could add user interaction here
            return true;
          },
          // Timeout handler - cleanup and fail gracefully  
          async () => {
            logger.error("Data collection timeout - aborting run", { websiteUrl });
            // Don't update progress directly - let EffectivenessService handle it
          }
        ) : '';

        try {
          // Phase 1: Parallel Data Collection with timeout wrapper
          const dataResult = runId ? 
            await smartTimeoutManager.createTimeoutPromise(
              parallelDataCollector.collectAllData(websiteUrl, config),
              120000, // 120s timeout (increased for S3 screenshot processing)
              'data_collection'
            ) :
            await parallelDataCollector.collectAllData(websiteUrl, config);

          // Mark data collection as complete
          if (runId && dataTimeoutId) {
            await smartTimeoutManager.completeComponent(dataTimeoutId, runId, Date.now() - scoringStartTime, true);
          }

          // Build scoring context from data
          context = {
            websiteUrl,
            html: dataResult.renderedHtml || dataResult.initialHtml || '<html><body></body></html>',
            initialHtml: dataResult.initialHtml,
            screenshot: dataResult.screenshotUrl,
            fullPageScreenshot: dataResult.fullPageScreenshotUrl,
            webVitals: dataResult.webVitals,
            screenshotMethod: dataResult.screenshotMethod,
            screenshotError: dataResult.screenshotError,
            fullPageScreenshotError: dataResult.fullPageScreenshotError
          };

          // ✅ CHECKPOINT: Save after successful data collection
          if (runId) {
            await smartTimeoutManager.saveCheckpoint(runId, 'data_collection', ['html', 'screenshots', 'webvitals'], {
              context,
              dataResult
            });
          }

        } catch (error) {
          if (runId && dataTimeoutId) {
            await smartTimeoutManager.completeComponent(dataTimeoutId, runId, Date.now() - scoringStartTime, false);
          }
          throw error;
        }
      } else {
        // ✅ RECOVERY: Use existing data from checkpoint
        context = existingResults.context || {
          websiteUrl,
          html: '<html><body></body></html>',
          initialHtml: '',
          screenshot: undefined,
          fullPageScreenshot: undefined,
          webVitals: undefined
        };
      }

      // Phase 1: Data Collection - Complete
      const completedItems = [];
      if (context.html) completedItems.push('HTML');
      if (context.screenshot) completedItems.push('Screenshots');
      if (context.webVitals) completedItems.push('Web Vitals');
      

      logger.info("Data collection completed", {
        websiteUrl,
        recovered: !!skipToPhase,
        dataQuality: {
          hasInitialHtml: !!context.initialHtml,
          hasRenderedHtml: !!context.html,
          hasScreenshot: !!context.screenshot,
          hasFullPageScreenshot: !!context.fullPageScreenshot,
          hasWebVitals: !!context.webVitals
        }
      });

      // Phase 2: Tiered Criterion Execution with Progressive Updates and Timeout Management
      let finalResults: EffectivenessResult;
      let allCriterionResults: CriterionResult[] = [];
      
      // ✅ TIMEOUT MANAGEMENT: Start analysis phase with timeout
      const analysisTimeoutId = runId ? await smartTimeoutManager.startComponentTimeout(
        runId,
        'criterion_analysis',
        'tierTwoAIAnalysis',
        // Warning handler
        async () => {
          logger.warn("Analysis taking longer than expected", {
            websiteUrl,
            elapsed: "80% of AI analysis timeout reached"
          });
          return true; // Continue
        },
        // Timeout handler
        async () => {
          logger.error("Analysis timeout - saving partial results", { websiteUrl });
          // Don't update progress directly - let EffectivenessService handle it
        }
      ) : '';

      try {
        progressiveResults = runId ?
          await smartTimeoutManager.createTimeoutPromise(
            this.tieredExecutor.executeAllTiers(
              context, 
              config, 
              async (tierResult) => {
                // Notify parent when criteria complete
                if (onCriterionComplete) {
                  for (const result of tierResult.results) {
                    await onCriterionComplete(result.criterion);
                  }
                }
              }
            ),
            180000, // 3 minutes for all tiers
            'criterion_analysis'
          ) :
          await this.tieredExecutor.executeAllTiers(
            context, 
            config, 
            async (tierResult) => {
              // Notify parent when criteria complete
              if (onCriterionComplete) {
                for (const result of tierResult.results) {
                  await onCriterionComplete(result.criterion);
                }
              }
            }
          );

        // Mark analysis as complete
        if (runId && analysisTimeoutId) {
          await smartTimeoutManager.completeComponent(analysisTimeoutId, runId, Date.now() - scoringStartTime, true);
        }

      } catch (error) {
        if (runId && analysisTimeoutId) {
          await smartTimeoutManager.completeComponent(analysisTimeoutId, runId, Date.now() - scoringStartTime, false);
        }
        throw error;
      }

      // Build final results
      finalResults = {
        overallScore: progressiveResults.overallScore,
        criterionResults: progressiveResults.tiers.flatMap(t => t.results),
        screenshotUrl: context.screenshot,
        fullPageScreenshotUrl: context.fullPageScreenshot,
        webVitals: this.extractBestWebVitals(context.webVitals, progressiveResults),
        screenshotMethod: context.screenshotMethod,
        screenshotError: context.screenshotError,
        fullPageScreenshotError: context.fullPageScreenshotError
      };

      const totalDuration = Date.now() - scoringStartTime;
      
      logger.info("Enhanced effectiveness scoring completed", {
        websiteUrl,
        runId,
        totalDuration,
        overallScore: finalResults.overallScore,
        completedCriteria: finalResults.criterionResults.length,
        tierSummary: progressiveResults.tiers.map(t => ({
          tier: t.tier,
          criteria: t.results.length,
          duration: t.duration,
          score: t.partialScore
        })),
        errors: progressiveResults.errors
      });

      // ✅ FINAL CHECKPOINT: Save complete results
      if (runId) {
        await smartTimeoutManager.saveCheckpoint(runId, 'complete', [], finalResults);
      }

      return finalResults;

    } catch (error) {
      logger.error("Enhanced effectiveness scoring failed", {
        websiteUrl,
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // ✅ CLEANUP: Clean up all timeouts for this run
      if (runId) {
        smartTimeoutManager.cleanupRun(runId);
      }
      
      // Update run status to failed if runId provided
      // Don't update progress directly - let EffectivenessService handle it
      logger.error("Scoring failed", { runId, error: error instanceof Error ? error.message : String(error) });
      
      throw error;
    } finally {
      // ✅ CLEANUP: Always cleanup timeouts on exit
      if (runId) {
        smartTimeoutManager.cleanupRun(runId);
      }
    }
  }

  /**
   * Fallback method for backward compatibility
   */
  public async scoreWebsite(websiteUrl: string): Promise<EffectivenessResult> {
    return this.scoreWebsiteProgressive(websiteUrl);
  }

  /**
   * Extract best available web vitals (prefer PageSpeed API over screenshot service)
   */
  private extractBestWebVitals(screenshotWebVitals: any, progressiveResults: ProgressiveResults): any {
    // Look for speed criterion results with PageSpeed API data
    const speedResults = progressiveResults.tiers
      .flatMap(tier => tier.results)
      .find(result => result.criterion === 'speed');
    
    if (speedResults?.evidence?.details?.webVitals && speedResults.evidence.details.apiStatus === 'success') {
      return speedResults.evidence.details.webVitals;
    }
    
    // Fallback to screenshot service web vitals
    return screenshotWebVitals;
  }

  /**
   * Calculate weighted average score from all completed criteria
   */
  private calculateOverallScore(criterionResults: CriterionResult[]): number {
    if (criterionResults.length === 0) {
      return 0;
    }

    // Simple average - all criteria weighted equally
    const totalScore = criterionResults.reduce((sum, result) => sum + result.score, 0);
    const averageScore = totalScore / criterionResults.length;
    
    // Round to 1 decimal place
    return Math.round(averageScore * 10) / 10;
  }

  /**
   * Check URL validity
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      // Basic hostname validation
      if (!urlObj.hostname || urlObj.hostname.length < 3) {
        return false;
      }
      // Prevent localhost/private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') || 
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.includes('172.16.') ||
            hostname === '0.0.0.0') {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}