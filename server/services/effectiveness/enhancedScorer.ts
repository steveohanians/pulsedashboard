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
        targetDuration: "45-75s"
      });

      // Phase 1: Data Collection - Starting
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

      // Phase 1: Parallel Data Collection (15-45s)
      const config = await this.configManager.getConfig();
      const dataResult = await parallelDataCollector.collectAllData(websiteUrl, config);
      
      // Build scoring context
      const context: ScoringContext = {
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

      // Phase 1: Data Collection - Complete
      const completedItems = [];
      if (dataResult.initialHtml) completedItems.push('HTML');
      if (dataResult.screenshotUrl) completedItems.push('Screenshots');
      if (dataResult.webVitals) completedItems.push('Web Vitals');
      
      if (progressCallback) {
        await progressCallback("scraping", "Data collection complete", undefined, {
          phase: 'data_collection',
          subPhase: 'complete',
          progress: 25,
          completedItems,
          currentItem: 'Starting analysis',
          estimatedTimeRemaining: 45
        });
      }

      logger.info("Data collection completed", {
        websiteUrl,
        timing: dataResult.timing,
        dataQuality: {
          hasInitialHtml: !!dataResult.initialHtml,
          hasRenderedHtml: !!dataResult.renderedHtml,
          hasScreenshot: !!dataResult.screenshotUrl,
          hasFullPageScreenshot: !!dataResult.fullPageScreenshotUrl,
          hasWebVitals: !!dataResult.webVitals
        }
      });

      // Phase 2: Tiered Criterion Execution with Progressive Updates
      let finalResults: EffectivenessResult;
      let allCriterionResults: CriterionResult[] = [];
      
      const progressiveResults = await this.tieredExecutor.executeAllTiers(
        context,
        config,
        // Real-time tier completion callback
        async (tierResult: TierResult, progressive: ProgressiveResults) => {
          allCriterionResults = progressive.tiers.flatMap(t => t.results);
          
          // Build partial results for this tier
          const partialResult: EffectivenessResult = {
            overallScore: progressive.overallScore,
            criterionResults: allCriterionResults,
            screenshotUrl: context.screenshot,
            fullPageScreenshotUrl: context.fullPageScreenshot,
            webVitals: dataResult.webVitals,
            screenshotMethod: context.screenshotMethod,
            screenshotError: context.screenshotError,
            fullPageScreenshotError: context.fullPageScreenshotError
          };

          // Progress mapping for each tier
          const progressMap = {
            1: { progress: 40, message: 'Analyzing your site...', remaining: 35 },
            2: { progress: 70, message: 'Analyzing your site...', remaining: 20 },
            3: { progress: 90, message: 'Almost finished...', remaining: 5 }
          };

          // Send detailed progress update via callback
          if (progressCallback) {
            const tierProgress = progressMap[tierResult.tier as keyof typeof progressMap];
            await progressCallback("analyzing", tierProgress.message, partialResult, {
              phase: 'criterion_analysis',
              subPhase: `tier_${tierResult.tier}_complete`,
              progress: tierProgress.progress,
              completedItems: [],
              currentItem: tierResult.tier < 3 ? 'Analyzing your site...' : 'Almost finished...',
              estimatedTimeRemaining: tierProgress.remaining,
              tierDetails: {
                tier: tierResult.tier,
                completedCriteria: progressive.completedCriteria,
                totalCriteria: progressive.totalCriteria,
                overallScore: progressive.overallScore
              }
            });
          }

          // Update database with progressive status if runId provided
          if (runId && storage) {
            try {
              // Update tier completion timestamps
              const tierCompletionUpdate: any = {};
              const tierProgress = progressMap[tierResult.tier as keyof typeof progressMap];
              
              if (tierResult.tier === 1) {
                tierCompletionUpdate.tier1CompletedAt = tierResult.completedAt;
                // Embed progressDetail in progress field for serialization
                const progressMessage = `Analyzing your site...`;
                const progressData = {
                  message: progressMessage,
                  progressDetail: {
                    phase: 'criterion_analysis',
                    subPhase: 'tier_1_complete',
                    progress: tierProgress.progress,
                    completedTiers: 1,
                    totalTiers: 3,
                    overallScore: progressive.overallScore
                  }
                };
                
                await storage.updateEffectivenessRun(runId, {
                  status: 'tier1_complete',
                  progress: JSON.stringify(progressData),
                  overallScore: progressive.overallScore,
                  ...tierCompletionUpdate
                });
              } else if (tierResult.tier === 2) {
                tierCompletionUpdate.tier2CompletedAt = tierResult.completedAt;
                // Embed progressDetail in progress field for serialization
                const progressMessage = `Analyzing your site...`;
                const progressData = {
                  message: progressMessage,
                  progressDetail: {
                    phase: 'criterion_analysis',
                    subPhase: 'tier_2_complete',
                    progress: tierProgress.progress,
                    completedTiers: 2,
                    totalTiers: 3,
                    overallScore: progressive.overallScore
                  }
                };
                
                await storage.updateEffectivenessRun(runId, {
                  status: 'tier2_complete', 
                  progress: JSON.stringify(progressData),
                  overallScore: progressive.overallScore,
                  ...tierCompletionUpdate
                });
              } else if (tierResult.tier === 3) {
                tierCompletionUpdate.tier3CompletedAt = tierResult.completedAt;
                // Embed progressDetail in progress field for serialization
                const progressMessage = `Analysis complete`;
                const progressData = {
                  message: progressMessage,
                  progressDetail: {
                    phase: 'criterion_analysis',
                    subPhase: 'complete',
                    progress: 100,
                    completedTiers: 3,
                    totalTiers: 3,
                    overallScore: progressive.overallScore
                  }
                };
                
                await storage.updateEffectivenessRun(runId, {
                  status: 'completed',
                  progress: JSON.stringify(progressData),
                  overallScore: progressive.overallScore,
                  ...tierCompletionUpdate
                });
              }

              // Save criterion scores for this tier with retry logic
              const savePromises = tierResult.results.map(async (result, index) => {
                let attempts = 0;
                const maxAttempts = 3;
                
                while (attempts < maxAttempts) {
                  try {
                    await storage.createCriterionScore({
                      runId,
                      criterion: result.criterion,
                      score: result.score,
                      evidence: result.evidence,
                      passes: result.passes,
                      tier: tierResult.tier,
                      completedAt: tierResult.completedAt
                    });
                    
                    logger.info("Criterion score saved successfully", {
                      runId,
                      criterion: result.criterion,
                      tier: tierResult.tier,
                      attempt: attempts + 1
                    });
                    break; // Success, exit retry loop
                    
                  } catch (saveError) {
                    attempts++;
                    logger.warn("Criterion score save failed, retrying", {
                      runId,
                      criterion: result.criterion,
                      tier: tierResult.tier,
                      attempt: attempts,
                      maxAttempts,
                      error: saveError instanceof Error ? saveError.message : String(saveError)
                    });
                    
                    if (attempts >= maxAttempts) {
                      logger.error("Criterion score save failed after max attempts", {
                        runId,
                        criterion: result.criterion,
                        tier: tierResult.tier,
                        attempts: maxAttempts,
                        error: saveError instanceof Error ? saveError.message : String(saveError)
                      });
                      // Don't throw - continue with other scores
                    } else {
                      // Wait before retry (exponential backoff)
                      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempts - 1)));
                    }
                  }
                }
              });
              
              // Wait for all criterion score saves to complete
              const saveResults = await Promise.allSettled(savePromises);
              
              // Verify all scores were saved successfully
              const failedSaves = saveResults.filter(result => result.status === 'rejected');
              if (failedSaves.length > 0) {
                logger.error("Some criterion scores failed to save", {
                  runId,
                  tier: tierResult.tier,
                  totalScores: tierResult.results.length,
                  failedCount: failedSaves.length,
                  successCount: saveResults.length - failedSaves.length
                });
              } else {
                logger.info("All criterion scores saved successfully", {
                  runId,
                  tier: tierResult.tier,
                  totalScores: tierResult.results.length
                });
              }

            } catch (dbError) {
              logger.error("Database update failed during progressive scoring", {
                runId,
                tier: tierResult.tier,
                error: dbError instanceof Error ? dbError.message : String(dbError)
              });
            }
          }

          // Progress callback for real-time UI updates
          if (progressCallback) {
            const statusMap = {
              1: 'tier1_complete',
              2: 'tier2_complete', 
              3: 'completed'
            };
            
            const progressMap = {
              1: `Analyzing your site...`,
              2: `Analyzing your site...`,
              3: `Analysis complete`
            };

            // Include progressDetail in this callback too to maintain consistency
            const progressPercentages = { 1: 40, 2: 70, 3: 100 };
            await progressCallback(
              statusMap[tierResult.tier as keyof typeof statusMap] || 'analyzing',
              progressMap[tierResult.tier as keyof typeof progressMap] || 'Processing...',
              partialResult,
              {
                phase: 'criterion_analysis',
                subPhase: `tier_${tierResult.tier}_complete`,
                progress: progressPercentages[tierResult.tier as keyof typeof progressPercentages] || 50,
                completedItems: [],
                currentItem: tierResult.tier < 3 ? 'Analyzing your site...' : 'Finalizing results',
                estimatedTimeRemaining: tierResult.tier < 3 ? (3 - tierResult.tier) * 15 : 5,
                tierDetails: {
                  tier: tierResult.tier,
                  completedCriteria: progressive.completedCriteria,
                  totalCriteria: progressive.totalCriteria,
                  overallScore: progressive.overallScore
                }
              }
            );
          }
        }
      );

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

      return finalResults;

    } catch (error) {
      logger.error("Enhanced effectiveness scoring failed", {
        websiteUrl,
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      
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