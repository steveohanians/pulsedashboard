/**
 * EffectivenessPromptBuilder
 * 
 * Centralized prompt management for effectiveness insights generation.
 * Provides dynamic prompt building, criterion mappings, and pattern classification.
 */

import type { CriterionResult } from './types';

export interface PromptData {
  websiteUrl: string;
  overallScore: number;
  criterionScores: CriterionResult[];
  clientName?: string;
  industryType?: string;
  businessGoals?: string;
}

export interface PromptContent {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ScoreContext {
  range: 'poor' | 'average' | 'good' | 'excellent';
  focus: string;
  urgency: string;
}

export interface PriorityIssue {
  criterion: string;
  score: number;
  impact: number;
  easeOfImplementation: number;
  priority: number;
}

/**
 * Advanced prompt builder for effectiveness insights
 */
export class EffectivenessPromptBuilder {
  
  /**
   * Mapping of failed checks to specific recommendations
   */
  static readonly CRITERION_MAPPINGS: Record<string, string> = {
    no_target_audience: "Specify your target customer in the headline",
    no_specific_value: "Add concrete benefits or outcomes to hero text",
    no_third_party_proof: "Include client logos or testimonials",
    lcp_poor: "Reduce page load time to under 2.5 seconds",
    few_above_fold_ctas: "Make primary action more prominent",
    no_proof_elements: "Add case studies or success metrics",
    no_recent_proof: "Update testimonials and case studies with recent examples",
    poor_mobile_ux: "Improve mobile user experience and responsiveness",
    missing_alt_text: "Add descriptive alt text to all images",
    poor_contrast: "Improve color contrast for better accessibility",
    no_clear_value_prop: "Create a clearer value proposition statement",
    weak_cta_copy: "Strengthen call-to-action button text",
    missing_urgency: "Add urgency or scarcity elements to encourage action",
    no_social_proof: "Add customer testimonials or reviews",
    poor_navigation: "Simplify and clarify website navigation",
    missing_contact_info: "Make contact information more prominent"
  };

  /**
   * Mapping of technical check names to human-readable descriptions
   */
  static readonly CHECK_DESCRIPTIONS: Record<string, string> = {
    no_target_audience: "missing clear target audience definition",
    no_specific_value: "lacking specific value propositions",
    no_third_party_proof: "absence of third-party validation",
    lcp_poor: "slow page loading speed",
    few_above_fold_ctas: "limited call-to-action visibility",
    no_proof_elements: "missing proof elements",
    no_recent_proof: "outdated testimonials or case studies",
    poor_mobile_ux: "suboptimal mobile experience",
    missing_alt_text: "accessibility issues with images",
    poor_contrast: "poor color contrast",
    no_clear_value_prop: "unclear value proposition",
    weak_cta_copy: "weak call-to-action messaging",
    missing_urgency: "lack of urgency elements",
    no_social_proof: "insufficient social proof",
    poor_navigation: "confusing navigation structure",
    missing_contact_info: "hard-to-find contact information",
    no_clear_approach: "unclear service approach or methodology",
    brevity_check: "overly verbose content that needs simplification",
    no_sitemap: "missing XML sitemap",
    no_structured_data: "absence of structured data markup"
  };

  /**
   * Valid key patterns for classification
   */
  static readonly KEY_PATTERNS = [
    'messaging_unclear',
    'credibility_gap', 
    'technical_issues',
    'conversion_barriers',
    'strong_foundation'
  ] as const;

  /**
   * Industry-specific context for better insights
   */
  static readonly INDUSTRY_CONTEXTS: Record<string, string> = {
    'saas': 'SaaS businesses need clear trial/demo CTAs and feature benefits',
    'ecommerce': 'E-commerce sites require trust signals and streamlined checkout',
    'consulting': 'Consulting firms need credibility markers and clear expertise positioning',
    'agency': 'Agencies benefit from portfolio showcases and client testimonials',
    'healthcare': 'Healthcare requires compliance considerations and trust elements',
    'finance': 'Financial services need security reassurance and clear value propositions',
    'education': 'Educational platforms should emphasize outcomes and accessibility',
    'default': 'Focus on clear value communication and user experience optimization'
  };

  /**
   * Builds comprehensive insights prompt with dynamic context
   */
  buildInsightsPrompt(data: PromptData): PromptContent {
    const scoreContext = this.getScoreContext(data.overallScore);
    const priorityMatrix = this.buildPriorityMatrix(data.criterionScores);
    const criteriaDetails = this.formatCriteriaDetails(data.criterionScores);
    const failedChecks = this.extractFailedChecks(data.criterionScores);
    const industryContext = this.getIndustryContext(data.industryType);

    return {
      system: this.buildSystemPrompt(),
      user: this.buildUserPrompt({
        ...data,
        scoreContext,
        priorityMatrix,
        criteriaDetails,
        failedChecks,
        industryContext
      }),
      temperature: this.getOptimalTemperature(data.overallScore),
      maxTokens: 1000
    };
  }

