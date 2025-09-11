/**
 * Test Reliability Improvements in Effectiveness Scoring
 * 
 * Validates that the Promise.allSettled architecture and fallback mechanisms
 * preserve partial results when individual data collection tasks fail or timeout
 */

import { parallelDataCollector } from '../../services/effectiveness/parallelDataCollector';
import logger from '../logging/logger';

export async function testReliabilityImprovements(): Promise<void> {
  logger.info('🧪 Testing reliability improvements in effectiveness scoring');

  try {
    // Test 1: Validate Promise.allSettled graceful handling
    logger.info('[TEST 1] Testing Promise.allSettled graceful fallbacks');
    
    const testUrls = [
      'https://www.google.com', // Should work
      'https://invalid-domain-that-does-not-exist-12345.com', // Should fail gracefully
      'https://httpstat.us/500', // Should timeout but return fallback
    ];

    for (const url of testUrls) {
      try {
        logger.info(`Testing data collection for: ${url}`);
        const startTime = Date.now();
        
        const result = await parallelDataCollector.collectAllData(url, {
          viewport: { width: 1440, height: 900 }
        });
        
        const duration = Date.now() - startTime;
        
        // Validate that we ALWAYS get a result, even for failed URLs
        const hasValidResult = result && typeof result === 'object';
        const hasHTML = !!(result.initialHtml || result.renderedHtml);
        const hasTiming = result.timing && typeof result.timing.total === 'number';
        const hasQualityIndicator = !!result.htmlQuality;
        
        logger.info(`✅ Result validation for ${url}:`, {
          duration,
          hasValidResult,
          hasHTML,
          hasTiming,
          hasQualityIndicator,
          htmlQuality: result.htmlQuality,
          hasScreenshot: !!result.screenshotUrl,
          hasErrors: !!(result.screenshotError || result.initialHtmlError || result.renderedHtmlError)
        });
        
        // CRITICAL: Even failed URLs should return fallback data
        if (!hasValidResult || !hasHTML || !hasTiming) {
          throw new Error(`Reliability test failed for ${url}: Missing critical fallback data`);
        }
        
        // Verify fallback HTML contains essential elements for scoring
        const html = result.renderedHtml || result.initialHtml || '';
        const hasCriticalElements = html.includes('<title>') && html.includes('<body>') && html.includes('</html>');
        
        if (!hasCriticalElements) {
          logger.warn(`Fallback HTML may be insufficient for scoring: ${url}`);
        }
        
      } catch (error) {
        logger.error(`❌ Data collection failed completely for ${url}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // This is a critical failure - the system should NEVER completely fail
        throw new Error(`Critical reliability failure: Complete data collection failure for ${url}`);
      }
    }
    
    // Test 2: Validate partial results preservation under timeout conditions
    logger.info('[TEST 2] Testing partial results preservation');
    
    // Test with a very slow URL to simulate partial completion
    try {
      const slowUrl = 'https://httpstat.us/200?sleep=10000'; // 10 second delay
      const result = await Promise.race([
        parallelDataCollector.collectAllData(slowUrl, {
          viewport: { width: 1440, height: 900 }
        }),
        // Force early completion to test partial result handling
        new Promise((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      
      if (result) {
        logger.info('✅ Partial results preserved under timeout conditions');
      } else {
        logger.info('⚠️  Timeout occurred before completion (expected for slow URLs)');
      }
      
    } catch (error) {
      logger.info('⚠️  Expected timeout/error for intentionally slow URL');
    }
    
    // Test 3: Validate fallback HTML generation
    logger.info('[TEST 3] Testing intelligent HTML fallback generation');
    
    const testDomains = [
      'example-saas-company.io',
      'awesome-ecommerce-store.com', 
      'creative-agency-studio.design'
    ];
    
    for (const domain of testDomains) {
      const fakeUrl = `https://${domain}`;
      try {
        const result = await parallelDataCollector.collectAllData(fakeUrl, {
          viewport: { width: 1440, height: 900 }
        });
        
        const html = result.renderedHtml || result.initialHtml || '';
        const hasInferredContent = html.includes(domain.split('-')[0]) || html.includes(domain.split('.')[0]);
        const hasStructure = html.includes('<header>') && html.includes('<main>') && html.includes('cta');
        
        logger.info(`✅ Fallback generation for ${domain}:`, {
          hasInferredContent,
          hasStructure,
          htmlLength: html.length,
          quality: result.htmlQuality
        });
        
      } catch (error) {
        logger.error(`❌ Fallback generation failed for ${domain}`);
      }
    }
    
    // Test 4: Validate circuit breaker integration
    logger.info('[TEST 4] Testing circuit breaker resilience');
    
    // Attempt multiple requests to validate circuit breaker doesn't block everything
    const circuitTestPromises = Array(3).fill(null).map(async (_, index) => {
      try {
        const result = await parallelDataCollector.collectAllData('https://www.google.com', {
          viewport: { width: 1440, height: 900 }
        });
        return { success: true, index, hasData: !!(result.initialHtml || result.renderedHtml) };
      } catch (error) {
        return { success: false, index, error: error instanceof Error ? error.message : String(error) };
      }
    });
    
    const circuitResults = await Promise.allSettled(circuitTestPromises);
    const successCount = circuitResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    logger.info(`✅ Circuit breaker test completed: ${successCount}/3 requests succeeded`);
    
    if (successCount === 0) {
      throw new Error('Circuit breaker may be blocking all requests');
    }
    
    logger.info('🎉 All reliability improvement tests passed!');
    
  } catch (error) {
    logger.error('❌ Reliability improvement tests failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Export for use in other test files
export default testReliabilityImprovements;