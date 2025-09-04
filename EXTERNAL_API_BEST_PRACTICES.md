# External API Best Practices Reference (2025)

This document consolidates best practices for all external tools and systems used in the effectiveness scoring engine.

## 🎭 Playwright Browser Management

### Browser Lifecycle Best Practices
- **Browser Pool Management**: Reuse browser instances across operations instead of creating new browsers per request
- **Context Isolation**: Use lightweight browser contexts that share browser resources but provide isolation
- **Resource Cleanup**: Always close pages and contexts properly using lifecycle hooks (`beforeAll`/`afterAll`)
- **Concurrency Control**: Process maximum 5 pages concurrently using controlled parallel processing with semaphores
- **Memory Management**: Implement proactive resource cleanup after each operation to prevent memory leaks

### Critical Patterns
```typescript
// ✅ Good: Browser reuse with context isolation
const browser = await playwright.chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
// ... operations
await page.close();
await context.close();
// Keep browser alive for reuse

// ❌ Bad: New browser per operation
const browser = await playwright.chromium.launch();
// ... operations
await browser.close(); // Expensive startup cost
```

### Race Condition Prevention
- Never close browser instances during active page operations
- Use proper locking mechanisms to prevent concurrent browser state changes
- Implement health checks before browser operations
- Maintain browser state tracking to prevent premature closure

## 📸 Screenshotone API

### Timeout Configuration
- **Default Timeout**: 60 seconds (sufficient for most sites)
- **Maximum Timeout**: 90 seconds for synchronous requests
- **Async Timeout**: Up to 300 seconds using webhooks/async requests
- **Navigation Timeout**: 30 seconds (separate from rendering timeout)

### Error Handling Patterns
```typescript
// ✅ Proper error handling with fallback
try {
  const screenshot = await screenshotoneAPI.capture(url, {
    timeout: 90,
    wait_until: 'domcontentloaded'
  });
} catch (error) {
  if (error.error_code === 'timeout_error') {
    // Try async request or Playwright fallback
    return await playwrightFallback(url);
  }
  throw error;
}
```

### Rate Limiting & Throttling
- Implement minimum 1-second delays between requests
- Use exponential backoff for timeout errors
- Consider using async requests for problematic domains
- Failed requests don't count against rendering quota

## 🤖 OpenAI API

### Exponential Backoff Implementation
```typescript
// ✅ Proper retry with exponential backoff and jitter
async function retryWithBackoff(apiCall, maxRetries = 6) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status !== 429 || attempt === maxRetries) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 60000);
      const jitter = Math.random() * delay * 0.3;
      await sleep(delay + jitter);
    }
  }
}
```

### Rate Limit Management
- **429 Errors**: Require exponential backoff, not continuous retry
- **Streaming Strategy**: Use streaming to detect timeouts within 5-6 seconds
- **Token Optimization**: Reduce `max_tokens` to minimize rate limit probability
- **Unsuccessful Requests**: Count toward per-minute limits, so avoid rapid retries

### Advanced Strategies
- Dynamic retry intervals based on API response times
- Monitor rate limit reset periods for optimal timing
- Implement request queuing for batch processing
- Use structured outputs for efficient multi-prompt processing

## ⚡ PageSpeed Insights API

### Rate Limits & Quotas
- **Daily Limit**: 25,000 queries per day
- **Burst Limit**: 400 queries per 100 seconds
- **Practical Limit**: ~4 requests per second maximum
- **Secret Limit**: After 10 minutes usage, may return 500 errors for 5 minutes

### Timeout & Error Handling
- **Default Timeout**: 120 seconds (increased from 60s in 2021)
- **500 Error Strategy**: Sleep 1-180 seconds when hitting 500 errors
- **API Key**: Required for production automation and higher limits
- **Caching**: Essential to avoid unnecessary API calls

### Production Implementation
```typescript
// ✅ Proper PSI implementation with error handling
async function getPageSpeedData(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://pagespeedapi.googleapis.com/pagespeed/v5/runPagespeed?url=${url}&key=${API_KEY}`);
      
      if (response.status === 500) {
        const delay = Math.random() * 180000 + 1000; // 1-180s
        await sleep(delay);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(attempt * 1000); // Linear backoff
    }
  }
}
```

## 🗃️ PostgreSQL/Drizzle ORM Transactions

### Atomic Operations
```typescript
// ✅ Proper atomic transaction pattern
await db.transaction(async (tx) => {
  // All operations succeed or all fail
  const run = await tx.insert(effectivenessRuns).values({...}).returning();
  
  for (const score of criterionScores) {
    await tx.insert(criterionScores).values({
      runId: run.id,
      ...score
    });
  }
  
  // Automatic commit if no errors thrown
});
```

### Advanced Transaction Patterns
- **Nested Transactions**: Use savepoints for complex operations
- **Conditional Rollback**: Programmatically rollback based on business logic
- **Error Handling**: Thrown errors automatically trigger rollback
- **Isolation Levels**: Configure appropriate levels (`read committed`, `serializable`, etc.)
- **Short-lived Transactions**: Keep transaction scope minimal to avoid locks

### Best Practices
- Always wrap multi-step database operations in transactions
- Use transactions for consistency across related tables
- Test transaction rollback scenarios thoroughly
- Choose appropriate isolation levels for each use case

## 🚀 Express.js Concurrent Request Handling

### Async/Await Best Practices
```typescript
// ✅ Proper async route handler
app.post('/api/effectiveness/refresh', async (req, res, next) => {
  try {
    // Use setImmediate for long-running operations
    setImmediate(async () => {
      try {
        await longRunningTask();
      } catch (error) {
        logger.error('Background task failed', error);
      }
    });
    
    res.json({ message: 'Task started' });
  } catch (error) {
    next(error); // Express handles async errors automatically
  }
});
```

### Performance Optimizations
- **NODE_ENV=production**: Enables caching, improves performance by 3x
- **Avoid Synchronous Functions**: Never use sync functions in production
- **setImmediate Usage**: Break CPU-intensive tasks to prevent blocking
- **Process Management**: Use PM2 or clustering for high-traffic applications

### Memory & Resource Management
- Use streaming for large responses
- Implement proper error boundaries
- Monitor memory usage and clean up resources
- Avoid `console.log()` in production (use structured logging)

## 🔧 Implementation Priorities

### Critical Fixes (High Priority)
1. **Browser Lifecycle Race Conditions** - Preventing crashes and resource leaks
2. **Transaction Atomicity** - Ensuring data consistency
3. **API Timeout Handling** - Graceful fallback strategies

### Performance Optimizations (Medium Priority)
1. **Exponential Backoff Implementation** - Reducing API failures
2. **Concurrent Request Handling** - Improving throughput
3. **Resource Pool Management** - Better resource utilization

### Monitoring & Observability (Low Priority)
1. **Comprehensive Error Logging** - Better debugging
2. **Performance Metrics** - System health monitoring
3. **Rate Limit Tracking** - Proactive limit management

---
*Last Updated: September 2025*
*Based on: Official documentation, community best practices, and production experience*