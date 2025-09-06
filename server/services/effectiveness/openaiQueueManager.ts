/**
 * OpenAI Request Queue Manager
 * 
 * Implements external API best practices for OpenAI:
 * - Centralized request queuing to prevent concurrent overload
 * - Enhanced exponential backoff with jitter for 429 errors
 * - Intelligent request batching and throttling
 * - Circuit breaker pattern for systematic failures
 * - Comprehensive retry strategies with fallback
 */

import { OpenAI } from 'openai';
import logger from '../../utils/logging/logger';

interface QueuedRequest {
  id: string;
  priority: number;
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
  metadata: {
    type: 'completion' | 'vision' | 'health_check';
    model?: string;
    estimatedTokens?: number;
    createdAt: number;
  };
}

interface RateLimitState {
  requestsThisMinute: number;
  requestsThisHour: number;
  lastReset: number;
  isLimited: boolean;
  backoffUntil?: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextRetryTime: number;
}

// ✅ Configuration following external API best practices
const QUEUE_CONFIG = {
  // Request limits and throttling
  maxConcurrentRequests: 3,        // Max parallel requests
  maxQueueSize: 100,               // Max queued requests
  defaultRequestTimeout: 45000,     // 45s timeout per request
  
  // Rate limiting (conservative estimates)
  requestsPerMinute: 30,           // Below OpenAI's typical limits
  requestsPerHour: 1000,           // Conservative hourly limit
  
  // Retry and backoff configuration
  maxRetries: 5,                   // More retries for rate limits
  baseRetryDelay: 2000,            // 2s base delay
  maxRetryDelay: 120000,           // 2 minute max delay
  jitterFactor: 0.3,               // 30% jitter
  
  // Rate limit specific delays
  rateLimitMinDelay: 10000,        // 10s minimum for 429 errors
  rateLimitMaxDelay: 300000,       // 5 minute maximum
  
  // Circuit breaker configuration
  circuitBreakerThreshold: 5,      // Failures before opening circuit
  circuitBreakerTimeout: 60000,    // 1 minute before retry
  circuitBreakerHalfOpenRetries: 1, // Test requests when half-open
};

export class OpenAIQueueManager {
  private static instance: OpenAIQueueManager;
  private openai: OpenAI;
  
  // Queue management
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = new Set<string>();
  private requestCounter = 0;
  
  // Rate limiting state
  private rateLimitState: RateLimitState = {
    requestsThisMinute: 0,
    requestsThisHour: 0,
    lastReset: Date.now(),
    isLimited: false
  };
  
