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
import type { ScreenshotResult } from "./screenshot";
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
      
      // Check if speed analysis has valid web vitals (not an error state)
      if (speedResult?.evidence?.details?.webVitals && speedResult.evidence.details.apiStatus === 'success') {
        // Use Web Vitals from PageSpeed Insights (more reliable than screenshot service)
        webVitalsToSave = speedResult.evidence.details.webVitals as any;
        logger.info("Using Web Vitals from PageSpeed Insights", {
          websiteUrl,
          webVitals: webVitalsToSave
        });
      } else if (speedResult?.evidence?.details?.apiStatus === 'failed') {
        // API failed - don't use misleading default values
        webVitalsToSave = undefined;
        logger.warn("PageSpeed API failed, Web Vitals unavailable", {
          websiteUrl,
          error: speedResult.evidence.details.error,
          message: speedResult.evidence.details.message
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
        screenshotUrl: context.screenshot || undefined,
        fullPageScreenshotUrl: context.fullPageScreenshot || undefined,
        webVitals: webVitalsToSave,
        screenshotMethod: context.screenshotMethod || undefined,
        screenshotError: context.screenshotError || undefined,
        fullPageScreenshotError: context.fullPageScreenshotError || undefined
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
      let screenshotResult: ScreenshotResult | null = null;
      let retryCount = 0;
      const maxRetries = 1; // Keep at 1

      while (retryCount <= maxRetries) {
        try {
          screenshotResult = await Promise.race([
            screenshotService.captureWebsiteScreenshot({
              url: websiteUrl,
              viewport: config.viewport || { width: 1440, height: 900 },
              outputDir: 'uploads/screenshots',
              captureFullPage: true // Enable full-page screenshot capture
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Screenshot timeout after 60s')), 60000) // 60 seconds
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
            screenshotResult = { 
              screenshotPath: '',
              screenshotUrl: '',
              error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
              screenshotMethod: 'none'
            };
          } else {
            logger.info("Retrying screenshot capture", { websiteUrl, retryCount });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 2s to 1s
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

      // Prioritize rendered HTML from Playwright over simple fetch result
      const finalHtml = screenshotResult?.renderedHtml || html || '<html><body></body></html>';
      
      logger.info("Final HTML content selected", {
        websiteUrl,
        finalHtmlLength: finalHtml.length,
        htmlSource: screenshotResult?.renderedHtml ? 'playwright-rendered' : 'simple-fetch',
        playwrightHtmlLength: screenshotResult?.renderedHtml?.length || 0,
        fetchHtmlLength: html.length,
        screenshotMethod: screenshotResult?.screenshotMethod,
        usingRenderedHtml: !!screenshotResult?.renderedHtml,
        htmlContentPreview: finalHtml.substring(0, 200) + '...'
      });

      return {
        websiteUrl,
        html: finalHtml,
        screenshot: screenshotResult?.screenshotUrl || undefined,
        fullPageScreenshot: screenshotResult?.fullPageScreenshotUrl || undefined,
        webVitals: screenshotResult?.webVitals || undefined,
        screenshotMethod: screenshotResult?.screenshotMethod || undefined,
        screenshotError: screenshotResult?.error || undefined,
        fullPageScreenshotError: screenshotResult?.fullPageError || undefined
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
      
      // Track criterion start
      logger.info(`Starting criterion scoring`, {
        url: context.websiteUrl,
        criterion: criterion.name,
        maxRetries
      });

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

            // Check if this is speed criterion with a timeout - use fallback score
            let fallbackScore = 0;
            let fallbackDescription = `${criterion.name.charAt(0).toUpperCase() + criterion.name.slice(1)} analysis failed`;
            let fallbackReasoning = 'Technical error prevented scoring';
            
            // Special handling for speed timeouts
            if (criterion.name === 'speed' && error instanceof Error && error.message.includes('Timeout')) {
              fallbackScore = 4.5;
              fallbackDescription = 'Speed analysis unavailable - using conservative baseline';
              fallbackReasoning = 'PageSpeed API timed out - assigned conservative baseline score';
            } else if (!hasHTML && criterion.requiresHTML) {
              fallbackReasoning = 'Unable to access website content for analysis';
            } else if (!hasOpenAI && criterion.requiresAI) {
              fallbackReasoning = 'AI analysis unavailable - configuration required';
            } else if (error instanceof Error && error.message.includes('timeout')) {
              fallbackReasoning = 'Analysis timed out - website may be slow to respond';
            }

            return {
              criterion: criterion.name,
              score: fallbackScore,
              evidence: {
                description: fallbackDescription,
                details: { 
                  error: error instanceof Error ? error.message : String(error),
                  retryCount: retryCount - 1,
                  hasRequiredData: !criterion.requiresHTML || hasHTML
                },
                reasoning: fallbackReasoning
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
    const weights = {
      positioning: 0.20,
      trust: 0.15,
      ctas: 0.15,
      ux: 0.125,
      brand_story: 0.125,
      speed: 0.10,
      seo: 0.10,
      accessibility: 0.075
    };

    let weightedSum = 0;
    let actualWeight = 0;

    for (const result of criterionResults) {
      const criterionWeight = weights[result.criterion as keyof typeof weights];
      
      // Skip failed API calls entirely
      if (result.evidence?.details?.apiStatus === 'failed' || 
          result.evidence?.details?.error?.includes('timeout') ||
          result.score === -1) {
        continue;
      }
      
      weightedSum += result.score * criterionWeight;
      actualWeight += criterionWeight;
    }

    return actualWeight > 0 ? (weightedSum / actualWeight) : 0;
  }
}