  /**
   * Builds the system prompt for AI context
   */
  private buildSystemPrompt(): string {
    return `You are an expert website effectiveness analyst with deep expertise in conversion optimization, user experience, and digital marketing strategy.

Your role is to:
1. Analyze website performance data with precision
2. Identify the most impactful improvement opportunities
3. Provide specific, actionable recommendations based on actual evidence
4. Consider business context and industry best practices
5. Prioritize quick wins alongside strategic improvements

Always base your insights on the provided data rather than generic advice. Focus on authentic, evidence-driven recommendations that address the specific gaps identified in the scoring system.

Return only valid JSON in the specified format.`;
  }

  /**
   * Builds the detailed user prompt with all context
   */
  private buildUserPrompt(data: {
    websiteUrl: string;
    overallScore: number;
    clientName?: string;
    scoreContext: ScoreContext;
    priorityMatrix: PriorityIssue[];
    criteriaDetails: string;
    failedChecks: string[];
    industryContext: string;
  }): string {
    const clientContext = data.clientName ? `for ${data.clientName}` : '';
    const priorityIssues = data.priorityMatrix.slice(0, 3)
      .map(issue => `${issue.criterion}: ${issue.score}/10 (Priority: ${issue.priority.toFixed(1)})`)
      .join('\n');
    
    // Convert failed checks to human-readable descriptions
    const readableFailedChecks = data.failedChecks
      .map(check => EffectivenessPromptBuilder.CHECK_DESCRIPTIONS[check] || check)
      .join(', ');

    return `Analyze website effectiveness data and generate personalized insights ${clientContext}.

Website: ${data.websiteUrl}
Overall Score: ${data.overallScore}/10 (${data.scoreContext.range})

Performance Analysis:
${data.criteriaDetails}

Top Priority Issues:
${priorityIssues}

Identified Issues: ${readableFailedChecks}

Industry Context: ${data.industryContext}

Analysis Focus: ${data.scoreContext.focus}
Urgency Level: ${data.scoreContext.urgency}

TASK: Generate insights that:
1. Identify the PRIMARY PATTERN in performance data (what's the main issue?)
2. Explain WHY this pattern exists based on specific evidence from the data
3. Provide 3-4 SPECIFIC, ACTIONABLE recommendations targeting the highest-impact gaps
4. Consider the business context and industry best practices

RESPONSE FORMAT (JSON only):
{
  "insight": "One concise paragraph (2-3 sentences max). Start with 'With a score of X/10', identify the primary gap and its impact. Use **semibold** for key metrics, important terms, and critical findings. Never use technical variable names - use clear, contextual English instead.",
  "recommendations": [
    "Direct, specific action without explanatory clauses. Use **semibold** for key action items.",
    "Second priority action, concise and actionable", 
    "Third action, focused and clear",
    "Optional fourth action if critical"
  ],
  "confidence": 0.9,
  "key_pattern": "messaging_unclear | credibility_gap | technical_issues | conversion_barriers | strong_foundation"
}

Recommendation Guidelines:
- Keep each recommendation to ONE sentence
- Start with an action verb
- Be specific about what to change
- Use **semibold** for emphasis on critical elements
- NO explanatory phrases like "This will address..." or "to improve..."
- Focus on the WHAT, not the WHY

Content Guidelines:
- Use clear, professional language
- Replace technical check names with human-readable descriptions
- Emphasize key points with **semibold** formatting
- Keep insights concise (2-3 sentences maximum)
- Avoid jargon and technical terminology

Score-Based Approach:
- 0-3: Focus on fundamental fixes and credibility
- 4-6: Balance quick wins with strategic improvements  
- 7-8: Fine-tune for optimization and conversion
- 9-10: Advanced optimization and competitive advantage

Return only valid JSON.`;
  }

  /**
   * Gets score context for dynamic prompt adjustment
   */
  private getScoreContext(overallScore: number): ScoreContext {
    if (overallScore <= 3) {
      return {
        range: 'poor',
        focus: 'fundamental credibility and usability issues',
        urgency: 'critical - immediate action required'
      };
    } else if (overallScore <= 6) {
      return {
        range: 'average',
        focus: 'key user experience and conversion gaps',
        urgency: 'high priority - significant improvement opportunity'
      };
    } else if (overallScore <= 8) {
      return {
        range: 'good',
        focus: 'optimization and fine-tuning opportunities',
        urgency: 'moderate - incremental improvements'
      };
    } else {
      return {
        range: 'excellent',
        focus: 'advanced optimization and competitive advantages',
        urgency: 'low - minor enhancements'
      };
    }
  }

