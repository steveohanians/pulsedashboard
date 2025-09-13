import logger from './logging/logger';

/**
 * Token bucket rate limiter for API calls
 * Ensures we don't exceed the specified requests per second limit
 */
export class ApiRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly minDelay: number; // minimum delay between requests in ms
  private readonly waitQueue: Array<() => void> = [];
  private processingQueue: boolean = false;
  private lastTokenTime: number = 0;

  constructor(
    maxRequestsPerSecond: number,
    burstCapacity: number = maxRequestsPerSecond
  ) {
    this.maxTokens = burstCapacity;
    this.refillRate = maxRequestsPerSecond;
    this.minDelay = 1000 / maxRequestsPerSecond; // ms between requests
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    
    logger.info('API Rate Limiter initialized', {
      maxRequestsPerSecond,
      burstCapacity,
      minDelayMs: this.minDelay
    });
  }

  /**
   * Refill tokens based on time elapsed since last refill
   */
  private refillTokens(): void {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.lastRefill) / 1000; // convert to seconds
    const tokensToAdd = timeSinceLastRefill * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Wait for a token to become available and consume it
   * Returns a promise that resolves when it's safe to make the request
   * 
   * CONCURRENCY SAFE: Uses a proper queue to ensure only one request proceeds per token
   * Implements the architect's requested queue mechanism with proper loop semantics
   */
  public async waitForToken(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Add request to queue
      this.waitQueue.push(resolve);
      
      // Start processing if not already running
      if (!this.processingQueue) {
        this.processTokenQueue();
      }
    });
  }
  
  /**
   * Process the token queue ensuring proper rate limiting with loop that re-checks availability
   * This implements the architect's requested loop that only proceeds when tokens >= 1
   */
  private async processTokenQueue(): Promise<void> {
    if (this.processingQueue || this.waitQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    while (this.waitQueue.length > 0) {
      // Loop that re-checks token availability as requested by architect
      while (true) {
        this.refillTokens();
        
        // Only proceed when tokens >= 1 (as per architect's requirement)
        if (this.tokens >= 1) {
          const now = Date.now();
          
          // Enforce minimum delay between requests for proper rate limiting
          if (this.lastTokenTime > 0) {
            const timeSinceLastToken = now - this.lastTokenTime;
            if (timeSinceLastToken < this.minDelay) {
              const waitTime = this.minDelay - timeSinceLastToken;
              await this.sleep(waitTime);
              continue; // Re-check token availability after wait
            }
          }
          
          // Atomically consume token and resolve next request
          this.tokens -= 1;
          this.lastTokenTime = now;
          
          const nextResolve = this.waitQueue.shift()!;
          nextResolve();
          
          logger.debug('Token consumed from queue', {
            tokensRemaining: Math.floor(this.tokens),
            queueLength: this.waitQueue.length
          });
          
          break; // Exit inner loop to process next queued request
        }
        
        // No tokens available, wait for refill
        const tokensNeeded = 1 - this.tokens;
        const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;
        const actualWaitTime = Math.max(waitTimeMs, this.minDelay);
        
        logger.debug('Queue waiting for tokens', {
          tokensRemaining: Math.floor(this.tokens),
          queueLength: this.waitQueue.length,
          waitTimeMs: Math.ceil(actualWaitTime)
        });
        
        await this.sleep(actualWaitTime);
        // Continue loop to re-check token availability
      }
    }
    
    this.processingQueue = false;
  }
  

  /**
   * Check if a token is available without consuming it
   */
  public hasTokenAvailable(): boolean {
    this.refillTokens();
    return this.tokens >= 1;
  }

  /**
   * Get current token count (for monitoring)
   */
  public getTokenCount(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Get rate limiter status for monitoring
   */
  public getStatus(): {
    tokensAvailable: number;
    maxTokens: number;
    refillRate: number;
    utilizationPercentage: number;
    lastRefillTime: Date;
    queueLength: number;
    isProcessing: boolean;
  } {
    this.refillTokens();
    return {
      tokensAvailable: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      utilizationPercentage: Math.round(((this.maxTokens - this.tokens) / this.maxTokens) * 100),
      lastRefillTime: new Date(this.lastRefill),
      queueLength: this.waitQueue.length,
      isProcessing: this.processingQueue
    };
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.lastTokenTime = 0;
    this.processingQueue = false;
    
    // Clear queue and resolve all waiting requests immediately (they get fresh tokens)
    const waitingRequests = this.waitQueue.splice(0);
    waitingRequests.forEach(resolve => resolve());
    
    logger.debug('Rate limiter reset', {
      clearedRequests: waitingRequests.length
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create SEMrush-specific rate limiter
 * Configured for 8 requests/second with burst capacity of 10
 */
export function createSemrushRateLimiter(): ApiRateLimiter {
  return new ApiRateLimiter(8, 10); // 8 requests/second, burst capacity of 10
}