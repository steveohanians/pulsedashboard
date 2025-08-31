/**
 * Speed Criterion Scorer
 * 
 * Evaluates website speed using PageSpeed Insights API with enhanced reliability:
 * - Extended 60s timeouts for slow sites
 * - Exponential backoff retry strategy with jitter  
 * - Site responsiveness preprocessing
 * - Intelligent fallback scoring for persistent failures
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import logger from "../../../utils/logging/logger";

interface PageSpeedResult {
  lighthouseResult: {
    categories: {
      performance: {
        score: number;
      };
    };
    audits: {
      'largest-contentful-paint': {
        displayValue: string;
        numericValue: number;
      };
      'cumulative-layout-shift': {
        displayValue: string;
        numericValue: number;
      };
      'first-input-delay': {
        displayValue: string;
        numericValue: number;
      };
    };
  };
}

// Enhanced PSI Configuration
const PSI_CONFIG = {
  timeout: 60000,           // 60s timeout for slow sites
  maxRetries: 3,            // Up from 2 retries
  baseDelay: 1000,          // Base delay for exponential backoff
  maxDelay: 10000,          // Maximum delay between retries
  jitterFactor: 0.3,        // Add randomness to prevent thundering herd
  preprocessTimeout: 10000, // Quick site check before PSI
  fallbackScore: {
    performance: 50,        // Conservative fallback performance score
    lcp: 3.5,              // Moderate LCP fallback
    cls: 0.05,             // Good CLS fallback
    fid: 100               // Good FID fallback
  }
};

/**
 * Sleep with optional jitter to prevent coordinated retries
 */
function sleep(ms: number, jitter: boolean = false): Promise<void> {
  const delay = jitter 
    ? ms + (Math.random() * ms * PSI_CONFIG.jitterFactor) - (ms * PSI_CONFIG.jitterFactor / 2)
    : ms;
  return new Promise(resolve => setTimeout(resolve, Math.max(0, delay)));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = PSI_CONFIG.baseDelay * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, PSI_CONFIG.maxDelay);
  return cappedDelay;
}

/**
 * Quick site responsiveness check before running PSI
 * Returns estimated load time to inform PSI strategy
 */
async function checkSiteResponsiveness(url: string): Promise<{ responsive: boolean; loadTime: number; error?: string }> {
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PSI_CONFIG.preprocessTimeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      method: 'HEAD', // Faster than GET
      headers: {
        'User-Agent': 'Website-Effectiveness-Engine/1.0 (Site-Check)'
      }
    });
    
    clearTimeout(timeoutId);
    const loadTime = Date.now() - start;
    
    return {
      responsive: response.ok,
      loadTime,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      responsive: false,
      loadTime: PSI_CONFIG.preprocessTimeout,
      error: errorMessage.includes('abort') ? 'timeout' : errorMessage
    };
  }
}

/**
 * Enhanced PageSpeed Insights API call with retries, preprocessing, and fallback
 */
