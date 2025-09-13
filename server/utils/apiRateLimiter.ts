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
   * CONCURRENCY SAFE: Uses a loop to prevent thundering herd problems
   * where multiple concurrent requests could all see tokens >= 1 and proceed
   */
  public async waitForToken(): Promise<void> {
    while (true) {
      this.refillTokens();
      
      // Check if token is available and atomically consume it
      if (this.tokens >= 1) {
        this.tokens -= 1;
        logger.debug('Token consumed', { 
          tokensRemaining: Math.floor(this.tokens),
          maxTokens: this.maxTokens 
        });
        return; // Exit the loop and allow request to proceed
      }
      
      // No tokens available, calculate wait time for next token
      const tokensNeeded = 1 - this.tokens;
      const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;
      const actualWaitTime = Math.max(waitTimeMs, this.minDelay);
      
      logger.debug('Rate limit reached, waiting for token', {
        tokensRemaining: Math.floor(this.tokens),
        waitTimeMs: Math.ceil(actualWaitTime)
      });
      
      // Sleep and then re-evaluate token availability
      await this.sleep(actualWaitTime);
      
      // Loop continues to re-check token availability after sleep
      // This prevents race conditions where multiple requests wake up
      // simultaneously and try to consume the same token
    }
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
  } {
    this.refillTokens();
    return {
      tokensAvailable: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      utilizationPercentage: Math.round(((this.maxTokens - this.tokens) / this.maxTokens) * 100),
      lastRefillTime: new Date(this.lastRefill)
    };
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    logger.debug('Rate limiter reset');
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