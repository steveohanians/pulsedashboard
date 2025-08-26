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
      const pageSpeedUrl = `https://www.googleapis.com/pagespeed/insights/v5/runPagespeed?url=${encodeURIComponent(context.websiteUrl)}&strategy=desktop`;
      
      logger.info("Fetching PageSpeed Insights data", {
        url: context.websiteUrl
      });

      try {
        const response = await fetch(pageSpeedUrl);
        if (!response.ok) {
          throw new Error(`PageSpeed API returned ${response.status}`);
        }

        const data = await response.json() as PageSpeedResult;
        
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

    // Calculate score based on performance and web vitals
    let score = performanceScore / 10; // Convert 0-100 to 0-10

    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    
    // LCP check (Good: <2.5s, Needs improvement: 2.5-4s, Poor: >4s)
    if (webVitals.lcp <= 2.5) {
      passes.passed.push('lcp_good');
    } else if (webVitals.lcp <= config.thresholds.lcp_limit) {
      passes.passed.push('lcp_acceptable');
      score *= 0.8; // 20% penalty for acceptable but not good LCP
    } else {
      passes.failed.push('lcp_poor');
      score *= 0.5; // 50% penalty for poor LCP
    }

    // CLS check (Good: <0.1, Needs improvement: 0.1-0.25, Poor: >0.25)
    if (webVitals.cls <= 0.1) {
      passes.passed.push('cls_good');
    } else if (webVitals.cls <= config.thresholds.cls_limit) {
      passes.passed.push('cls_acceptable');
      score *= 0.9; // 10% penalty for acceptable but not good CLS
    } else {
      passes.failed.push('cls_poor');
      score *= 0.7; // 30% penalty for poor CLS
    }

    // FID check (Good: <100ms, Needs improvement: 100-300ms, Poor: >300ms)
    if (webVitals.fid <= 100) {
      passes.passed.push('fid_good');
    } else if (webVitals.fid <= 300) {
      passes.passed.push('fid_acceptable');
      score *= 0.95; // 5% penalty for acceptable FID
    } else {
      passes.failed.push('fid_poor');
      score *= 0.8; // 20% penalty for poor FID
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
        reasoning: `Score derived from PageSpeed performance (${performanceScore}%) with penalties applied for Core Web Vitals: LCP ${webVitals.lcp}s ${webVitals.lcp <= 2.5 ? '(good)' : webVitals.lcp <= 4.0 ? '(needs improvement)' : '(poor)'}, CLS ${webVitals.cls} ${webVitals.cls <= 0.1 ? '(good)' : webVitals.cls <= 0.25 ? '(needs improvement)' : '(poor)'}`
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
 */
function estimatePerformanceScore(webVitals: { lcp: number; cls: number; fid: number }): number {
  let score = 100;
  
  // LCP penalties
  if (webVitals.lcp > 4.0) {
    score -= 30;
  } else if (webVitals.lcp > 2.5) {
    score -= 15;
  }
  
  // CLS penalties
  if (webVitals.cls > 0.25) {
    score -= 25;
  } else if (webVitals.cls > 0.1) {
    score -= 10;
  }
  
  // FID penalties
  if (webVitals.fid > 300) {
    score -= 20;
  } else if (webVitals.fid > 100) {
    score -= 5;
  }
  
  return Math.max(0, Math.min(100, score));
}