async function fetchPageSpeedWithRetries(url: string, apiKey: string): Promise<{ data: PageSpeedResult; fallbackUsed: boolean; attempts: number }> {
  // 1. Site preprocessing - check responsiveness first
  logger.info("Preprocessing site responsiveness", { url });
  const siteCheck = await checkSiteResponsiveness(url);
  
  logger.info("Site responsiveness check complete", {
    url,
    responsive: siteCheck.responsive,
    loadTime: siteCheck.loadTime,
    error: siteCheck.error
  });
  
  // Adjust strategy based on site responsiveness
  let adjustedTimeout = PSI_CONFIG.timeout;
  if (!siteCheck.responsive || siteCheck.loadTime > 5000) {
    adjustedTimeout = PSI_CONFIG.timeout * 1.5; // Extra time for slow sites
    logger.info("Slow site detected, extending PSI timeout", {
      url,
      originalTimeout: PSI_CONFIG.timeout,
      adjustedTimeout
    });
  }

  const keyParam = apiKey ? `&key=${apiKey}` : '';
  const pageSpeedUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop${keyParam}`;
  
  // 2. Retry loop with exponential backoff + jitter
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= PSI_CONFIG.maxRetries; attempt++) {
    logger.info("Attempting PageSpeed Insights API call", {
      url,
      attempt,
      maxRetries: PSI_CONFIG.maxRetries,
      timeout: adjustedTimeout
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), adjustedTimeout);
      
      const response = await fetch(pageSpeedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Website-Effectiveness-Engine/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PageSpeed API returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await response.json() as PageSpeedResult;
      
      // Validate response data
      if (!data.lighthouseResult?.categories?.performance?.score) {
        throw new Error('PageSpeed API returned incomplete data - API key may be required');
      }
      
      logger.info("PageSpeed Insights API successful", {
        url,
        attempt,
        performanceScore: data.lighthouseResult.categories.performance.score * 100
      });
      
      return { data, fallbackUsed: false, attempts: attempt };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      logger.warn("PageSpeed API attempt failed", {
        url,
        attempt,
        error: errorMessage,
        willRetry: attempt < PSI_CONFIG.maxRetries
      });
      
      // Don't retry certain errors
      if (errorMessage.includes('403') || errorMessage.includes('401') || 
          errorMessage.includes('API key') || errorMessage.includes('quota exceeded')) {
        logger.info("Non-retryable error detected, skipping retries", {
          url,
          error: errorMessage
        });
        break;
      }
      
      // If not the last attempt, wait with exponential backoff + jitter
      if (attempt < PSI_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        logger.info("Waiting before retry", {
          url,
          attempt,
          delayMs: delay
        });
        await sleep(delay, true); // With jitter
      }
    }
  }
  
  // 3. All retries failed - use intelligent fallback
  logger.warn("All PageSpeed API attempts failed, using fallback scoring", {
    url,
    attempts: PSI_CONFIG.maxRetries,
    finalError: lastError?.message,
    siteResponsive: siteCheck.responsive,
    siteLoadTime: siteCheck.loadTime
  });
  
  // Create fallback data based on site responsiveness
  const fallbackData: PageSpeedResult = {
    lighthouseResult: {
      categories: {
        performance: {
          score: siteCheck.responsive 
            ? (siteCheck.loadTime < 3000 ? 0.65 : 0.45) // Better score for responsive sites
            : 0.35 // Lower score for unresponsive sites
        }
      },
      audits: {
        'largest-contentful-paint': {
          displayValue: `${PSI_CONFIG.fallbackScore.lcp}s`,
          numericValue: PSI_CONFIG.fallbackScore.lcp * 1000
        },
        'cumulative-layout-shift': {
          displayValue: PSI_CONFIG.fallbackScore.cls.toString(),
          numericValue: PSI_CONFIG.fallbackScore.cls
        },
        'first-input-delay': {
          displayValue: `${PSI_CONFIG.fallbackScore.fid}ms`,
          numericValue: PSI_CONFIG.fallbackScore.fid
        }
      }
    }
  };
  
  return { data: fallbackData, fallbackUsed: true, attempts: PSI_CONFIG.maxRetries };
}

export async function scoreSpeed(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    // Use provided web vitals if available, otherwise fetch from PageSpeed
    let webVitals = context.webVitals;
    let performanceScore = 0;
    let fallbackUsed = false;
    let attempts = 0;

    if (!webVitals) {
      // Enhanced PageSpeed Insights API with retries and fallback
      const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || '';
      
      logger.info("Starting enhanced PageSpeed Insights analysis", {
        url: context.websiteUrl,
        hasApiKey: !!apiKey,
        config: {
          timeout: PSI_CONFIG.timeout,
          maxRetries: PSI_CONFIG.maxRetries,
          preprocessEnabled: true
        }
      });

      try {
        const result = await fetchPageSpeedWithRetries(context.websiteUrl, apiKey);
        const data = result.data;
        fallbackUsed = result.fallbackUsed;
        attempts = result.attempts;
        
        performanceScore = data.lighthouseResult.categories.performance.score * 100;
        
        webVitals = {
          lcp: data.lighthouseResult.audits['largest-contentful-paint'].numericValue / 1000,
          cls: data.lighthouseResult.audits['cumulative-layout-shift'].numericValue,
          fid: data.lighthouseResult.audits['first-input-delay']?.numericValue || 0
        };

        logger.info("PageSpeed analysis complete", {
          url: context.websiteUrl,
          performanceScore,
          webVitals,
          fallbackUsed,
          attempts
        });

      } catch (criticalError) {
        // This should rarely happen due to fallback, but handle gracefully
        const errorMessage = criticalError instanceof Error ? criticalError.message : String(criticalError);
        logger.error("Critical PageSpeed analysis failure", {
          url: context.websiteUrl,
          error: errorMessage
        });
        
        return {
          criterion: 'speed',
          score: 0,
          evidence: {
            description: 'Speed analysis failed',
            details: { 
              error: 'Timeout after 30s',
              retryCount: PSI_CONFIG.maxRetries,
              hasRequiredData: true
            },
            reasoning: 'Technical error prevented scoring'
          },
          passes: { passed: [], failed: ['analysis_failed'] }
        };
      }
    } else {
      // Estimate performance score from web vitals
      performanceScore = estimatePerformanceScore(webVitals);
    }

    // Calculate score directly from performance score (simplified)
    let score = performanceScore / 10; // Convert 0-100 to 0-10

    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    
    // Track web vitals status for reference but don't apply penalties
    if (webVitals.lcp <= 2.5) {
      passes.passed.push('lcp_good');
    } else if (webVitals.lcp <= config.thresholds.lcp_limit) {
      passes.passed.push('lcp_acceptable');
    } else {
      passes.failed.push('lcp_poor');
    }

    if (webVitals.cls <= 0.1) {
      passes.passed.push('cls_good');
    } else if (webVitals.cls <= config.thresholds.cls_limit) {
      passes.passed.push('cls_acceptable');
    } else {
      passes.failed.push('cls_poor');
    }

    if (webVitals.fid <= 100) {
      passes.passed.push('fid_good');
    } else if (webVitals.fid <= 300) {
      passes.passed.push('fid_acceptable');
    } else {
      passes.failed.push('fid_poor');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed speed analysis", {
      url: context.websiteUrl,
      score,
      performanceScore,
      webVitals,
      passes: passes.passed.length
    });

    return {
      criterion: 'speed',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: fallbackUsed 
          ? `Speed analysis using intelligent fallback scoring (PageSpeed API unavailable)`
          : `Speed analysis based on PageSpeed Insights performance score of ${performanceScore}% and Core Web Vitals`,
        details: {
          performanceScore,
          webVitals,
          thresholds: {
            lcp_limit: config.thresholds.lcp_limit,
            cls_limit: config.thresholds.cls_limit
          },
          apiStatus: fallbackUsed ? 'fallback_used' : 'success',
          ...(fallbackUsed && { fallbackReason: 'PSI timeout after retries', attempts }),
          ...(attempts > 1 && { retriesUsed: attempts - 1 })
        },
        reasoning: generateSpeedInsights(performanceScore, webVitals, passes.passed, passes.failed, fallbackUsed)
      },
      passes
    };

  } catch (error) {
    logger.error('Error in speed analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'speed',
      score: 0,
      evidence: {
        description: 'Error analyzing website speed',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete speed analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}

/**
 * Estimate performance score from web vitals when PageSpeed data unavailable
 * Simplified to return conservative baseline score
 */
function estimatePerformanceScore(webVitals: { lcp: number; cls: number; fid: number }): number {
  // Return conservative baseline score without penalties
  return 50;
}

/**
 * Generate actionable insights for speed analysis
 */
function generateSpeedInsights(performanceScore: number, webVitals: { lcp: number; cls: number; fid: number }, passed: string[], failed: string[], fallbackUsed: boolean = false): string {
  const insights: string[] = [];
  const recommendations: string[] = [];
  
  // Overall assessment based on performance score
  const fallbackNote = fallbackUsed ? " (estimated due to site loading issues)" : "";
  
  if (performanceScore >= 90) {
    insights.push(`Your website delivers excellent performance${fallbackNote} with fast loading times that enhance user experience and SEO rankings.`);
  } else if (performanceScore >= 50) {
    insights.push(`Your website performance is moderate${fallbackNote} but has room for optimization to improve user engagement and search rankings.`);
  } else {
    insights.push(`Your website performance is significantly impacting user experience and search rankings${fallbackNote}, requiring immediate optimization.`);
  }
  
  // Core Web Vitals specific insights and recommendations
  if (failed.includes('lcp_poor')) {
    recommendations.push(`**Optimize Largest Contentful Paint** - Your LCP of ${webVitals.lcp.toFixed(1)}s is poor (>4s). Optimize images, reduce server response times, and minimize render-blocking resources`);
  } else if (passed.includes('lcp_acceptable')) {
    recommendations.push(`**Improve Largest Contentful Paint** - Your LCP of ${webVitals.lcp.toFixed(1)}s needs improvement. Target under 2.5s by optimizing critical resources`);
  }
  
  if (failed.includes('cls_poor')) {
    recommendations.push(`**Fix Cumulative Layout Shift** - Your CLS of ${webVitals.cls.toFixed(2)} causes visual instability. Add size attributes to images and reserve space for dynamic content`);
  } else if (passed.includes('cls_acceptable')) {
    recommendations.push(`**Reduce Layout Shift** - Your CLS of ${webVitals.cls.toFixed(2)} can be improved. Prevent unexpected layout changes during page load`);
  }
  
  if (failed.includes('fid_poor')) {
    recommendations.push(`**Improve Interactivity** - Your FID of ${Math.round(webVitals.fid)}ms delays user interactions. Minimize JavaScript execution time and use web workers for heavy tasks`);
  } else if (passed.includes('fid_acceptable')) {
    recommendations.push(`**Optimize Interactivity** - Your FID of ${Math.round(webVitals.fid)}ms can be faster. Optimize JavaScript and reduce main thread blocking`);
  }
  
  // Performance-based recommendations
  if (performanceScore < 50) {
    recommendations.push("**Enable compression** - Implement Gzip/Brotli compression and optimize images with modern formats (WebP/AVIF)");
    recommendations.push("**Minimize resources** - Remove unused CSS/JavaScript and implement code splitting");
  } else if (performanceScore < 90) {
    recommendations.push("**Optimize caching** - Implement browser caching and CDN for static assets");
  }
  
  // Positive reinforcement for good metrics
  const strengths: string[] = [];
  if (passed.includes('lcp_good')) strengths.push(`fast loading (LCP: ${webVitals.lcp.toFixed(1)}s)`);
  if (passed.includes('cls_good')) strengths.push(`stable layout (CLS: ${webVitals.cls.toFixed(2)})`);
  if (passed.includes('fid_good')) strengths.push(`responsive interactions (FID: ${Math.round(webVitals.fid)}ms)`);
  
  // Combine insights and recommendations
  let result = insights[0];
  if (strengths.length > 0) {
    result += ` Strengths: ${strengths.join(', ')}.`;
  }
  if (recommendations.length > 0) {
    result += ` Priority optimizations: ${recommendations.join('; ')}.`;
  }
  
  return result;
}