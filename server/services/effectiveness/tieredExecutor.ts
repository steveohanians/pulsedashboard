/**
 * Tiered Criterion Execution System
 * 
 * Executes criteria in optimized tiers for progressive results:
 * - Tier 1: Fast HTML analysis (UX, Trust, Accessibility, SEO) - 15s
 * - Tier 2: AI-powered analysis (Positioning, Brand Story, CTAs) - 30s  
 * - Tier 3: External API analysis (Speed) - 45s
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "./types";
import { scorePositioning } from "./criteria/positioning";
import { scoreSpeed } from "./criteria/speed";
import { scoreTrust } from "./criteria/trust";
import { scoreUX } from "./criteria/ux";
import { scoreBrandStory } from "./criteria/brandStory";
import { scoreCTAs } from "./criteria/ctas";
import { scoreAccessibility } from "./criteria/accessibility";
import { scoreSEO } from "./criteria/seo";
import { OpenAI } from "openai";
import logger from "../../utils/logging/logger";
import { circuitBreaker } from "./circuitBreaker";

export interface TierDefinition {
  tier: number;
  name: string;
  criteria: CriterionDefinition[];
  timeout: number; // Per-tier timeout
  description: string;
}

interface CriterionDefinition {
  name: string;
  fn: (context: ScoringContext, config: ScoringConfig, openai?: OpenAI) => Promise<CriterionResult>;
  requiresAI: boolean;
  requiresHTML: boolean;
  requiresScreenshot: boolean;
}

export interface TierResult {
  tier: number;
  results: CriterionResult[];
  completedAt: Date;
  duration: number;
  partialScore: number; // Score for completed criteria so far
  errors: string[];
}

export interface ProgressiveResults {
  tiers: TierResult[];
  overallScore: number;
  completedCriteria: number;
  totalCriteria: number;
  isComplete: boolean;
  errors: string[];
}

export class TieredCriterionExecutor {
  private openai: OpenAI;
  
  // Define the three execution tiers
  private readonly TIER_DEFINITIONS: TierDefinition[] = [
    {
      tier: 1,
      name: "Fast HTML Analysis",
      timeout: 20000, // 20s
      description: "Quick HTML-based analysis for immediate results",
      criteria: [
        {
          name: 'ux',
          fn: scoreUX,
          requiresAI: false,
          requiresHTML: true,
          requiresScreenshot: false
        },
        {
          name: 'trust',
          fn: scoreTrust,
          requiresAI: false,
          requiresHTML: true,
          requiresScreenshot: false
        },
        {
          name: 'accessibility',
          fn: scoreAccessibility,
          requiresAI: false,
          requiresHTML: true,
          requiresScreenshot: false
        },
        {
          name: 'seo',
          fn: scoreSEO,
          requiresAI: false,
          requiresHTML: true,
          requiresScreenshot: false
        }
      ]
    },
    {
      tier: 2,
      name: "AI-Powered Analysis", 
      timeout: 30000, // 30s
      description: "Enhanced analysis using AI and vision capabilities",
      criteria: [
        {
          name: 'positioning',
          fn: scorePositioning,
          requiresAI: true,
          requiresHTML: true,
          requiresScreenshot: false // Can work without screenshot
        },
        {
          name: 'brand_story',
          fn: scoreBrandStory,
          requiresAI: true,
          requiresHTML: true,
          requiresScreenshot: false // Can work without screenshot
        },
        {
          name: 'ctas',
          fn: scoreCTAs,
          requiresAI: true,
          requiresHTML: true,
          requiresScreenshot: false // Can work without screenshot
        }
      ]
    },
    {
      tier: 3,
      name: "External API Analysis",
      timeout: 60000, // 60s - increased for better PageSpeed API reliability
      description: "Performance analysis using external services",
      criteria: [
        {
          name: 'speed',
          fn: scoreSpeed,
          requiresAI: false,
          requiresHTML: false,
          requiresScreenshot: false
        }
      ]
    }
  ];

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  /**
   * Execute all tiers progressively and return results as they complete
   */
  public async executeAllTiers(
    context: ScoringContext,
    config: ScoringConfig,
    onTierComplete?: (tierResult: TierResult, progressiveResults: ProgressiveResults) => void
  ): Promise<ProgressiveResults> {
    
    const progressiveResults: ProgressiveResults = {
      tiers: [],
      overallScore: 0,
      completedCriteria: 0,
      totalCriteria: this.getTotalCriteriaCount(),
      isComplete: false,
      errors: []
    };

    logger.info("Starting tiered criterion execution", {
      url: context.websiteUrl,
      totalTiers: this.TIER_DEFINITIONS.length,
      totalCriteria: progressiveResults.totalCriteria
    });

    // Execute each tier sequentially, but criteria within tiers in parallel
    for (const tierDef of this.TIER_DEFINITIONS) {
      try {
        const tierResult = await this.executeTier(tierDef, context, config);
        progressiveResults.tiers.push(tierResult);
        progressiveResults.completedCriteria += tierResult.results.length;
        
        // Update overall score progressively
        progressiveResults.overallScore = this.calculateProgressiveScore(progressiveResults);
        
        logger.info(`Tier ${tierDef.tier} completed`, {
          url: context.websiteUrl,
          tier: tierDef.tier,
          tierName: tierDef.name,
          completedCriteria: tierResult.results.length,
          tierDuration: tierResult.duration,
          tierScore: tierResult.partialScore,
          overallScore: progressiveResults.overallScore,
          progress: `${progressiveResults.completedCriteria}/${progressiveResults.totalCriteria}`
        });

        // Callback for real-time updates
        if (onTierComplete) {
          onTierComplete(tierResult, { ...progressiveResults });
        }

      } catch (tierError) {
        const error = `Tier ${tierDef.tier} failed: ${tierError instanceof Error ? tierError.message : String(tierError)}`;
        progressiveResults.errors.push(error);
        
        logger.error("Tier execution failed", {
          url: context.websiteUrl,
          tier: tierDef.tier,
          tierName: tierDef.name,
          error
        });

        // Continue to next tier - don't let one tier failure stop everything
        continue;
      }
    }

    progressiveResults.isComplete = true;
    
    logger.info("All tiers completed", {
      url: context.websiteUrl,
      completedCriteria: progressiveResults.completedCriteria,
      totalCriteria: progressiveResults.totalCriteria,
      overallScore: progressiveResults.overallScore,
      errors: progressiveResults.errors.length
    });

    return progressiveResults;
  }

  /**
   * Execute a single tier with parallel criterion execution
   */
  private async executeTier(
    tierDef: TierDefinition,
    context: ScoringContext,
    config: ScoringConfig
  ): Promise<TierResult> {
    
    const tierStartTime = Date.now();
    const tierResult: TierResult = {
      tier: tierDef.tier,
      results: [],
      completedAt: new Date(),
      duration: 0,
      partialScore: 0,
      errors: []
    };

    logger.info(`Starting tier ${tierDef.tier}`, {
      url: context.websiteUrl,
      tierName: tierDef.name,
      criteriaCount: tierDef.criteria.length,
      timeout: `${tierDef.timeout}ms`
    });

    // Check data availability for this tier
    const hasHTML = context.html && context.html.length > 100;
    const hasInitialHTML = context.initialHtml && context.initialHtml.length > 100;
    const hasScreenshot = context.screenshot || context.fullPageScreenshot;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    // Filter criteria that can run with available data
    const viableCriteria = tierDef.criteria.filter(criterion => {
      if (criterion.requiresHTML && !hasHTML && !hasInitialHTML) {
        tierResult.errors.push(`${criterion.name}: Insufficient HTML data`);
        return false;
      }
      if (criterion.requiresAI && !hasOpenAI) {
        tierResult.errors.push(`${criterion.name}: OpenAI API key required`);
        return false;
      }
      return true;
    });

    if (viableCriteria.length === 0) {
      throw new Error(`No viable criteria for tier ${tierDef.tier} - insufficient data`);
    }

    // Execute all viable criteria in parallel with circuit breaker protection
    const criterionPromises = viableCriteria.map(async (criterion) => {
      const criterionStartTime = Date.now();
      const serviceName = `criterion_${criterion.name}`;
      
      return circuitBreaker.execute(
        serviceName,
        async () => {
          // Apply individual timeout per criterion
          const timeoutMs = Math.max(10000, tierDef.timeout / viableCriteria.length); // Min 10s per criterion
          
          const result = await Promise.race([
            criterion.fn(context, config, this.openai),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Criterion timeout after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);

          const duration = Date.now() - criterionStartTime;
          
          logger.info(`Criterion ${criterion.name} completed`, {
            url: context.websiteUrl,
            criterion: criterion.name,
            tier: tierDef.tier,
            score: result.score,
            duration
          });

          return result;
        },
        // Fallback function for when circuit breaker is open
        async () => {
          const duration = Date.now() - criterionStartTime;
          
          logger.warn(`Using fallback for ${criterion.name} (circuit breaker open)`, {
            url: context.websiteUrl,
            criterion: criterion.name,
            tier: tierDef.tier,
            duration
          });

          // Generate intelligent fallback scores based on criterion type
          const fallbackScore = this.getFallbackScore(criterion.name);
          
          return {
            criterion: criterion.name,
            score: fallbackScore,
            evidence: {
              description: `${criterion.name} analysis using fallback scoring`,
              details: { 
                fallback: true, 
                tier: tierDef.tier,
                reason: 'Service temporarily unavailable - using conservative baseline'
              },
              reasoning: 'Conservative baseline score applied due to service unavailability'
            },
            passes: {
              passed: ['fallback_scoring'],
              failed: ['service_unavailable']
            }
          };
        }
      );
    });

    // Wait for all criteria in this tier
    const criterionResults = await Promise.all(criterionPromises);
    
    tierResult.results = criterionResults;
    tierResult.duration = Date.now() - tierStartTime;
    tierResult.completedAt = new Date();
    tierResult.partialScore = this.calculateTierScore(criterionResults);

    return tierResult;
  }

  /**
   * Calculate progressive overall score from completed tiers
   */
  private calculateProgressiveScore(progressiveResults: ProgressiveResults): number {
    if (progressiveResults.tiers.length === 0) {
      return 0;
    }

    // Weighted average of all completed criteria
    const allResults = progressiveResults.tiers.flatMap(tier => tier.results);
    const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
    
    return Math.round((totalScore / allResults.length) * 10) / 10;
  }

  /**
   * Calculate score for a single tier
   */
  private calculateTierScore(results: CriterionResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round((totalScore / results.length) * 10) / 10;
  }

  /**
   * Get total criteria count across all tiers
   */
  private getTotalCriteriaCount(): number {
    return this.TIER_DEFINITIONS.reduce((total, tier) => total + tier.criteria.length, 0);
  }

  /**
   * Get tier definitions (for external reference)
   */
  public getTierDefinitions(): TierDefinition[] {
    return [...this.TIER_DEFINITIONS];
  }

  /**
   * Generate intelligent fallback scores for failed criteria
   */
  private getFallbackScore(criterionName: string): number {
    // Conservative baseline scores based on criterion importance
    const fallbackScores: Record<string, number> = {
      // Tier 1 (HTML-based) - generally more reliable, slightly higher fallback
      'ux': 5.0,           // Average UX
      'trust': 4.0,        // Conservative trust score
      'accessibility': 3.5, // Below average accessibility (common issue)
      'seo': 4.5,          // Basic SEO compliance
      
      // Tier 2 (AI-powered) - more variable, conservative fallback  
      'positioning': 4.0,   // Average positioning
      'brand_story': 3.5,   // Conservative brand story
      'ctas': 3.0,         // Below average CTAs (common issue)
      
      // Tier 3 (External APIs) - most variable, conservative fallback
      'speed': 4.0         // Average speed performance
    };
    
    return fallbackScores[criterionName] || 3.0; // Default conservative score
  }
}