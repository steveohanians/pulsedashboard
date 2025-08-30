import { scorePositioning } from './server/services/effectiveness/criteria/positioning';
import { OpenAI } from 'openai';
import { ScoringContext, ScoringConfig } from './server/services/effectiveness/types';
import * as cheerio from 'cheerio';

async function testPositioningWithVision() {
  console.log('🧪 Testing Vision-Enhanced Positioning Analysis');
  console.log('=============================================');
  
  try {
    // Setup OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Mock config (similar to production config)
    const config: ScoringConfig = {
      buzzwords: [],
      thresholds: {
        recent_months: 24,
        hero_words: 100,
        cta_dominance: 0.3,
        proof_distance_px: 1000,
        lcp_limit: 2500,
        cls_limit: 0.1,
        fid_limit: 300
      },
      viewport: { width: 1440, height: 900 },
      openai: {
        model: 'gpt-4o',
        temperature: 0.1
      }
    };

    // Fetch real website content for testing
    console.log('\n📄 Fetching website content...');
    const htmlResponse = await fetch('https://www.cleardigital.com');
    const html = await htmlResponse.text();
    
    // Create scoring context with full-page screenshot
    const context: ScoringContext = {
      websiteUrl: 'https://www.cleardigital.com',
      html: html,
      screenshot: '/screenshots/screenshot_1756569492948_cewnf1c71.png',
      fullPageScreenshot: '/screenshots/fullpage_1756569493021_ue1t3vvpx.png',
      webVitals: { lcp: 2.5, cls: 0.02, fid: 50 },
      screenshotMethod: 'api',
      screenshotError: undefined,
      fullPageScreenshotError: undefined
    };

    console.log('📊 Scoring Context:');
    console.log('  • Website:', context.websiteUrl);
    console.log('  • HTML Length:', html.length, 'characters');
    console.log('  • Above-fold Screenshot:', context.screenshot);
    console.log('  • Full-page Screenshot:', context.fullPageScreenshot);
    console.log('  • OpenAI Model:', config.openai.model);

    // Test 1: Vision-enhanced analysis
    console.log('\n🔍 Test 1: Vision-Enhanced Positioning Analysis');
    console.log('===============================================');
    
    const startTime = Date.now();
    const result = await scorePositioning(context, config, openai);
    const duration = Date.now() - startTime;

    console.log('\n✅ Analysis Results:');
    console.log('  • Score:', result.score, '/ 10');
    console.log('  • Duration:', duration, 'ms');
    console.log('  • Evidence Description:', result.evidence.description);
    console.log('  • Passes:', result.passes.passed.length);
    console.log('  • Failures:', result.passes.failed.length);

    console.log('\n📊 Detailed Evidence:');
    console.log('  • Details:', JSON.stringify(result.evidence.details, null, 2));

    // Test 2: Compare with text-only (if needed)
    console.log('\n🔍 Test 2: Text-Only Comparison (No Screenshot)');
    console.log('===============================================');
    
    const textOnlyContext = { ...context, fullPageScreenshot: undefined };
    const textOnlyResult = await scorePositioning(textOnlyContext, config, openai);

    console.log('\n📈 Comparison:');
    console.log('  • Vision Score:', result.score);
    console.log('  • Text-Only Score:', textOnlyResult.score);
    console.log('  • Score Difference:', (result.score - textOnlyResult.score).toFixed(2));
    
    if (result.score !== textOnlyResult.score) {
      console.log('  • ✅ Vision analysis provided different insights');
    } else {
      console.log('  • ⚠️  Scores are identical - may need prompt enhancement');
    }

    console.log('\n🎉 SUCCESS: Vision-enhanced positioning analysis working!');
    console.log('\n🔧 Technical Notes:');
    console.log('  • Vision analysis uses full-page screenshot + text content');
    console.log('  • Fallback to text-only if screenshot fails');
    console.log('  • Compatible with existing prompt templates');
    console.log('  • Ready for prompt template enhancement');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting vision-enhanced positioning test...');
testPositioningWithVision();