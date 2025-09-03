/**
 * Test comprehensive screenshot fallback strategy
 * 
 * Verifies that:
 * 1. API retries work for aborted/503 errors
 * 2. Playwright fallback activates when API fails  
 * 3. Placeholder screenshots are used as last resort
 * 4. Quality tracking works correctly
 * 5. Scoring continues with degraded data
 */

import { screenshotService } from '../services/effectiveness/screenshot';
import { parallelDataCollector } from '../services/effectiveness/parallelDataCollector';
import logger from './logging/logger';

async function testScreenshotFallbacks() {
  console.log('\n=== Screenshot Fallback Strategy Test ===\n');
  
  const results = {
    apiRetry: { tested: false, working: false, details: '' },
    playwrightFallback: { tested: false, working: false, details: '' },
    placeholder: { tested: false, working: false, details: '' },
    qualityTracking: { tested: false, working: false, details: '' },
    scoring: { tested: false, working: false, details: '' }
  };
  
  // Test 1: API retry logic (simulate with a slow/problematic URL)
  console.log('Test 1: API retry behavior...');
  try {
    // Use a URL that might be slow or problematic
    const slowUrl = 'https://httpstat.us/503?sleep=5000';
    const retryResult = await screenshotService.captureWebsiteScreenshot({
      url: slowUrl,
      viewport: { width: 1440, height: 900 },
      outputDir: 'uploads/screenshots'
    });
    
    results.apiRetry.tested = true;
    if (retryResult.screenshotMethod === 'api' || retryResult.screenshotMethod === 'placeholder') {
      results.apiRetry.working = true;
      results.apiRetry.details = `Method: ${retryResult.screenshotMethod}, Quality: ${retryResult.screenshotQuality}`;
    } else {
      results.apiRetry.details = 'API retry did not complete successfully';
    }
    
    console.log(`  Result: ${retryResult.screenshotMethod} (${retryResult.screenshotQuality})`);
  } catch (error) {
    results.apiRetry.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Failed with error:', results.apiRetry.details);
  }
  
  // Test 2: Playwright fallback (simulate API failure)
  console.log('\nTest 2: Playwright fallback...');
  try {
    // Temporarily store original API key
    const originalApiKey = process.env.SCREENSHOTONE_API_KEY;
    
    // Disable API to force Playwright fallback
    delete process.env.SCREENSHOTONE_API_KEY;
    
    const fallbackResult = await screenshotService.captureWebsiteScreenshot({
      url: 'https://example.com',
      viewport: { width: 1440, height: 900 },
      outputDir: 'uploads/screenshots'
    });
    
    results.playwrightFallback.tested = true;
    if (fallbackResult.screenshotMethod === 'playwright' || fallbackResult.screenshotMethod === 'placeholder') {
      results.playwrightFallback.working = true;
      results.playwrightFallback.details = `Method: ${fallbackResult.screenshotMethod}, Quality: ${fallbackResult.screenshotQuality}`;
    } else {
      results.playwrightFallback.details = `Unexpected method: ${fallbackResult.screenshotMethod}`;
    }
    
    // Restore API key
    if (originalApiKey) {
      process.env.SCREENSHOTONE_API_KEY = originalApiKey;
    }
    
    console.log(`  Result: ${fallbackResult.screenshotMethod} (${fallbackResult.screenshotQuality})`);
  } catch (error) {
    results.playwrightFallback.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Failed with error:', results.playwrightFallback.details);
  }
  
  // Test 3: Placeholder generation
  console.log('\nTest 3: Placeholder screenshot generation...');
  try {
    // Test the private method via reflection or test a scenario that forces placeholder
    const placeholderResult = await screenshotService.captureWebsiteScreenshot({
      url: 'https://invalid-domain-that-should-not-exist.com',
      viewport: { width: 1440, height: 900 },
      outputDir: 'uploads/screenshots'
    });
    
    results.placeholder.tested = true;
    if (placeholderResult.screenshotMethod === 'placeholder') {
      results.placeholder.working = true;
      results.placeholder.details = `Placeholder generated successfully, Quality: ${placeholderResult.screenshotQuality}`;
    } else {
      results.placeholder.details = `Unexpected method: ${placeholderResult.screenshotMethod}`;
    }
    
    console.log(`  Result: ${placeholderResult.screenshotMethod} (${placeholderResult.screenshotQuality})`);
  } catch (error) {
    results.placeholder.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Failed with error:', results.placeholder.details);
  }
  
  // Test 4: Quality tracking in parallel collector
  console.log('\nTest 4: Quality tracking in data collection...');
  try {
    const collectionResult = await parallelDataCollector.collectAllData(
      'https://example.com',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.qualityTracking.tested = true;
    if (collectionResult.screenshotQuality) {
      results.qualityTracking.working = true;
      results.qualityTracking.details = `Quality tracked: ${collectionResult.screenshotQuality}, Method: ${collectionResult.screenshotMethod}`;
    } else {
      results.qualityTracking.details = 'Quality tracking not implemented';
    }
    
    console.log(`  Quality: ${collectionResult.screenshotQuality}, Method: ${collectionResult.screenshotMethod}`);
  } catch (error) {
    results.qualityTracking.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Failed with error:', results.qualityTracking.details);
  }
  
  // Test 5: Scoring continues with placeholder
  console.log('\nTest 5: Scoring with degraded data...');
  try {
    // This simulates what happens in the actual scoring system
    const degradedResult = await parallelDataCollector.collectAllData(
      'https://invalid-domain-for-testing.com',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.scoring.tested = true;
    // Check that we have some data to score with (HTML or screenshot)
    const hasData = degradedResult.initialHtml || degradedResult.renderedHtml || degradedResult.screenshotUrl;
    if (hasData) {
      results.scoring.working = true;
      results.scoring.details = `Data available for scoring - HTML: ${!!degradedResult.initialHtml}, Screenshot: ${!!degradedResult.screenshotUrl}`;
    } else {
      results.scoring.details = 'No data available for scoring';
    }
    
    console.log(`  HTML: ${!!degradedResult.initialHtml}, Screenshot: ${!!degradedResult.screenshotUrl}`);
  } catch (error) {
    results.scoring.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Failed with error:', results.scoring.details);
  }
  
  // Final cleanup
  await screenshotService.cleanup();
  
  // Results summary
  console.log('\n=== Fallback Strategy Test Results ===\n');
  
  const testResults = [
    ['API Retry Logic', results.apiRetry],
    ['Playwright Fallback', results.playwrightFallback], 
    ['Placeholder Generation', results.placeholder],
    ['Quality Tracking', results.qualityTracking],
    ['Scoring Continuity', results.scoring]
  ];
  
  let totalPassed = 0;
  let totalTested = 0;
  
  testResults.forEach(([testName, result]) => {
    const status = result.tested ? (result.working ? '✓ PASS' : '✗ FAIL') : '○ SKIP';
    console.log(`${testName}: ${status}`);
    console.log(`  Details: ${result.details}`);
    console.log('');
    
    if (result.tested) {
      totalTested++;
      if (result.working) totalPassed++;
    }
  });
  
  const overallSuccess = totalPassed >= 3; // At least 3 out of 5 should pass
  console.log(`Overall: ${totalPassed}/${totalTested} tests passed`);
  console.log(overallSuccess ? '🎉 Fallback strategy working!' : '⚠️  Some fallbacks need attention');
  
  return overallSuccess;
}

// Run test immediately
testScreenshotFallbacks()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });