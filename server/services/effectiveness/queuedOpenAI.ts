/**
 * Queued OpenAI Wrapper for Effectiveness Scoring
 * 
 * Drop-in replacement for direct OpenAI calls in scoring criteria.
 * Routes all requests through the OpenAI Queue Manager for proper rate limiting.
 */

import { OpenAI } from 'openai';
import { OpenAIQueueManager } from './openaiQueueManager';
import logger from '../../utils/logging/logger';

/**
 * Priority levels for different types of scoring requests
 */
export const SCORING_PRIORITIES = {
  POSITIONING: 8,     // High priority - foundational messaging
  BRAND_STORY: 7,     // High priority - core narrative  
  CTAS: 6,           // Medium-high priority - conversion impact
  INSIGHTS: 5,       // Medium priority - post-scoring analysis
  FALLBACK: 3,       // Lower priority - fallback analysis
  HEALTH_CHECK: 10   // Highest priority - system health
} as const;

/**
 * Enhanced OpenAI wrapper that queues all requests
 */
export class QueuedOpenAI {
  private queueManager: OpenAIQueueManager;
  private openai: OpenAI;

  constructor(openaiClient: OpenAI) {
    this.openai = openaiClient;
    this.queueManager = OpenAIQueueManager.getInstance(openaiClient);
  }

  /**
   * ✅ MAIN: Queued chat completion with automatic priority assignment
   */
  async chat_completions_create(
    params: any,
    options: {
      priority?: number;
      scoringType?: keyof typeof SCORING_PRIORITIES;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<any> {
    // ✅ Auto-assign priority based on scoring type
    let priority = options.priority || SCORING_PRIORITIES.INSIGHTS;
    
    if (options.scoringType && SCORING_PRIORITIES[options.scoringType]) {
      priority = SCORING_PRIORITIES[options.scoringType];
    }
    
    // ✅ Estimate token usage for better queue management
    const estimatedTokens = this.estimateTokenUsage(params);
    
    // ✅ Determine request type for vision vs completion
    const isVisionRequest = params.messages?.some((msg: any) => 
      Array.isArray(msg.content) && 
      msg.content.some((item: any) => item.type === 'image_url')
    );
    
    const requestType = isVisionRequest ? 'vision' : 'completion';
    
    logger.info('Queuing OpenAI request via effectiveness scoring', {
      model: params.model,
      priority,
      scoringType: options.scoringType,
      requestType,
      estimatedTokens,
      messageCount: params.messages?.length || 0
    });

    try {
      return await this.queueManager.queueChatCompletion(params, {
        priority,
        type: requestType,
        timeout: options.timeout || 45000,
        maxRetries: options.retries || 5,
        estimatedTokens
      });
      
    } catch (error) {
      logger.error('Queued OpenAI request failed', {
        model: params.model,
        scoringType: options.scoringType,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * ✅ COMPATIBILITY: Maintain OpenAI SDK interface structure
   */
  get chat() {
    return {
      completions: {
        create: (params: any, options?: any) => this.chat_completions_create(params, options)
      }
    };
  }

  /**
   * ✅ UTILITY: Estimate token usage for queue management
   */
  private estimateTokenUsage(params: any): number {
    let estimatedTokens = 0;
    
    // Estimate based on message content
    if (params.messages) {
      for (const message of params.messages) {
        if (typeof message.content === 'string') {
          // Rough estimation: ~4 chars per token
          estimatedTokens += Math.ceil(message.content.length / 4);
        } else if (Array.isArray(message.content)) {
          // Vision requests - estimate text + fixed cost for images
          for (const item of message.content) {
            if (item.type === 'text') {
              estimatedTokens += Math.ceil(item.text.length / 4);
            } else if (item.type === 'image_url') {
              estimatedTokens += 500; // Rough estimate for image processing
            }
          }
        }
      }
    }
    
    // Add estimated response tokens
    const maxTokens = params.max_tokens || 1000;
    estimatedTokens += maxTokens;
    
    return estimatedTokens;
  }

  /**
   * ✅ UTILITY: Get queue status for monitoring
   */
  getQueueStatus(): any {
    return this.queueManager.getQueueStatus();
  }

  /**
   * ✅ UTILITY: Health check through queue
   */
  async healthCheck(): Promise<any> {
    return this.queueManager.healthCheck();
  }

  /**
   * ✅ CONVENIENCE: Direct methods for common scoring operations
   */
  
  async scorePositioning(params: any): Promise<any> {
    return this.chat_completions_create(params, {
      scoringType: 'POSITIONING',
      timeout: 30000
    });
  }

  async scoreBrandStory(params: any): Promise<any> {
    return this.chat_completions_create(params, {
      scoringType: 'BRAND_STORY', 
      timeout: 30000
    });
  }

  async scoreCTAs(params: any): Promise<any> {
    return this.chat_completions_create(params, {
      scoringType: 'CTAS',
      timeout: 30000
    });
  }

  async generateInsights(params: any): Promise<any> {
    return this.chat_completions_create(params, {
      scoringType: 'INSIGHTS',
      timeout: 45000
    });
  }
}

/**
 * ✅ FACTORY: Create queued OpenAI instance
 */
export function createQueuedOpenAI(openaiClient: OpenAI): QueuedOpenAI {
  return new QueuedOpenAI(openaiClient);
}

/**
 * ✅ HELPER: For backward compatibility in scoring criteria
 */
export async function queuedOpenAICall(
  openai: OpenAI,
  params: any,
  scoringType: keyof typeof SCORING_PRIORITIES
): Promise<any> {
  const queuedOpenAI = new QueuedOpenAI(openai);
  return queuedOpenAI.chat_completions_create(params, { scoringType });
}