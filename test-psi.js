const { scoreSpeed } = require('./server/services/effectiveness/criteria/speed.ts');

async function testPSI() {
  try {
    console.log('=== TESTING ENHANCED PSI ON CLAY.GLOBAL ===');
    
    const context = {
      websiteUrl: 'https://clay.global',
      webVitals: null
    };
    
    const config = {
      thresholds: {
        lcp_limit: 4,
        cls_limit: 0.25
      }
    };
    
    console.log('Starting speed analysis...');
    const start = Date.now();
    const result = await scoreSpeed(context, config);
    const duration = Math.round((Date.now() - start) / 1000);
    
    console.log(`\n=== RESULTS (took ${duration}s) ===`);
    console.log('Final Score:', result.score);
    console.log('Description:', result.evidence.description);
    console.log('API Status:', result.evidence.details.apiStatus);
    
    if (result.evidence.details.fallbackReason) {
      console.log('Fallback Reason:', result.evidence.details.fallbackReason);
      console.log('Attempts:', result.evidence.details.attempts);
    }
    
    if (result.evidence.details.retriesUsed) {
      console.log('Retries Used:', result.evidence.details.retriesUsed);
    }
    
    console.log('Performance Score:', result.evidence.details.performanceScore);
    console.log('Web Vitals:', result.evidence.details.webVitals);
    
    // Verify this is NOT a 0 score
    if (result.score === 0) {
      console.log('❌ PROBLEM: Score is still 0!');
      console.log('Full evidence:', JSON.stringify(result.evidence, null, 2));
    } else {
      console.log('✅ SUCCESS: Non-zero score achieved!');
    }
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
  }
}

testPSI();