/**
 * AIClient
 * 
 * Resilient AI client for effectiveness insights generation.
 * Provides retry logic, fallbacks, rate limiting, and comprehensive error handling.
 */

import { OpenAI } from 'openai';
import logger from '../../utils/logging/logger';
import { EffectivenessPromptBuilder, type PromptContent, type PromptData } from './promptBuilder';
import type { CriterionResult } from './types';

export interface AIClientConfig {
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  enableFallback?: boolean;
  timeout?: number;
}

export interface InsightsResponse {
  insight: string;
  recommendations: string[];
  confidence: number;
  key_pattern: string;
  fallback?: boolean;
  metadata?: {
    model: string;
    responseTime: number;
    attempts: number;
    source: 'ai' | 'fallback';
  };
}

export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (response: InsightsResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Advanced AI client with comprehensive error handling and fallback capabilities
 */
export class AIClient {
  private openai: OpenAI;
  private promptBuilder: EffectivenessPromptBuilder;
  private config: Required<AIClientConfig>;

  constructor(openaiClient: OpenAI, config: AIClientConfig = {}) {
    this.openai = openaiClient;
    this.promptBuilder = new EffectivenessPromptBuilder();
    
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      rateLimitDelay: config.rateLimitDelay ?? 5000,
      enableFallback: config.enableFallback ?? true,
      timeout: config.timeout ?? 30000
    };
  }

  /**
   * Generates insights with comprehensive retry and fallback logic
   */
  async generateInsights(data: PromptData): Promise<InsightsResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    // Build optimized prompt
    const promptContent = this.promptBuilder.buildInsightsPrompt(data);

    // Attempt AI generation with retries
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      attempts = attempt;
      
      try {
        logger.debug(`AI insights generation attempt ${attempt}`, {
          clientName: data.clientName,
          overallScore: data.overallScore,
          attempt,
          maxRetries: this.config.maxRetries
        });

        const response = await this.callOpenAI(promptContent);
        const responseTime = Date.now() - startTime;

        // Validate response
        this.validateResponse(response);

        const result: InsightsResponse = {
          ...response,
          metadata: {
            model: 'gpt-4o',
            responseTime,
            attempts,
            source: 'ai'
          }
        };

        logger.info('AI insights generated successfully', {
          responseTime,
          attempts,
          keyPattern: result.key_pattern,
          recommendationCount: result.recommendations.length
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`AI insights attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          maxRetries: this.config.maxRetries
        });

        if (this.shouldRetry(error as Error, attempt)) {
          const delay = this.calculateRetryDelay(error as Error, attempt);
          await this.delay(delay);
          continue;
        }

        break;
      }
    }

    // Generate fallback if enabled and all AI attempts failed
    if (this.config.enableFallback) {
      logger.warn('All AI attempts failed, generating fallback insights', {
        lastError: lastError?.message,
        attempts
      });

      return this.generateFallbackInsights(data, startTime, attempts);
    }

    // If fallback is disabled, throw the last error
    throw lastError || new Error('AI insights generation failed');
  }

  /**
   * Generates insights with streaming support
   */
  async generateInsightsStream(
    data: PromptData, 
    options: StreamingOptions = {}
  ): Promise<AsyncGenerator<string, InsightsResponse, unknown>> {
    const promptContent = this.promptBuilder.buildInsightsPrompt(data);
    const startTime = Date.now();

    try {
      const stream = await this.openai.chat.completions.create({
        model: "gpt-4o",
        temperature: promptContent.temperature || 0.1,
        messages: [
          { role: "system", content: promptContent.system },
          { role: "user", content: promptContent.user }
        ],
        response_format: { type: "json_object" },
        stream: true
      });

      return this.processStream(stream, data, startTime, options);
      
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error);
      }
      
      // Fallback to regular generation
      logger.warn('Streaming failed, falling back to regular generation', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      const result = await this.generateInsights(data);
      return this.createSingleChunkGenerator(result);
    }
  }

  /**
   * Makes the actual OpenAI API call with timeout
   */
  private async callOpenAI(promptContent: PromptContent): Promise<InsightsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        temperature: promptContent.temperature || 0.1,
        max_tokens: promptContent.maxTokens || 1000,
        messages: [
          { role: "system", content: promptContent.system },
          { role: "user", content: promptContent.user }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return JSON.parse(content);
      
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Processes streaming response
   */
  private async *processStream(
    stream: any,
    data: PromptData,
    startTime: number,
    options: StreamingOptions
  ): AsyncGenerator<string, InsightsResponse, unknown> {
    let fullContent = '';
    
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          
          if (options.onChunk) {
            options.onChunk(content);
          }
          
          yield content;
        }
      }

      // Parse final response
      const response = JSON.parse(fullContent);
      this.validateResponse(response);

      const result: InsightsResponse = {
        ...response,
        metadata: {
          model: 'gpt-4o',
          responseTime: Date.now() - startTime,
          attempts: 1,
          source: 'ai'
        }
      };

      if (options.onComplete) {
        options.onComplete(result);
      }

      return result;

    } catch (error) {
      logger.error('Stream processing failed', {
        error: error instanceof Error ? error.message : String(error),
        partialContent: fullContent
      });

      // Generate fallback for stream failures
      return this.generateFallbackInsights(data, startTime, 1);
    }
  }

  /**
   * Creates a single-chunk generator for fallback scenarios
   */
  private async *createSingleChunkGenerator(
    result: InsightsResponse
  ): AsyncGenerator<string, InsightsResponse, unknown> {
    const content = JSON.stringify(result, null, 2);
    yield content;
    return result;
  }

  /**
   * Validates AI response structure and content
   */
  private validateResponse(response: any): void {
    const errors: string[] = [];

    if (!response.insight || typeof response.insight !== 'string') {
      errors.push('Missing or invalid insight');
    }

    if (!Array.isArray(response.recommendations)) {
      errors.push('Recommendations must be an array');
    } else {
      if (response.recommendations.length < 3) {
        errors.push('At least 3 recommendations required');
      }
      
      if (response.recommendations.some((r: any) => typeof r !== 'string')) {
        errors.push('All recommendations must be strings');
      }
    }

    if (typeof response.confidence !== 'number' || 
        response.confidence < 0 || 
        response.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    if (!EffectivenessPromptBuilder.validateKeyPattern(response.key_pattern)) {
      errors.push(`Invalid key_pattern: ${response.key_pattern}`);
    }

    if (errors.length > 0) {
      throw new Error(`Invalid AI response: ${errors.join(', ')}`);
    }
  }

  /**
   * Determines if an error should trigger a retry
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // Check for retryable error conditions
    const message = error.message.toLowerCase();
    const isRetryable = 
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('temporary') ||
      (error as any).code >= 500;

    return isRetryable;
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(error: Error, attempt: number): number {
    const baseDelay = this.config.retryDelay;
    
    // Rate limit errors get special handling
    if (error.message.toLowerCase().includes('rate limit')) {
      return this.config.rateLimitDelay * attempt;
    }
    
    // Exponential backoff for other errors
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Generates deterministic fallback insights
   */
  private generateFallbackInsights(
    data: PromptData, 
    startTime: number, 
    attempts: number
  ): InsightsResponse {
    const primaryIssue = this.identifyPrimaryIssue(data.criterionScores);
    const failedChecks = data.criterionScores
      .flatMap(criterion => criterion.passes?.failed || [])
      .filter(Boolean);

    const fallbackInsight = this.generateFallbackInsight(data.overallScore, primaryIssue);
    const fallbackRecommendations = this.generateFallbackRecommendations(failedChecks);

    return {
      insight: fallbackInsight,
      recommendations: fallbackRecommendations,
      confidence: 0.7,
      key_pattern: primaryIssue.pattern,
      fallback: true,
      metadata: {
        model: 'fallback',
        responseTime: Date.now() - startTime,
        attempts,
        source: 'fallback'
      }
    };
  }

  /**
   * Identifies the primary issue from criterion scores
   */
  private identifyPrimaryIssue(criterionScores: CriterionResult[]) {
    const lowestScore = criterionScores.reduce((lowest, current) => 
      current.score < lowest.score ? current : lowest
    );

    const criterionToPattern: Record<string, string> = {
      positioning: 'messaging_unclear',
      brand_story: 'credibility_gap',
      speed: 'technical_issues',
      ctas: 'conversion_barriers',
      trust: 'credibility_gap',
      ux: 'conversion_barriers',
      seo: 'technical_issues',
      accessibility: 'technical_issues'
    };

    return {
      criterion: lowestScore.criterion,
      score: lowestScore.score,
      pattern: criterionToPattern[lowestScore.criterion] || 'technical_issues'
    };
  }

  /**
   * Generates fallback insight text
   */
  private generateFallbackInsight(overallScore: number, primaryIssue: any): string {
    const scoreText = `Website scores ${overallScore.toFixed(1)}/10.`;
    const issueText = `The primary area for improvement is ${primaryIssue.criterion.replace(/_/g, ' ')} (${primaryIssue.score}/10).`;
    
    let impactText = '';
    switch (primaryIssue.pattern) {
      case 'messaging_unclear':
        impactText = 'This may confuse visitors about your value proposition, potentially increasing bounce rates.';
        break;
      case 'credibility_gap':
        impactText = 'Building trust is essential for conversions and user confidence.';
        break;
      case 'technical_issues':
        impactText = 'Technical improvements can enhance user experience and search rankings.';
        break;
      case 'conversion_barriers':
        impactText = 'Removing friction can improve user flow and conversion rates.';
        break;
      default:
        impactText = 'Addressing this will improve overall user experience.';
    }

    return `${scoreText} ${issueText} ${impactText}`;
  }

  /**
   * Generates fallback recommendations
   */
  private generateFallbackRecommendations(failedChecks: string[]): string[] {
    const recommendations = failedChecks
      .map(check => EffectivenessPromptBuilder.getRecommendationForCheck(check))
      .filter(Boolean)
      .slice(0, 3);

    // Add generic recommendations if needed
    const genericRecs = [
      "Optimize page loading performance",
      "Improve call-to-action visibility", 
      "Add social proof elements",
      "Enhance mobile user experience"
    ];

    return [...recommendations, ...genericRecs].slice(0, 4);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<AIClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('AIClient configuration updated', { 
      config: this.config 
    });
  }

  /**
   * Gets current configuration
   */
  getConfig(): Required<AIClientConfig> {
    return { ...this.config };
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Say 'OK' if you're working." }],
        max_tokens: 10
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.choices[0]?.message?.content?.includes('OK')) {
        return {
          status: responseTime > 10000 ? 'degraded' : 'healthy',
          details: { responseTime, model: 'gpt-4o' }
        };
      }
      
      return {
        status: 'unhealthy',
        details: { error: 'Unexpected response', responseTime }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }
}