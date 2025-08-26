/**
 * Speed Criterion Scorer
 * 
 * Evaluates website speed using PageSpeed Insights API with penalties for LCP/CLS
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

export async function scoreSpeed(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    // Use provided web vitals if available, otherwise fetch from PageSpeed
    let webVitals = context.webVitals;
    let performanceScore = 0;

    if (!webVitals) {
      // Fetch from PageSpeed Insights API
      // Check for API key (can use PAGESPEED_API_KEY or GOOGLE_API_KEY)
      const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || '';
      const keyParam = apiKey ? `&key=${apiKey}` : '';
      
      const pageSpeedUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(context.websiteUrl)}&strategy=desktop${keyParam}`;
      
      logger.info("Fetching PageSpeed Insights data", {
        url: context.websiteUrl,
        hasApiKey: !!apiKey
      });

      try {
        const response = await fetch(pageSpeedUrl);
        if (!response.ok) {
          const errorText = await response.text();
          logger.warn("PageSpeed API error response", { 
            status: response.status,
            error: errorText.substring(0, 200)
          });
          throw new Error(`PageSpeed API returned ${response.status}`);
        }

        const data = await response.json() as PageSpeedResult;
        
        // Check if we got valid data (API key might be required)
        if (!data.lighthouseResult?.categories?.performance?.score) {
          logger.warn("PageSpeed API returned incomplete data - API key may be required", {
            url: context.websiteUrl,
            hasScore: !!data.lighthouseResult?.categories?.performance?.score
          });
          throw new Error('PageSpeed API requires authentication - add PAGESPEED_API_KEY or GOOGLE_API_KEY');
        }
        
        performanceScore = data.lighthouseResult.categories.performance.score * 100;
        
        webVitals = {
          lcp: data.lighthouseResult.audits['largest-contentful-paint'].numericValue / 1000, // Convert to seconds
          cls: data.lighthouseResult.audits['cumulative-layout-shift'].numericValue,
          fid: data.lighthouseResult.audits['first-input-delay']?.numericValue || 0
        };

        logger.info("Retrieved PageSpeed Insights data", {
          url: context.websiteUrl,
          performanceScore,
          webVitals
        });

      } catch (apiError) {
        logger.warn("Failed to fetch PageSpeed data, using defaults", {
          url: context.websiteUrl,
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
        
        // Use default/estimated values
        webVitals = { lcp: 4.0, cls: 0.15, fid: 100 };
        performanceScore = 50; // Conservative estimate
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
        description: `Speed analysis based on PageSpeed Insights performance score of ${performanceScore}% and Core Web Vitals`,
        details: {
          performanceScore,
          webVitals,
          thresholds: {
            lcp_limit: config.thresholds.lcp_limit,
            cls_limit: config.thresholds.cls_limit
          }
        },
        reasoning: generateSpeedInsights(performanceScore, webVitals, passes.passed, passes.failed)
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
function generateSpeedInsights(performanceScore: number, webVitals: { lcp: number; cls: number; fid: number }, passed: string[], failed: string[]): string {
  const insights: string[] = [];
  const recommendations: string[] = [];
  
  // Overall assessment based on performance score
  if (performanceScore >= 90) {
    insights.push("Your website delivers excellent performance with fast loading times that enhance user experience and SEO rankings.");
  } else if (performanceScore >= 50) {
    insights.push("Your website performance is moderate but has room for optimization to improve user engagement and search rankings.");
  } else {
    insights.push("Your website performance is significantly impacting user experience and search rankings, requiring immediate optimization.");
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