  /**
   * Builds priority matrix sorting issues by impact and implementation ease
   */
  private buildPriorityMatrix(criterionScores: CriterionResult[]): PriorityIssue[] {
    return criterionScores
      .filter(score => score.score < 7) // Focus on problematic areas
      .map(score => {
        const impact = this.calculateImpact(score);
        const easeOfImplementation = this.calculateEaseOfImplementation(score);
        const priority = impact * easeOfImplementation; // Higher is better

        return {
          criterion: score.criterion,
          score: score.score,
          impact,
          easeOfImplementation,
          priority
        };
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority descending
  }

  /**
   * Calculates business impact score for a criterion
   */
  private calculateImpact(criterion: CriterionResult): number {
    // Impact weights based on business influence
    const impactWeights: Record<string, number> = {
      positioning: 0.9,    // High impact on conversions
      ctas: 0.85,          // Direct conversion impact  
      trust: 0.8,          // Critical for conversions
      speed: 0.75,         // SEO and UX impact
      ux: 0.7,            // User experience impact
      brand_story: 0.65,   // Brand perception impact
      seo: 0.6,           // Long-term traffic impact
      accessibility: 0.55  // Compliance and reach impact
    };

    const baseImpact = impactWeights[criterion.criterion] || 0.5;
    
    // Adjust impact based on how far below ideal the score is
    const scorePenalty = (10 - criterion.score) / 10;
    
    return baseImpact * (1 + scorePenalty);
  }

  /**
   * Calculates ease of implementation for a criterion
   */
  private calculateEaseOfImplementation(criterion: CriterionResult): number {
    // Implementation ease weights (higher = easier to implement)
    const easeWeights: Record<string, number> = {
      ctas: 0.9,           // Easy to change button text/placement
      positioning: 0.8,     // Content changes, relatively easy
      trust: 0.75,         // Adding testimonials/logos is moderate
      brand_story: 0.7,     // Content development takes time
      ux: 0.6,             // Design changes, moderate complexity
      seo: 0.5,            // Technical changes required
      accessibility: 0.4,   // May require development work
      speed: 0.3           // Often requires technical optimization
    };

    return easeWeights[criterion.criterion] || 0.5;
  }

  /**
   * Formats criteria details for prompt inclusion
   */
  private formatCriteriaDetails(criterionScores: CriterionResult[]): string {
    return criterionScores
      .map(c => `${c.criterion.replace(/_/g, ' ')}: ${c.score}/10`)
      .join('\n');
  }

  /**
   * Extracts all failed checks from criterion scores
   */
  private extractFailedChecks(criterionScores: CriterionResult[]): string[] {
    return criterionScores
      .flatMap(criterion => criterion.passes?.failed || [])
      .filter(Boolean);
  }

  /**
   * Gets industry-specific context
   */
  private getIndustryContext(industryType?: string): string {
    return EffectivenessPromptBuilder.INDUSTRY_CONTEXTS[industryType || 'default'] || 
           EffectivenessPromptBuilder.INDUSTRY_CONTEXTS.default;
  }

  /**
   * Gets optimal temperature based on score range
   */
  private getOptimalTemperature(overallScore: number): number {
    // Lower scores need more deterministic responses
    // Higher scores can have slightly more creative analysis
    if (overallScore <= 4) {
      return 0.0; // Very deterministic for critical issues
    } else if (overallScore <= 7) {
      return 0.1; // Mostly deterministic
    } else {
      return 0.2; // Slightly more creative for optimization
    }
  }

  /**
   * Validates key pattern against allowed values
   */
  static validateKeyPattern(pattern: string): boolean {
    return EffectivenessPromptBuilder.KEY_PATTERNS.includes(pattern as any);
  }

  /**
   * Gets recommendation for a specific failed check
   */
  static getRecommendationForCheck(failedCheck: string): string | null {
    return EffectivenessPromptBuilder.CRITERION_MAPPINGS[failedCheck] || null;
  }

  /**
   * Builds a simple prompt for basic use cases
   */
  buildSimplePrompt(
    websiteUrl: string,
    overallScore: number,
    criteriaDetails: string,
    failedChecks: string[]
  ): string {
    return `Analyze website effectiveness:

Website: ${websiteUrl}
Score: ${overallScore}/10
Criteria: ${criteriaDetails}
Failed Checks: ${failedChecks.join(', ')}

Provide insight and 3-4 specific recommendations in JSON format.`;
  }
}