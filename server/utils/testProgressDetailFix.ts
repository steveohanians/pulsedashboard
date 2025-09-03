/**
 * Quick test to verify progressDetail serialization fix
 */

import { storage } from '../storage';
import { EnhancedWebsiteEffectivenessScorer } from '../services/effectiveness/enhancedScorer';

async function testProgressDetailFix() {
  console.log('\n=== TESTING PROGRESS DETAIL SERIALIZATION FIX ===\n');
  
  try {
    // Create test client
    const testClient = await storage.createClient({
      name: 'Progress Detail Fix Test',
      websiteUrl: 'https://example.com',
      industryVertical: 'test',
      businessSize: 'small'
    });

    // Create test run
    const testRun = await storage.createEffectivenessRun({
      clientId: testClient.id,
      status: 'pending',
      progress: 'Testing progress detail fix...'
    });

    console.log(`✓ Created test run: ${testRun.id}\n`);

    let progressDetailsSaved = 0;
    let lastProgressDetail: any = null;

    const enhancedScorer = new EnhancedWebsiteEffectivenessScorer();
    
    // Start analysis with progress tracking
    const result = await enhancedScorer.scoreWebsiteProgressive(
      'https://example.com',
      testRun.id,
      async (status, progress, results, progressDetail) => {
        console.log(`Progress: ${progress}`);
        
        if (progressDetail) {
          console.log(`   Detail: ${JSON.stringify(progressDetail, null, 2)}`);
          progressDetailsSaved++;
          lastProgressDetail = progressDetail;
        }
      }
    );

    console.log(`\n✓ Analysis completed with score: ${result.overallScore}/10`);
    console.log(`✓ Progress updates with details: ${progressDetailsSaved}`);

    // Check if progressDetail was actually saved to database (embedded in progress field)
    const finalRun = await storage.getEffectivenessRun(testRun.id);
    
    if (finalRun?.progress) {
      try {
        // Try to parse progress as JSON with embedded progressDetail
        const progressData = JSON.parse(finalRun.progress);
        
        if (progressData.progressDetail) {
          console.log('\n🎉 SUCCESS: Progress detail saved to database (embedded in progress field)!');
          console.log('Progress message:', progressData.message);
          console.log('Final progress detail:');
          console.log(JSON.stringify(progressData.progressDetail, null, 2));
          return true;
        } else {
          console.log('\n⚠️ Progress data found but no progressDetail field');
          console.log('Progress data structure:', progressData);
          return false;
        }
      } catch (parseError) {
        console.log('\n❌ FAILED: Progress field is not JSON or missing progressDetail');
        console.log('Raw progress field:');
        console.log(finalRun.progress.substring(0, 200) + '...');
        return false;
      }
    } else {
      console.log('\n❌ FAILED: No progress field saved to database');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Run test
testProgressDetailFix()
  .then(success => {
    console.log('\n' + (success ? 
      '✅ PROGRESS DETAIL SERIALIZATION FIX WORKING!' : 
      '❌ Progress detail serialization still needs work'));
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });

export { testProgressDetailFix };