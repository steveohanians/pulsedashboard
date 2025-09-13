import { ApiRateLimiter } from '../apiRateLimiter';

describe('ApiRateLimiter', () => {
  let rateLimiter: ApiRateLimiter;

  beforeEach(() => {
    rateLimiter = new ApiRateLimiter(8, 10); // 8 requests/second, burst of 10
  });

  test('should allow initial burst of requests', async () => {
    const startTime = Date.now();
    
    // Should be able to make initial burst without delay
    for (let i = 0; i < 8; i++) {
      await rateLimiter.waitForToken();
    }
    
    const elapsedTime = Date.now() - startTime;
    // Initial burst should be very fast (under 50ms)
    expect(elapsedTime).toBeLessThan(50);
  });

  test('should enforce rate limit after burst', async () => {
    const startTime = Date.now();
    const requestTimes: number[] = [];
    
    // Make 15 requests (beyond the initial burst capacity)
    for (let i = 0; i < 15; i++) {
      await rateLimiter.waitForToken();
      requestTimes.push(Date.now() - startTime);
    }
    
    // Verify rate doesn't exceed 8 RPS over the entire test
    const totalTime = requestTimes[requestTimes.length - 1];
    const actualRate = (requestTimes.length / totalTime) * 1000;
    
    // Should not exceed 8.5 RPS (with tolerance for timing)
    expect(actualRate).toBeLessThanOrEqual(8.5);
    
    // After initial burst (first 10), requests should be properly spaced
    const spacedRequests = requestTimes.slice(10);
    if (spacedRequests.length > 1) {
      for (let i = 1; i < spacedRequests.length; i++) {
        const timeBetween = spacedRequests[i] - spacedRequests[i - 1];
        // Should be at least 100ms between requests (8 RPS = 125ms ideal)
        expect(timeBetween).toBeGreaterThan(90);
      }
    }
  }, 10000); // Increase timeout for this test

  test('should refill tokens over time', async () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      await rateLimiter.waitForToken();
    }
    
    // Wait for refill
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    // Should have tokens available again without significant delay
    const startTime = Date.now();
    await rateLimiter.waitForToken();
    const elapsedTime = Date.now() - startTime;
    
    expect(elapsedTime).toBeLessThan(50);
  });

  test('should report correct token status', () => {
    const status = rateLimiter.getStatus();
    
    expect(status.tokensAvailable).toBe(10); // Initial burst capacity
    expect(status.maxTokens).toBe(10);
    expect(status.refillRate).toBe(8);
    expect(status.utilizationPercentage).toBe(0);
  });

  test('should track utilization correctly', async () => {
    // Consume some tokens
    await rateLimiter.waitForToken();
    await rateLimiter.waitForToken();
    
    const status = rateLimiter.getStatus();
    expect(status.utilizationPercentage).toBeGreaterThan(0);
    expect(status.tokensAvailable).toBeLessThan(10);
  });

  test('should reset correctly', async () => {
    // Consume tokens
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitForToken();
    }
    
    rateLimiter.reset();
    
    const status = rateLimiter.getStatus();
    expect(status.tokensAvailable).toBe(10);
    expect(status.utilizationPercentage).toBe(0);
  });
});

// Concurrency tests - critical for preventing thundering herd
describe('ApiRateLimiter Concurrency Safety', () => {
  test('should handle concurrent requests without violating rate limit', async () => {
    const rateLimiter = new ApiRateLimiter(8, 10);
    const startTime = Date.now();
    const completionTimes: number[] = [];
    
    // Launch 20 concurrent requests simultaneously
    const promises = Array.from({ length: 20 }, async (_, i) => {
      await rateLimiter.waitForToken();
      const completionTime = Date.now() - startTime;
      completionTimes.push(completionTime);
      return { requestId: i, completionTime };
    });
    
    const results = await Promise.all(promises);
    
    // Sort by completion time to analyze timing
    results.sort((a, b) => a.completionTime - b.completionTime);
    
    // Verify total rate doesn't exceed limit
    const totalTime = results[results.length - 1].completionTime;
    const actualRate = (results.length / totalTime) * 1000;
    expect(actualRate).toBeLessThanOrEqual(8.5);
    
    // Verify requests after burst are properly spaced
    const spacedResults = results.slice(10); // After initial burst
    if (spacedResults.length > 1) {
      for (let i = 1; i < spacedResults.length; i++) {
        const timeDiff = spacedResults[i].completionTime - spacedResults[i - 1].completionTime;
        // Should be at least 100ms apart (accounting for timing tolerance)
        expect(timeDiff).toBeGreaterThan(90);
      }
    }
  }, 15000);

  test('should prevent token over-consumption in concurrent scenarios', async () => {
    const rateLimiter = new ApiRateLimiter(5, 5); // Smaller limits for easier testing
    
    // Launch many concurrent requests
    const promises = Array.from({ length: 15 }, async () => {
      await rateLimiter.waitForToken();
      return Date.now();
    });
    
    const startTime = Date.now();
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Rate should not exceed 5 RPS significantly
    const actualRate = (15 / totalTime) * 1000;
    expect(actualRate).toBeLessThanOrEqual(5.5);
  }, 10000);

  test('should maintain token accuracy under high concurrency', async () => {
    const rateLimiter = new ApiRateLimiter(10, 15);
    
    // Consume initial burst concurrently
    const burstPromises = Array.from({ length: 15 }, () => rateLimiter.waitForToken());
    await Promise.all(burstPromises);
    
    // Check that no tokens are left after burst
    expect(rateLimiter.hasTokenAvailable()).toBe(false);
    
    // Wait for some refill
    await new Promise(resolve => setTimeout(resolve, 300)); // 0.3 seconds
    
    // Should have approximately 3 tokens (10 RPS * 0.3s = 3 tokens)
    const tokensAfterRefill = rateLimiter.getTokenCount();
    expect(tokensAfterRefill).toBeGreaterThan(1);
    expect(tokensAfterRefill).toBeLessThan(5);
  });
});

// Integration test with SemrushService mock
describe('SemrushService Rate Limiting Integration', () => {
  test('should demonstrate rate limiting in practice', async () => {
    const rateLimiter = new ApiRateLimiter(8, 10);
    const requestTimes: number[] = [];
    const startTime = Date.now();
    
    // Simulate making multiple API calls like SemrushService would
    for (let i = 0; i < 15; i++) {
      await rateLimiter.waitForToken();
      requestTimes.push(Date.now() - startTime);
      
      // Simulate actual API call delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Verify that requests are properly spaced
    const totalTime = requestTimes[requestTimes.length - 1];
    const averageRate = (requestTimes.length / totalTime) * 1000; // requests per second
    
    // Should not exceed 8 requests per second
    expect(averageRate).toBeLessThanOrEqual(8.5); // Small tolerance for timing variations
    
    // Should be reasonably close to target rate
    expect(averageRate).toBeGreaterThan(6); // Should not be too slow either
  }, 10000);
});