/**
 * Website Effectiveness Scorer
 * 
 * Main orchestrator that coordinates all 8 scoring criteria and web scraping
 */

import { OpenAI } from "openai";
import { EffectivenessResult, ScoringContext, CriterionResult } from "./types";
import { EffectivenessConfigManager } from "./config";
import { scorePositioning } from "./criteria/positioning";
import { scoreSpeed } from "./criteria/speed";
import { scoreTrust } from "./criteria/trust";
import { scoreUX } from "./criteria/ux";
import { scoreBrandStory } from "./criteria/brandStory";
import { scoreCTAs } from "./criteria/ctas";
import { scoreAccessibility } from "./criteria/accessibility";
import { scoreSEO } from "./criteria/seo";
import { screenshotService } from "./screenshot";
import logger from "../../utils/logging/logger";

export class WebsiteEffectivenessScorer {
  private openai: OpenAI;
  private configManager: EffectivenessConfigManager;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.configManager = EffectivenessConfigManager.getInstance();
  }

  /**
   * Score a website across all 8 effectiveness criteria
   */
  public async scoreWebsite(websiteUrl: string): Promise<EffectivenessResult> {
    try {
      logger.info("Starting website effectiveness scoring", { websiteUrl });

      // Load configuration
      const config = await this.configManager.getConfig();
      
      // Scrape website content
      const context = await this.scrapeWebsite(websiteUrl, config);
      
      // Score all criteria
      const criterionResults = await this.scoreAllCriteria(context, config);
      
      // Calculate overall score (weighted average)
      const overallScore = this.calculateOverallScore(criterionResults);
      
      // Extract Web Vitals from speed criterion if available
      // (Web Vitals are fetched by speed criterion from PageSpeed Insights API)
      let webVitalsToSave = context.webVitals; // Default to screenshot service vitals if any
      const speedResult = criterionResults.find(r => r.criterion === 'speed');
      if (speedResult?.evidence?.details?.webVitals) {
        // Use Web Vitals from PageSpeed Insights (more reliable than screenshot service)
        webVitalsToSave = speedResult.evidence.details.webVitals as any;
        logger.info("Using Web Vitals from PageSpeed Insights", {
          websiteUrl,
          webVitals: webVitalsToSave
        });
      }
      
      logger.info("Completed website effectiveness scoring", {
        websiteUrl,
        overallScore,
        criteriaCount: criterionResults.length,
        hasWebVitals: !!webVitalsToSave
      });

      return {
        overallScore,
        criterionResults,
        screenshotUrl: context.screenshot,
        webVitals: webVitalsToSave,
        screenshotMethod: context.screenshotMethod || null,
        screenshotError: context.screenshotError || null
      };

    } catch (error) {
      logger.error("Failed to score website effectiveness", {
        websiteUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Scrape website content and capture screenshot
   */
  private async scrapeWebsite(websiteUrl: string, config: any): Promise<ScoringContext> {
    try {
      // Validate URL format
      if (!this.isValidUrl(websiteUrl)) {
        throw new Error(`Invalid URL format: ${websiteUrl}`);
      }

      logger.info("Scraping website with Playwright", { websiteUrl });

      // Use Playwright for comprehensive scraping and screenshot capture with retries
      let screenshotResult;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          screenshotResult = await Promise.race([
            screenshotService.captureWebsiteScreenshot({
              url: websiteUrl,
              viewport: config.viewport || { width: 1440, height: 900 },
              outputDir: 'uploads/screenshots'
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Screenshot timeout after 45s')), 45000)
            )
          ]);
          break;
        } catch (screenshotError) {
          retryCount++;
          if (retryCount > maxRetries) {
            logger.warn("Screenshot capture failed after retries", {
              websiteUrl,
              retryCount,
              error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
            });
            screenshotResult = { error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError) };
          } else {
            logger.info("Retrying screenshot capture", { websiteUrl, retryCount });
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between retries
          }
        }
      }

      // Also fetch HTML with simple fetch as fallback/complement
      let html = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(websiteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            html = await response.text();
            // Basic HTML validation
            if (html.length < 100 || !html.toLowerCase().includes('<html')) {
              logger.warn("Fetched HTML appears incomplete", {
                websiteUrl,
                htmlLength: html.length,
                hasHtmlTag: html.toLowerCase().includes('<html')
              });
            }
          } else {
            logger.warn("Response is not HTML content", { websiteUrl, contentType });
          }
        } else {
          logger.warn("HTTP fetch returned non-OK status", {
            websiteUrl,
            status: response.status,
            statusText: response.statusText
          });
        }
      } catch (fetchError) {
        logger.warn("Fallback HTML fetch failed", {
          websiteUrl,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        });
      }

      // Check if we have any usable data
      const hasScreenshot = screenshotResult && !screenshotResult.error && screenshotResult.screenshotUrl;
      const hasHTML = html && html.length > 100;

      if (!hasScreenshot && !hasHTML) {
        throw new Error(`Unable to access website: ${screenshotResult?.error || 'No HTML content retrieved'}`);
      }

      // Warn if we're missing critical data
      if (!hasScreenshot) {
        logger.warn("No screenshot available, continuing with HTML-only analysis", { websiteUrl });
      }
      if (!hasHTML) {
        logger.warn("No HTML available, continuing with screenshot-only analysis", { websiteUrl });
      }

      logger.info("Successfully scraped website", {
        websiteUrl,
        htmlLength: html.length,
        hasScreenshot: !!hasScreenshot,
        hasWebVitals: !!(screenshotResult && screenshotResult.webVitals),
        dataQuality: hasScreenshot && hasHTML ? 'complete' : hasScreenshot || hasHTML ? 'partial' : 'minimal'
      });

      return {
        websiteUrl,
        html: html || '<html><body></body></html>', // Provide minimal HTML fallback
        screenshot: screenshotResult?.screenshotUrl || null,
        webVitals: screenshotResult?.webVitals || null,
        screenshotMethod: screenshotResult?.screenshotMethod || null,
        screenshotError: screenshotResult?.error || null
      };

    } catch (error) {
      logger.error("Failed to scrape website", {
        websiteUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate URL format and accessibility
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

  /**
   * Score all criteria for a website
   */
  private async scoreAllCriteria(context: ScoringContext, config: any): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];

    // Define criteria with metadata for better error handling
    const criteriaDefinitions = [
      { name: 'positioning', fn: () => scorePositioning(context, config, this.openai), requiresAI: true, requiresHTML: true },
      { name: 'ux', fn: () => scoreUX(context, config), requiresAI: false, requiresHTML: true },
      { name: 'brand_story', fn: () => scoreBrandStory(context, config, this.openai), requiresAI: true, requiresHTML: true },
      { name: 'trust', fn: () => scoreTrust(context, config), requiresAI: false, requiresHTML: true },
      { name: 'ctas', fn: () => scoreCTAs(context, config, this.openai), requiresAI: true, requiresHTML: true },
      { name: 'speed', fn: () => scoreSpeed(context, config), requiresAI: false, requiresHTML: false },
      { name: 'accessibility', fn: () => scoreAccessibility(context, config), requiresAI: false, requiresHTML: true },
      { name: 'seo', fn: () => scoreSEO(context, config), requiresAI: false, requiresHTML: true }
    ];

    // Check data availability
    const hasHTML = context.html && context.html.length > 100;
    const hasWebVitals = context.webVitals;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    logger.info("Starting criteria scoring", {
      url: context.websiteUrl,
      hasHTML,
      hasWebVitals,
      hasOpenAI,
      criteriaCount: criteriaDefinitions.length
    });

    // Score criteria with individual timeouts and retries
    const promises = criteriaDefinitions.map(async (criterion, index) => {
      const startTime = Date.now();
      let retryCount = 0;
      const maxRetries = criterion.requiresAI ? 1 : 2; // Fewer retries for AI-dependent criteria

      while (retryCount <= maxRetries) {
        try {
          // Check if we have required data for this criterion
          if (criterion.requiresHTML && !hasHTML) {
            throw new Error(`Insufficient HTML data for ${criterion.name} analysis`);
          }
          if (criterion.requiresAI && !hasOpenAI) {
            throw new Error(`OpenAI API key required for ${criterion.name} analysis`);
          }
          if (criterion.name === 'speed' && !hasWebVitals && !hasHTML) {
            throw new Error(`No performance data available for ${criterion.name} analysis`);
          }

          // Apply timeout based on criterion type
          // Speed criterion needs more time for PageSpeed API
          const timeoutMs = criterion.requiresAI ? 30000 : criterion.name === 'speed' ? 30000 : 10000;
          
          const result = await Promise.race([
            criterion.fn(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
            )
          ]);

          const duration = Date.now() - startTime;
          logger.info(`Completed criterion ${result.criterion}`, {
            url: context.websiteUrl,
            criterion: result.criterion,
            score: result.score,
            duration,
            retryCount
          });

          return result;

        } catch (error) {
          retryCount++;
          const duration = Date.now() - startTime;
          
          if (retryCount > maxRetries) {
            logger.error(`Failed to score criterion ${criterion.name} after ${retryCount-1} retries`, {
              url: context.websiteUrl,
              criterion: criterion.name,
              duration,
              error: error instanceof Error ? error.message : String(error)
            });

            // Return degraded result with contextual message
            let degradedMessage = 'Technical error prevented scoring';
            if (!hasHTML && criterion.requiresHTML) {
              degradedMessage = 'Unable to access website content for analysis';
            } else if (!hasOpenAI && criterion.requiresAI) {
              degradedMessage = 'AI analysis unavailable - configuration required';
            } else if (error instanceof Error && error.message.includes('timeout')) {
              degradedMessage = 'Analysis timed out - website may be slow to respond';
            }

            return {
              criterion: criterion.name,
              score: 0,
              evidence: {
                description: `${criterion.name.charAt(0).toUpperCase() + criterion.name.slice(1)} analysis failed`,
                details: { 
                  error: error instanceof Error ? error.message : String(error),
                  retryCount: retryCount - 1,
                  hasRequiredData: !criterion.requiresHTML || hasHTML
                },
                reasoning: degradedMessage
              },
              passes: { passed: [], failed: ['technical_error'] }
            };
          } else {
            logger.warn(`Retrying criterion ${criterion.name}`, {
              url: context.websiteUrl,
              criterion: criterion.name,
              retryCount,
              error: error instanceof Error ? error.message : String(error)
            });
            // Brief delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      // This should never be reached due to the retry logic above
      throw new Error(`Unexpected end of retry loop for ${criterion.name}`);
    });

    const completed = await Promise.allSettled(promises);
    
    completed.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const criterionName = criteriaDefinitions[index]?.name || `criterion_${index}`;
        logger.error(`Criterion scoring promise failed`, {
          url: context.websiteUrl,
          criterion: criterionName,
          error: result.reason
        });
        results.push({
          criterion: criterionName,
          score: 0,
          evidence: {
            description: 'Critical error during scoring',
            details: { reason: String(result.reason) },
            reasoning: 'Unexpected promise rejection prevented analysis'
          },
          passes: { passed: [], failed: ['promise_rejection'] }
        });
      }
    });

    // Log summary of scoring results
    const successfulScores = results.filter(r => r.score > 0).length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    
    logger.info("Completed criteria scoring", {
      url: context.websiteUrl,
      successfulCriteria: successfulScores,
      totalCriteria: results.length,
      averageScore: totalScore / results.length,
      hasPartialFailures: successfulScores < results.length
    });

    return results;
  }

  /**
   * Calculate weighted overall score from criterion results
   */
  private calculateOverallScore(criterionResults: CriterionResult[]): number {
    // Define weights for each criterion (should sum to 1.0)
    const weights = {
      positioning: 0.15,  // 15% - Most important for first impression
      ux: 0.15,          // 15% - Critical for user experience
      brand_story: 0.125, // 12.5% - Important for differentiation
      trust: 0.125,      // 12.5% - Important for conversion
      ctas: 0.125,       // 12.5% - Important for action
      speed: 0.125,      // 12.5% - Important for user experience
      accessibility: 0.075, // 7.5% - Important but less visible
      seo: 0.075         // 7.5% - Important but less immediate
    };

    let weightedSum = 0;
    let totalPossibleWeight = 0;
    let actualWeight = 0;
    const failedCriteria: string[] = [];
    const partialCriteria: string[] = [];

    for (const result of criterionResults) {
      const criterionWeight = weights[result.criterion as keyof typeof weights] || 0.125;
      totalPossibleWeight += criterionWeight;

      if (result.score > 0) {
        // Successful scoring
        weightedSum += result.score * criterionWeight;
        actualWeight += criterionWeight;
      } else {
        // Failed scoring
        failedCriteria.push(result.criterion);
        // For failed criteria, we still want to count them in the denominator
        // to avoid artificially inflating scores when some criteria fail
        actualWeight += criterionWeight; // Include the weight but with 0 score
      }

      // Check for partial scoring (low scores might indicate data quality issues)
      if (result.score > 0 && result.score < 2) {
        partialCriteria.push(result.criterion);
      }
    }

    // Calculate the final score
    let finalScore = 0;
    if (actualWeight > 0) {
      finalScore = weightedSum / actualWeight;
    }

    // Apply penalty for missing criteria to prevent inflated scores
    const missingCriteriaCount = Math.max(0, 8 - criterionResults.length);
    if (missingCriteriaCount > 0) {
      // Reduce score by 5% for each completely missing criterion
      const missingPenalty = missingCriteriaCount * 0.05;
      finalScore = finalScore * (1 - missingPenalty);
    }

    // Log scoring quality metrics
    const successfulCriteria = criterionResults.filter(r => r.score > 0).length;
    const averageScore = criterionResults.length > 0 ? 
      criterionResults.reduce((sum, r) => sum + r.score, 0) / criterionResults.length : 0;

    logger.info("Overall score calculation", {
      finalScore: Math.round(finalScore * 10) / 10,
      totalCriteria: criterionResults.length,
      successfulCriteria,
      failedCriteria: failedCriteria.length,
      averageIndividualScore: Math.round(averageScore * 10) / 10,
      weightCoverage: Math.round((actualWeight / totalPossibleWeight) * 100),
      hasPartialFailures: partialCriteria.length > 0,
      partialCriteria,
      missingCriteriaCount
    });

    // Ensure score is within valid range
    finalScore = Math.min(10, Math.max(0, finalScore));
    
    return Math.round(finalScore * 10) / 10; // Round to 1 decimal place
  }
}

