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
          currentItem: 'Analysis started',
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

          // Database updates and progress tracking are handled by progressTracker via effectivenessRoutes
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