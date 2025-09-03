/**
 * Test Script for Request Throttling
 * 
 * Verifies that the RequestThrottler properly throttles Screenshotone API calls
 * with minimum 1-second delays between requests to prevent "aborted" errors.
 */

import { requestThrottler } from './requestThrottler';

// Mock function that simulates API call
async function mockScreenshotAPI(id: string): Promise<void> {
  console.log(`[TEST] API Call ${id} started at:`, new Date().toISOString());
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`[TEST] API Call ${id} completed at:`, new Date().toISOString());
}

// Run test
async function testThrottling() {
  console.log('\n=== Testing Request Throttling ===\n');
  
  // Simulate client + 3 competitors
  const entities = ['client', 'competitor1', 'competitor2', 'competitor3'];
  
  // Track all promises
  const allPromises = [];
  
  for (const entity of entities) {
    // Queue both screenshots for this entity
    const aboveFold = requestThrottler.throttle(
      'screenshotone',
      () => mockScreenshotAPI(`${entity}-above-fold`)
    );
    
    const fullPage = requestThrottler.throttle(
      'screenshotone', 
      () => mockScreenshotAPI(`${entity}-full-page`)
    );
    
    allPromises.push(aboveFold, fullPage);
  }
  
  // Wait for all to complete and measure time
  const startTime = Date.now();
  await Promise.all(allPromises);
  const totalTime = Date.now() - startTime;
  
  console.log(`\n=== Results ===`);
  console.log(`Total execution time: ${totalTime}ms`);
  console.log(`Expected minimum time (8 calls * 1000ms): 8000ms`);
  console.log(`Throttling working: ${totalTime >= 7900 ? 'YES ✓' : 'NO ✗'}`);
  
  // Show queue status
  const queueStatus = requestThrottler.getQueueStatus();
  console.log(`Final queue status:`, queueStatus);
}

// Run test immediately
testThrottling().catch(console.error);