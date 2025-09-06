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

export interface ProgressCallback {
  (status: string, progress: string, results?: Partial<EffectivenessResult>, progressDetail?: any): Promise<void>;
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
    progressCallback?: ProgressCallback
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
      let existingResults: Partial<EffectivenessResult> = {};
      
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
          
          if (progressCallback) {
            await progressCallback("resuming", `Resuming from ${recovery.lastPhase} phase`, existingResults);
          }
        }
      }

      // Phase 1: Data Collection (skip if resuming from later phase)
      let context: ScoringContext;
      let config = await this.configManager.getConfig();
      
      if (skipToPhase === null || skipToPhase === 'data_collection') {
        if (progressCallback) {
          await progressCallback("scraping", "Collecting website data", undefined, {
            phase: 'data_collection',
            subPhase: 'fetching_html',
            progress: 10,
            completedItems: [],
            currentItem: 'Getting started',
            estimatedTimeRemaining: 60
          });
        }

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
            if (runId) {
              await storage.updateEffectivenessRun(runId, {
                status: 'failed',
                progress: 'Data collection timeout - website may be unresponsive'
              });
            }
          }
        ) : '';

        try {
          // Phase 1: Parallel Data Collection with timeout wrapper
          const dataResult = runId ? 
            await smartTimeoutManager.createTimeoutPromise(
              parallelDataCollector.collectAllData(websiteUrl, config),
              60000, // 60s timeout
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
      
      if (progressCallback && (skipToPhase === null || skipToPhase === 'data_collection')) {
        await progressCallback("scraping", "Data collection complete", undefined, {
          phase: 'data_collection',
          subPhase: 'complete',
          progress: 25,
          completedItems,
          currentItem: 'Analysis started',
          estimatedTimeRemaining: 45
        });
      }

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
          if (runId) {
            await storage.updateEffectivenessRun(runId, {
              status: 'failed',
              progress: 'Analysis timeout - AI processing took too long'
            });
          }
        }
      ) : '';

      try {
        const progressiveResults = runId ?
          await smartTimeoutManager.createTimeoutPromise(
            this.tieredExecutor.executeAllTiers(
              context,
              config,
              // Real-time tier completion callback with checkpoint saving
              async (tierResult: TierResult, progressive: ProgressiveResults) => {
                allCriterionResults = progressive.tiers.flatMap(t => t.results);
                
                // Build partial results for this tier
                const partialResult: EffectivenessResult = {
                  overallScore: progressive.overallScore,
                  criterionResults: allCriterionResults,
                  screenshotUrl: context.screenshot,
                  fullPageScreenshotUrl: context.fullPageScreenshot,
                  webVitals: context.webVitals,
                  screenshotMethod: context.screenshotMethod,
                  screenshotError: context.screenshotError,
                  fullPageScreenshotError: context.fullPageScreenshotError
                };

                // ✅ CHECKPOINT: Save after each tier completion
                if (runId) {
                  await smartTimeoutManager.saveCheckpoint(
                    runId, 
                    tierResult.tier === 3 ? 'tier_3' : tierResult.tier === 2 ? 'tier_2' : 'tier_1',
                    progressive.tiers.flatMap(t => t.results.map(r => r.criterion)),
                    partialResult
                  );
                }

                // Send progress update for each criterion that completed in this tier
                if (progressCallback) {
                  for (const criterionResult of tierResult.results) {
                    await progressCallback("analyzing", "", partialResult, {
                      phase: 'criterion_analysis',
                      subPhase: 'criterion_complete',
                      criterionName: criterionResult.criterion,
                      tierDetails: {
                        tier: tierResult.tier,
                        completedCriteria: progressive.completedCriteria,
                        totalCriteria: progressive.totalCriteria,
                        overallScore: progressive.overallScore
                      }
                    });
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
            // Real-time tier completion callback (no timeout management for non-runId calls)
            async (tierResult: TierResult, progressive: ProgressiveResults) => {
              allCriterionResults = progressive.tiers.flatMap(t => t.results);
              
              const partialResult: EffectivenessResult = {
                overallScore: progressive.overallScore,
                criterionResults: allCriterionResults,
                screenshotUrl: context.screenshot,
                fullPageScreenshotUrl: context.fullPageScreenshot,
                webVitals: context.webVitals,
                screenshotMethod: context.screenshotMethod,
                screenshotError: context.screenshotError,
                fullPageScreenshotError: context.fullPageScreenshotError
              };

              if (progressCallback) {
                for (const criterionResult of tierResult.results) {
                  await progressCallback("analyzing", "", partialResult, {
                    phase: 'criterion_analysis',
                    subPhase: 'criterion_complete',
                    criterionName: criterionResult.criterion,
                    tierDetails: {
                      tier: tierResult.tier,
                      completedCriteria: progressive.completedCriteria,
                      totalCriteria: progressive.totalCriteria,
                      overallScore: progressive.overallScore
                    }
                  });
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
        webVitals: this.extractBestWebVitals(dataResult.webVitals, progressiveResults),
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
      if (runId && storage) {
        try {
          await storage.updateEffectivenessRun(runId, {
            status: 'failed',
            progress: `Scoring failed: ${error instanceof Error ? error.message : String(error)}`
          });
        } catch (dbError) {
          logger.error("Failed to update run status to failed", { runId, dbError });
        }
      }
      
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