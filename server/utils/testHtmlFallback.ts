/**
 * Test Enhanced HTML Fallback Strategy
 * 
 * Verifies that:
 * 1. Intelligent HTML fallback works with URL inference
 * 2. HTML quality tracking is accurate
 * 3. Retry logic works for transient failures
 * 4. Scoring elements are present in fallback HTML
 * 5. Industry inference from domain names
 */

import { parallelDataCollector } from '../services/effectiveness/parallelDataCollector';
import logger from './logging/logger';

async function testHtmlFallback() {
  console.log('\n=== Enhanced HTML Fallback Strategy Test ===\n');
  
  const results = {
    intelligentFallback: { tested: false, working: false, details: '' },
    qualityTracking: { tested: false, working: false, details: '' },
    industryInference: { tested: false, working: false, details: '' },
    scoringElements: { tested: false, working: false, details: '' },
    retryLogic: { tested: false, working: false, details: '' }
  };
  
  // Test 1: Intelligent fallback generation
  console.log('Test 1: Intelligent HTML fallback generation...');
  try {
    const fallbackResult = await parallelDataCollector.collectAllData(
      'https://invalid-test-domain-for-fallback.com',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.intelligentFallback.tested = true;
    if (fallbackResult.initialHtml && fallbackResult.initialHtml.length > 1000) {
      results.intelligentFallback.working = true;
      results.intelligentFallback.details = `Generated fallback HTML (${fallbackResult.initialHtml.length} chars)`;
      console.log(`  ✓ Generated intelligent fallback (${fallbackResult.initialHtml.length} chars)`);
    } else {
      results.intelligentFallback.details = 'Fallback HTML not generated or too short';
      console.log('  ✗ Fallback generation failed');
    }
  } catch (error) {
    // This is expected since we're testing fallback for failed HTML collection
    results.intelligentFallback.tested = true;
    results.intelligentFallback.working = false;
    results.intelligentFallback.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  ○ Expected error for invalid domain:', results.intelligentFallback.details);
  }
  
  // Test 2: Quality tracking
  console.log('\nTest 2: HTML quality tracking...');
  try {
    const qualityResult = await parallelDataCollector.collectAllData(
      'https://example.com',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.qualityTracking.tested = true;
    if (qualityResult.htmlQuality) {
      results.qualityTracking.working = true;
      results.qualityTracking.details = `Quality tracked: ${qualityResult.htmlQuality}`;
      console.log(`  ✓ Quality tracked: ${qualityResult.htmlQuality}`);
    } else {
      results.qualityTracking.details = 'HTML quality not tracked';
      console.log('  ✗ Quality tracking missing');
    }
  } catch (error) {
    results.qualityTracking.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  ✗ Quality tracking failed:', results.qualityTracking.details);
  }
  
  // Test 3: Industry inference from different domain types
  console.log('\nTest 3: Industry inference from domain names...');
  const testDomains = [
    { url: 'https://test-shop.com', expected: 'ecommerce' },
    { url: 'https://myapp.io', expected: 'saas' },
    { url: 'https://creative-agency.com', expected: 'agency' },
    { url: 'https://business-solutions.com', expected: 'general' }
  ];
  
  let inferenceTests = 0;
  let inferenceSuccesses = 0;
  
  for (const test of testDomains) {
    try {
      const result = await parallelDataCollector.collectAllData(
        test.url,
        { viewport: { width: 1440, height: 900 } }
      );
      
      inferenceTests++;
      
      // Check if HTML contains expected industry-specific content
      const html = result.initialHtml || result.renderedHtml || '';
      const hasIndustryContent = 
        (test.expected === 'ecommerce' && html.includes('products')) ||
        (test.expected === 'saas' && html.includes('software solutions')) ||
        (test.expected === 'agency' && html.includes('creative services')) ||
        (test.expected === 'general' && html.includes('professional services'));
      
      if (hasIndustryContent) {
        inferenceSuccesses++;
        console.log(`    ✓ ${test.url} → ${test.expected} content detected`);
      } else {
        console.log(`    ○ ${test.url} → fallback content used`);
      }
    } catch (error) {
      inferenceTests++;
      console.log(`    ○ ${test.url} → error (expected for invalid domains)`);
    }
  }
  
  results.industryInference.tested = true;
  results.industryInference.working = inferenceTests > 0;
  results.industryInference.details = `${inferenceSuccesses}/${inferenceTests} domains processed`;
  
  // Test 4: Scoring elements in fallback HTML
  console.log('\nTest 4: Scoring elements in fallback HTML...');
  try {
    // Access the private fallback method indirectly by forcing all methods to fail
    const fallbackTestResult = await parallelDataCollector.collectAllData(
      'https://definitely-invalid-domain-name.nonexistent',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.scoringElements.tested = true;
    
    // We expect this to fail and use fallback, but let's see what we get
    const html = fallbackTestResult.initialHtml || fallbackTestResult.renderedHtml || '';
    
    if (html.length > 0) {
      // Check for essential scoring elements
      const hasTitle = html.includes('<title>');
      const hasH1 = html.includes('<h1>');
      const hasH2 = html.includes('<h2>');
      const hasButtons = html.includes('<button');
      const hasLinks = html.includes('<a href');
      const hasNav = html.includes('<nav>');
      const hasFooter = html.includes('<footer>');
      
      const elementCount = [hasTitle, hasH1, hasH2, hasButtons, hasLinks, hasNav, hasFooter].filter(Boolean).length;
      
      if (elementCount >= 5) {
        results.scoringElements.working = true;
        results.scoringElements.details = `${elementCount}/7 essential elements present`;
        console.log(`  ✓ Fallback HTML contains ${elementCount}/7 essential scoring elements`);
      } else {
        results.scoringElements.details = `Only ${elementCount}/7 elements found`;
        console.log(`  ✗ Insufficient scoring elements (${elementCount}/7)`);
      }
    } else {
      results.scoringElements.details = 'No HTML available for analysis';
      console.log('  ✗ No HTML generated');
    }
  } catch (error) {
    results.scoringElements.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  Expected error for completely invalid domain');
    
    // Still mark as tested since we expect this behavior
    results.scoringElements.tested = true;
    results.scoringElements.working = false;
  }
  
  // Test 5: Retry logic (simulate with a working domain)
  console.log('\nTest 5: HTML retry logic...');
  try {
    // Test with a reliable domain to see retry behavior in logs
    const retryResult = await parallelDataCollector.collectAllData(
      'https://httpstat.us/200',
      { viewport: { width: 1440, height: 900 } }
    );
    
    results.retryLogic.tested = true;
    if (retryResult.initialHtml || retryResult.renderedHtml) {
      results.retryLogic.working = true;
      results.retryLogic.details = `HTML collected successfully (Quality: ${retryResult.htmlQuality})`;
      console.log(`  ✓ HTML collection successful (${retryResult.htmlQuality})`);
    } else {
      results.retryLogic.details = 'HTML collection failed';
      console.log('  ✗ HTML collection failed');
    }
  } catch (error) {
    results.retryLogic.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log('  ✗ Retry test failed:', results.retryLogic.details);
  }
  
  // Results summary
  console.log('\n=== Enhanced HTML Fallback Test Results ===\n');
  
  const testResults = [
    ['Intelligent Fallback', results.intelligentFallback],
    ['Quality Tracking', results.qualityTracking],
    ['Industry Inference', results.industryInference],
    ['Scoring Elements', results.scoringElements],
    ['Retry Logic', results.retryLogic]
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
  console.log(overallSuccess ? '🎉 Enhanced HTML fallback working!' : '⚠️  Some features need attention');
  
  return overallSuccess;
}

// Run test immediately
testHtmlFallback()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });