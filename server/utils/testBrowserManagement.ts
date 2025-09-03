/**
 * Test Browser Resource Management
 * 
 * Verifies that browser recycling, memory management, and resource cleanup
 * work correctly during multi-page scenarios like client + competitor analysis.
 */

import { screenshotService } from '../services/effectiveness/screenshot';
import logger from './logging/logger';

async function testBrowserManagement() {
  console.log('\n=== Testing Browser Resource Management ===\n');
  
  // Monitor initial state
  const initialMemory = process.memoryUsage();
  console.log('Initial memory (MB):', {
    heap: Math.round(initialMemory.heapUsed / 1024 / 1024),
    rss: Math.round(initialMemory.rss / 1024 / 1024)
  });
  
  // Simulate multiple URL captures (like client + 3 competitors)
  const testUrls = [
    'https://example.com',  // Client
    'https://google.com',   // Competitor 1
    'https://github.com',   // Competitor 2
    'https://stackoverflow.com' // Competitor 3
  ];
  
  const results = [];
  
  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n--- Processing ${i === 0 ? 'Client' : `Competitor ${i}`}: ${url} ---`);
    
    try {
      // Simulate multiple page loads per entity (like tier analysis does)
      for (let j = 0; j < 3; j++) {
        console.log(`  Capture ${j + 1}/3 for ${url}`);
        
        // Call the actual method that would be used
        const startTime = Date.now();
        const html = await screenshotService.captureRenderedHTMLOnly(url);
        const duration = Date.now() - startTime;
        
        if (html) {
          console.log(`  ✓ Captured HTML (${html.length} chars) in ${duration}ms`);
        } else {
          console.log(`  ✗ Failed to capture HTML`);
        }
        
        // Check memory after each capture
        const currentMemory = process.memoryUsage();
        console.log(`  Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
        
        // Small delay between captures
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      results.push({ url, success: true });
      
    } catch (error) {
      console.error(`  Error processing ${url}:`, error instanceof Error ? error.message : String(error));
      results.push({ url, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Final cleanup
  await screenshotService.cleanup();
  
  // Final memory check
  const finalMemory = process.memoryUsage();
  const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  
  console.log('\n=== Test Results ===');
  console.log('Processed:', results.length, 'URLs');
  console.log('Successful:', results.filter(r => r.success).length);
  console.log('Failed:', results.filter(r => !r.success).length);
  console.log('\nMemory Analysis:');
  console.log('Initial heap:', Math.round(initialMemory.heapUsed / 1024 / 1024), 'MB');
  console.log('Final heap:', Math.round(finalMemory.heapUsed / 1024 / 1024), 'MB');
  console.log('Growth:', Math.round(memoryGrowth), 'MB');
  console.log('Memory leak likely:', memoryGrowth > 100 ? 'YES ⚠️' : 'NO ✓');
  
  // Check logs for browser recycling
  console.log('\n=== Browser Recycling ===');
  console.log('Check logs for [BROWSER] entries to verify recycling occurred');
  console.log('Expected: Should see recycling after ~10 page loads');
  
  return {
    success: results.filter(r => r.success).length === results.length,
    memoryHealthy: memoryGrowth < 100
  };
}

// Run test immediately
testBrowserManagement()
  .then(result => {
    console.log('\n=== Final Status ===');
    console.log('All captures successful:', result.success ? 'YES ✓' : 'NO ✗');
    console.log('Memory healthy:', result.memoryHealthy ? 'YES ✓' : 'NO ✗');
    process.exit(result.success && result.memoryHealthy ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });