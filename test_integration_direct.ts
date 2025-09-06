import { createProgressTracker, clearProgressTracker } from './server/services/effectiveness/progressTracker';
import { EnhancedWebsiteEffectivenessScorer } from './server/services/effectiveness/enhancedScorer';

console.log('🔧 Testing complete progressTracker integration...\n');

async function testIntegration() {
  // Clear any existing tracker
  clearProgressTracker();
  
  // Create a new tracker
  const tracker = createProgressTracker();
  console.log('1. Tracker created:', tracker.getProgressString());
  
  // Start client analysis
  tracker.startClient('Test Client');
  console.log('2. Client started:', tracker.getProgressString());
  
  // Create scorer and test the callback
  const scorer = new EnhancedWebsiteEffectivenessScorer();
  
  console.log('\n🧪 Testing scoring with progress callback...');
  
  let callbackCount = 0;
  const progressCallback = async (status: string, progress: string, results: any, progressDetail: any) => {
    callbackCount++;
    console.log(`📞 Callback ${callbackCount}:`, {
      status,
      phase: progressDetail?.phase,
      subPhase: progressDetail?.subPhase,
      criterionName: progressDetail?.criterionName
    });
    
    // Simulate what effectivenessRoutes does
    if (progressDetail?.phase === 'criterion_analysis' && progressDetail?.subPhase === 'criterion_complete') {
      const criterionName = progressDetail.criterionName || 'unknown';
      tracker.completeCriterion(criterionName, true);
      console.log(`   ✅ Tracked criterion completion: ${criterionName}`);
      console.log(`   📊 Progress now: ${tracker.getProgressString()} (${tracker.getState().overallPercent}%)`);
    }
  };
  
  try {
    // Use a simple website for testing
    const result = await scorer.scoreWebsiteProgressive('https://example.com', 'test-run-id', progressCallback);
    console.log('\n✅ Scoring completed successfully');
    
    console.log('\n📊 Final tracker state:');
    console.log('   Message:', tracker.getProgressString());
    console.log('   Percentage:', tracker.getState().overallPercent);
    console.log('   Phase:', tracker.getState().currentPhase);
    console.log('   Client Complete:', tracker.getState().clientComplete);
    
  } catch (error) {
    console.log('\n❌ Scoring failed:', error instanceof Error ? error.message : error);
  }
}

testIntegration().catch(console.error);