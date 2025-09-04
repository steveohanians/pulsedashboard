#!/usr/bin/env tsx
/**
 * Test file to isolate and fix effectiveness scoring bugs
 * Run with: NODE_ENV=development npx tsx test_effectiveness_bugs.ts
 */

import { EnhancedWebsiteEffectivenessScorer } from './server/services/effectiveness/enhancedScorer';
import { screenshotService } from './server/services/effectiveness/screenshot';
import { storage } from './server/storage';
import logger from './server/utils/logging/logger';

async function testBrowserLifecycle() {
  console.log('\n🔧 Testing Browser Lifecycle Management...');
  
  try {
    // Test browser creation and cleanup
    await screenshotService.cleanup(); // Start fresh
    
    // Test multiple concurrent operations
    const urls = [
      'https://www.cleardigital.com',
      'https://clay.global', 
      'https://baunfire.com'
    ];
    
    console.log('Testing concurrent screenshot capture...');
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const result = await screenshotService.captureWebsiteScreenshot({ url });
          return { url, success: true, result };
        } catch (error) {
          return { url, success: false, error: error.message };
        }
      })
    );
    
    console.log('Results:', results.map(r => 
      r.status === 'fulfilled' ? r.value : { error: r.reason }
    ));
    
    // Test cleanup
    await screenshotService.cleanup();
    console.log('✅ Browser cleanup completed');
    
  } catch (error) {
    console.error('❌ Browser lifecycle test failed:', error.message);
  }
}

async function testCriterionScoring() {
  console.log('\n🔧 Testing Criterion Scoring Consistency...');
  
  const scorer = new EnhancedWebsiteEffectivenessScorer();
  
  try {
    // Test with a simple URL to ensure all 8 criteria are scored
    const mockContext = {
      websiteUrl: 'https://example.com',
      html: '<html><head><title>Test</title></head><body><h1>Test</h1><p>Test content</p></body></html>',
      screenshotUrl: null,
      fullPageScreenshotUrl: null,
      webVitals: null
    };
    
    console.log('Testing all criterion scorers...');
    
    // Import all criteria functions
    const { scoreUX } = await import('./server/services/effectiveness/criteria/ux');
    const { scoreTrust } = await import('./server/services/effectiveness/criteria/trust');
    const { scoreAccessibility } = await import('./server/services/effectiveness/criteria/accessibility');
    const { scoreSEO } = await import('./server/services/effectiveness/criteria/seo');
    const { scorePositioning } = await import('./server/services/effectiveness/criteria/positioning');
    const { scoreBrandStory } = await import('./server/services/effectiveness/criteria/brandStory');
    const { scoreCTAs } = await import('./server/services/effectiveness/criteria/ctas');
    const { scoreSpeed } = await import('./server/services/effectiveness/criteria/speed');
    
    const config = {
      viewport: { width: 1440, height: 900 },
      thresholds: { lcp_limit: 2.5, cls_limit: 0.1 },
      openai: { model: 'gpt-4o', enabled: true }
    };
    
    const criteriaTests = [
      { name: 'UX', fn: scoreUX },
      { name: 'Trust', fn: scoreTrust },
      { name: 'Accessibility', fn: scoreAccessibility },
      { name: 'SEO', fn: scoreSEO },
      { name: 'Positioning', fn: scorePositioning },
      { name: 'Brand Story', fn: scoreBrandStory },
      { name: 'CTAs', fn: scoreCTAs },
      { name: 'Speed', fn: scoreSpeed }
    ];
    
    for (const test of criteriaTests) {
      try {
        console.log(`Testing ${test.name}...`);
        const result = await test.fn(mockContext, config);
        console.log(`✅ ${test.name}: Score ${result.score}`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Criterion scoring test failed:', error.message);
  }
}

async function testDatabaseConsistency() {
  console.log('\n🔧 Testing Database Consistency...');
  
  try {
    // Check for runs with missing criterion scores
    console.log('Checking recent effectiveness runs...');
    
    const run = await storage.getLatestEffectivenessRun('demo-client-id');
    if (run) {
      console.log(`Found latest run: ${run.id.substring(0, 8)}... (${run.status})`);
      const scores = await storage.getCriterionScores(run.id);
      console.log(`Run has ${scores.length} criteria scored`);
      
      if (scores.length !== 8 && run.status === 'completed') {
        console.log(`⚠️  Incomplete run detected: ${run.id}`);
        const missingCriteria = ['ux', 'trust', 'accessibility', 'seo', 'positioning', 'brand_story', 'ctas', 'speed']
          .filter(criterion => !scores.some(s => s.criterion === criterion));
        console.log(`Missing: ${missingCriteria.join(', ')}`);
      } else {
        console.log('✅ Database consistency check passed');
      }
    } else {
      console.log('No runs found for demo client');
    }
    
  } catch (error) {
    console.error('❌ Database consistency test failed:', error.message);
  }
}

async function testScreenshotFallbacks() {
  console.log('\n🔧 Testing Screenshot Fallback Logic...');
  
  try {
    // Test API vs Playwright fallback
    const testUrls = [
      { url: 'https://httpbin.org/delay/10', expectedFallback: true }, // Should timeout
      { url: 'https://www.cleardigital.com', expectedFallback: false } // Should succeed
    ];
    
    for (const test of testUrls) {
      console.log(`Testing ${test.url}...`);
      try {
        const result = await screenshotService.captureWebsiteScreenshot({ url: test.url });
        console.log(`Method used: ${result.screenshotMethod || 'unknown'}`);
        console.log(`Success: ${!!result.screenshotUrl}`);
      } catch (error) {
        console.log(`Failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Screenshot fallback test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Effectiveness Bug Tests\n');
  
  await testBrowserLifecycle();
  await testCriterionScoring(); 
  await testDatabaseConsistency();
  await testScreenshotFallbacks();
  
  console.log('\n✅ All tests completed');
  process.exit(0);
}

// Run tests if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runAllTests().catch(console.error);
}

export { testBrowserLifecycle, testCriterionScoring, testDatabaseConsistency, testScreenshotFallbacks };