  // Circuit breaker state
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
    nextRetryTime: 0
  };
  
  // Performance tracking
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitErrors: 0,
    timeoutErrors: 0,
    averageResponseTime: 0,
    queueWaitTimes: [] as number[]
  };

  private constructor(openaiClient: OpenAI) {
    this.openai = openaiClient;
    this.startQueueProcessor();
    this.startMetricsReset();
  }

  public static getInstance(openaiClient?: OpenAI): OpenAIQueueManager {
    if (!OpenAIQueueManager.instance) {
      if (!openaiClient) {
        throw new Error('OpenAI client required for first initialization');
      }
      OpenAIQueueManager.instance = new OpenAIQueueManager(openaiClient);
    }
    return OpenAIQueueManager.instance;
  }

  /**
   * ✅ PUBLIC: Queue a chat completion request with priority and retry logic
   */
  async queueChatCompletion(
    params: any,
    options: {
      priority?: number;
      maxRetries?: number;
      timeout?: number;
      type?: 'completion' | 'vision';
      estimatedTokens?: number;
    } = {}
  ): Promise<any> {
    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    const startTime = Date.now();
    
    // ✅ Check circuit breaker
    if (this.circuitBreaker.state === 'open') {
      if (Date.now() < this.circuitBreaker.nextRetryTime) {
        throw new Error(`Circuit breaker is open. Retry after ${new Date(this.circuitBreaker.nextRetryTime).toISOString()}`);
      } else {
        this.circuitBreaker.state = 'half-open';
        logger.info('Circuit breaker moving to half-open state');
      }
    }
    
    // ✅ Check queue capacity
    if (this.requestQueue.length >= QUEUE_CONFIG.maxQueueSize) {
      throw new Error(`Request queue is full (${QUEUE_CONFIG.maxQueueSize} requests)`);
    }
    
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        priority: options.priority || 5, // Default medium priority
        operation: () => this.executeChatCompletion(params, options.timeout || QUEUE_CONFIG.defaultRequestTimeout),
        resolve,
        reject,
        retryCount: 0,
        maxRetries: options.maxRetries || QUEUE_CONFIG.maxRetries,
        metadata: {
          type: options.type || 'completion',
          model: params.model,
          estimatedTokens: options.estimatedTokens,
          createdAt: startTime
        }
      };
      
      // ✅ Insert request in priority order (higher priority = earlier execution)
      const insertIndex = this.requestQueue.findIndex(req => req.priority < queuedRequest.priority);
      if (insertIndex === -1) {
        this.requestQueue.push(queuedRequest);
      } else {
        this.requestQueue.splice(insertIndex, 0, queuedRequest);
      }
      
      logger.info('OpenAI request queued', {
        requestId,
        priority: queuedRequest.priority,
        queueLength: this.requestQueue.length,
        estimatedWaitTime: this.estimateWaitTime()
      });
    });
  }

  /**
   * ✅ PRIVATE: Execute actual OpenAI chat completion with timeout
   */
  private async executeChatCompletion(params: any, timeout: number): Promise<any> {
    const startTime = Date.now();
    
    try {
      // ✅ Wrap OpenAI call with guaranteed timeout
      const result = await Promise.race([
        this.openai.chat.completions.create(params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`OpenAI request timeout after ${timeout}ms`)), timeout)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      // ✅ Track success metrics
      this.metrics.successfulRequests++;
      this.updateAverageResponseTime(responseTime);
      
      // ✅ Reset circuit breaker on success
      if (this.circuitBreaker.state === 'half-open') {
        this.circuitBreaker.state = 'closed';
        this.circuitBreaker.failures = 0;
        logger.info('Circuit breaker reset to closed state after successful request');
      }
      
      logger.info('OpenAI request completed successfully', {
        responseTime,
        model: params.model,
        usage: (result as any).usage
      });
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // ✅ Track failure metrics
      this.metrics.failedRequests++;
      
      // ✅ Classify error type for appropriate handling
      const errorType = this.classifyOpenAIError(error, responseTime);
      
      logger.warn('OpenAI request failed', {
        error: errorMessage,
        errorType,
        responseTime,
        model: params.model
      });
      
      // ✅ Update circuit breaker on failures
      this.updateCircuitBreaker(errorType);
      
      throw error;
    }
  }

  /**
   * ✅ ENHANCED: Classify OpenAI errors for appropriate retry strategy
   */
  private classifyOpenAIError(error: any, responseTime: number): string {
    const message = (error.message || String(error)).toLowerCase();
    
    // Rate limit errors (429)
    if (message.includes('rate limit') || message.includes('429')) {
      this.metrics.rateLimitErrors++;
      this.updateRateLimitState();
      return 'rate_limit';
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted') || responseTime >= QUEUE_CONFIG.defaultRequestTimeout) {
      this.metrics.timeoutErrors++;
      return 'timeout';
    }
    
    // Server errors (500-599)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'server_error';
    }
    
    // Client errors (400-499, except 429)
    if (message.includes('400') || message.includes('401') || message.includes('403') || message.includes('404')) {
      return 'client_error';
    }
    
    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return 'network_error';
    }
    
    return 'unknown_error';
  }

  /**
   * ✅ ENHANCED: Update circuit breaker based on error type
   */
  private updateCircuitBreaker(errorType: string): void {
    // Only count certain error types as circuit breaker failures
    if (['rate_limit', 'server_error', 'timeout', 'network_error'].includes(errorType)) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailureTime = Date.now();
      
      if (this.circuitBreaker.failures >= QUEUE_CONFIG.circuitBreakerThreshold) {
        this.circuitBreaker.state = 'open';
        this.circuitBreaker.nextRetryTime = Date.now() + QUEUE_CONFIG.circuitBreakerTimeout;
        
        logger.warn('Circuit breaker opened due to repeated failures', {
          failures: this.circuitBreaker.failures,
          nextRetryTime: new Date(this.circuitBreaker.nextRetryTime).toISOString()
        });
      }
    }
  }

  /**
   * ✅ ENHANCED: Update rate limit state and apply backoff
   */
  private updateRateLimitState(): void {
    this.rateLimitState.isLimited = true;
    
    // Calculate backoff time with jitter
    const baseDelay = QUEUE_CONFIG.rateLimitMinDelay;
    const jitter = Math.random() * baseDelay * QUEUE_CONFIG.jitterFactor;
    const backoffTime = baseDelay + jitter;
    
    this.rateLimitState.backoffUntil = Date.now() + backoffTime;
    
    logger.warn('Rate limit detected, applying backoff', {
      backoffTime: Math.round(backoffTime / 1000) + 's',
      backoffUntil: new Date(this.rateLimitState.backoffUntil).toISOString()
    });
  }

  /**
   * ✅ CORE: Queue processor that respects rate limits and handles retries
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      await this.processQueue();
    }, 1000); // Process every second
  }

  private async processQueue(): Promise<void> {
    // ✅ Check if we can process requests
    if (this.requestQueue.length === 0 || 
        this.activeRequests.size >= QUEUE_CONFIG.maxConcurrentRequests ||
        this.circuitBreaker.state === 'open') {
      return;
    }
    
    // ✅ Check rate limits
    this.resetRateLimitCountersIfNeeded();
    
    if (this.rateLimitState.isLimited && 
        this.rateLimitState.backoffUntil && 
        Date.now() < this.rateLimitState.backoffUntil) {
      return; // Still in backoff period
    }
    
    if (this.rateLimitState.requestsThisMinute >= QUEUE_CONFIG.requestsPerMinute) {
      logger.warn('Rate limit reached for this minute', {
        requestsThisMinute: this.rateLimitState.requestsThisMinute,
        limit: QUEUE_CONFIG.requestsPerMinute
      });
      return;
    }
    
    // ✅ Get highest priority request
    const request = this.requestQueue.shift();
    if (!request) return;
    
    const queueWaitTime = Date.now() - request.metadata.createdAt;
    this.metrics.queueWaitTimes.push(queueWaitTime);
    
    // ✅ Mark as active and process
    this.activeRequests.add(request.id);
    this.rateLimitState.requestsThisMinute++;
    this.rateLimitState.requestsThisHour++;
    this.metrics.totalRequests++;
    
    logger.info('Processing OpenAI request', {
      requestId: request.id,
      priority: request.priority,
      queueWaitTime: Math.round(queueWaitTime / 1000) + 's',
      activeRequests: this.activeRequests.size,
      remainingQueue: this.requestQueue.length
    });
    
    try {
      const result = await request.operation();
      request.resolve(result);
      
    } catch (error) {
      const errorType = this.classifyOpenAIError(error, 0);
      
      // ✅ ENHANCED: Retry logic with exponential backoff
      if (request.retryCount < request.maxRetries && this.shouldRetryError(errorType)) {
        request.retryCount++;
        
        const retryDelay = this.calculateRetryDelay(errorType, request.retryCount);
        
        logger.info('Retrying OpenAI request after delay', {
          requestId: request.id,
          attempt: request.retryCount + 1,
          maxRetries: request.maxRetries,
          errorType,
          retryDelay: Math.round(retryDelay / 1000) + 's'
        });
        
        // ✅ Schedule retry (re-queue with delay)
        setTimeout(() => {
          this.requestQueue.unshift(request); // High priority for retries
        }, retryDelay);
        
      } else {
        // ✅ Max retries exceeded or non-retryable error
        logger.error('OpenAI request failed after retries', {
          requestId: request.id,
          attempts: request.retryCount + 1,
          errorType,
          finalError: error instanceof Error ? error.message : String(error)
        });
        
        request.reject(error as Error);
      }
    } finally {
      this.activeRequests.delete(request.id);
      
      // ✅ Clear rate limit backoff if we've been successful
      if (this.rateLimitState.isLimited && !this.rateLimitState.backoffUntil) {
        this.rateLimitState.isLimited = false;
      }
    }
  }

  /**
   * ✅ ENHANCED: Determine if error should be retried
   */
  private shouldRetryError(errorType: string): boolean {
    const retryableErrors = ['rate_limit', 'timeout', 'server_error', 'network_error'];
    return retryableErrors.includes(errorType);
  }

  /**
   * ✅ ENHANCED: Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(errorType: string, attempt: number): number {
    let baseDelay = QUEUE_CONFIG.baseRetryDelay;
    
    // ✅ Special handling for rate limits
    if (errorType === 'rate_limit') {
      baseDelay = QUEUE_CONFIG.rateLimitMinDelay;
    }
    
    // ✅ Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // ✅ Add jitter (30% random variation)
    const jitter = exponentialDelay * QUEUE_CONFIG.jitterFactor * (Math.random() - 0.5);
    const finalDelay = exponentialDelay + jitter;
    
    // ✅ Cap at maximum
    const maxDelay = errorType === 'rate_limit' ? QUEUE_CONFIG.rateLimitMaxDelay : QUEUE_CONFIG.maxRetryDelay;
    return Math.min(finalDelay, maxDelay);
  }

  /**
   * ✅ UTILITY: Reset rate limit counters periodically
   */
  private resetRateLimitCountersIfNeeded(): void {
    const now = Date.now();
    const timeSinceReset = now - this.rateLimitState.lastReset;
    
    // Reset minute counter every minute
    if (timeSinceReset > 60000) {
      this.rateLimitState.requestsThisMinute = 0;
    }
    
    // Reset hour counter every hour
    if (timeSinceReset > 3600000) {
      this.rateLimitState.requestsThisHour = 0;
      this.rateLimitState.lastReset = now;
    }
  }

  /**
   * ✅ UTILITY: Estimate queue wait time
   */
  private estimateWaitTime(): number {
    const avgProcessingTime = this.metrics.averageResponseTime || 5000;
    const queuePosition = this.requestQueue.length;
    const availableSlots = Math.max(1, QUEUE_CONFIG.maxConcurrentRequests - this.activeRequests.size);
    
    return (queuePosition / availableSlots) * avgProcessingTime;
  }

  /**
   * ✅ UTILITY: Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      // Exponential moving average
      this.metrics.averageResponseTime = (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
  }

  /**
   * ✅ UTILITY: Start metrics reset timer
   */
  private startMetricsReset(): void {
    // Reset detailed metrics every hour
    setInterval(() => {
      this.metrics.queueWaitTimes = this.metrics.queueWaitTimes.slice(-100); // Keep last 100
      
      logger.info('OpenAI Queue Manager metrics', {
        ...this.metrics,
        queueLength: this.requestQueue.length,
        activeRequests: this.activeRequests.size,
        rateLimitState: this.rateLimitState,
        circuitBreakerState: this.circuitBreaker.state
      });
    }, 3600000); // Every hour
  }

  /**
   * ✅ PUBLIC: Get current queue status
   */
  getQueueStatus(): any {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      rateLimitState: this.rateLimitState,
      circuitBreakerState: this.circuitBreaker.state,
      metrics: this.metrics,
      estimatedWaitTime: this.estimateWaitTime()
    };
  }

  /**
   * ✅ PUBLIC: Health check
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      // Use high priority for health checks
      const result = await this.queueChatCompletion({
        model: "gpt-4o-mini", // Use cheaper model for health checks
        messages: [{ role: "user", content: "Say 'OK' if you're working." }],
        max_tokens: 10
      }, {
        priority: 10,
        type: 'health_check',
        timeout: 10000
      });
      
      const isHealthy = result.choices[0]?.message?.content?.includes('OK');
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: this.getQueueStatus()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
          ...this.getQueueStatus()
        }
      };
    }
  }
}