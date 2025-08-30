import { WebsiteEffectivenessScorer } from './server/services/effectiveness/scorer';
import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

async function testScorerIntegration() {
  console.log('🧪 Testing Scorer Integration with Full-Page Screenshots');
  console.log('==================================================');
  
  try {
    // Create a scorer instance
    const scorer = new WebsiteEffectivenessScorer();
    
    console.log('\n📊 Running effectiveness scoring...');
    
    // Score a website
    const result = await scorer.scoreWebsite('https://www.cleardigital.com');
    
    console.log('\n✅ Scoring completed!');
    console.log('Overall score:', result.overallScore);
    console.log('Criteria count:', result.criterionResults.length);
    console.log('Above-fold screenshot:', result.screenshotUrl);
    console.log('Full-page screenshot:', result.fullPageScreenshotUrl);
    console.log('Screenshot method:', result.screenshotMethod);
    console.log('Screenshot error:', result.screenshotError || 'None');
    console.log('Full-page error:', result.fullPageScreenshotError || 'None');
    
    // Check if we have both screenshots
    if (result.screenshotUrl && result.fullPageScreenshotUrl) {
      console.log('\n🎉 SUCCESS: Both above-fold and full-page screenshots captured!');
    } else if (result.screenshotUrl) {
      console.log('\n⚠️  PARTIAL: Only above-fold screenshot captured');
      console.log('Full-page error:', result.fullPageScreenshotError);
    } else {
      console.log('\n❌ FAILURE: No screenshots captured');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting scorer integration test...');
testScorerIntegration();