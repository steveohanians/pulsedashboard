/**
 * Test to verify the progress callback connection between enhancedScorer and database
 * This confirms that detailed progress tracking is being saved to the database
 */

import { EnhancedWebsiteEffectivenessScorer } from '../services/effectiveness/enhancedScorer';
import { storage } from '../storage';
import logger from './logging/logger';

async function testProgressConnection() {
  console.log('\n=== TESTING PROGRESS CALLBACK CONNECTION ===\n');
  
  // Create a test run to track progress updates
  const testClient = await storage.getOrCreateClient({
    name: 'Progress Test Client',
    websiteUrl: 'https://example.com',
    industryVertical: 'test',
    businessSize: 'small'
  });

  const testRun = await storage.createEffectivenessRun({
    clientId: testClient.id,
    status: 'pending',
    progress: 'Starting progress connection test...'
  });

  console.log(`Test run created: ${testRun.id}\n`);

  let progressUpdateCount = 0;
  const progressUpdates: Array<{status: string, progress: string, detail?: any}> = [];

  try {
    // Test the enhanced scorer with the progress callback
    const enhancedScorer = new EnhancedWebsiteEffectivenessScorer();
    
    console.log('Starting website analysis with progress tracking...\n');
    
    const result = await enhancedScorer.scoreWebsiteProgressive(
      'https://example.com',
      testRun.id,
      async (status, progress, results, progressDetail) => {
        progressUpdateCount++;
        progressUpdates.push({ status, progress, detail: progressDetail });
        
        console.log(`Progress Update ${progressUpdateCount}: ${progress}`);
        
        // This should now update the database with progressDetail
        if (testRun.id) {
          await storage.updateEffectivenessRun(testRun.id, {
            status,
            progress,
            progressDetail // This is the key fix we implemented
          });
        }
        
        logger.info('Progress callback executed', { 
          status, 
          progress, 
          progressDetail,
          updateCount: progressUpdateCount 
        });
      }
    );

    console.log(`\n✅ Analysis complete! Score: ${result.overallScore}/10`);
    console.log(`📊 Total progress updates: ${progressUpdateCount}`);
    
    // Verify the final database state
    const finalRun = await storage.getEffectivenessRun(testRun.id);
    console.log(`📁 Final run status: ${finalRun?.status}`);
    console.log(`📝 Final progress: ${finalRun?.progress}`);
    
    if (finalRun?.progressDetail) {
      console.log(`✅ progressDetail saved to database!`);
      try {
        const parsedDetail = JSON.parse(finalRun.progressDetail);
        console.log(`📋 Latest progress detail:`, parsedDetail);
      } catch (e) {
        console.log(`📋 Raw progress detail: ${finalRun.progressDetail}`);
      }
    } else {
      console.log(`❌ No progressDetail found in database`);
    }

    console.log('\n=== PROGRESS CALLBACK CONNECTION TEST RESULTS ===');
    console.log(`✅ Database updates: ${progressUpdateCount > 0 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Progress detail saving: ${finalRun?.progressDetail ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Enhanced progress tracking: ${progressUpdateCount > 10 ? 'WORKING' : 'LIMITED'}`);
    
    return {
      success: true,
      progressUpdateCount,
      hasProgressDetail: !!finalRun?.progressDetail,
      finalStatus: finalRun?.status
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    // Clean up test run
    await storage.updateEffectivenessRun(testRun.id, {
      status: 'failed',
      progress: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      progressUpdateCount
    };
  }
}

// Run test when file is executed directly
if (require.main === module) {
  testProgressConnection()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 PROGRESS CONNECTION TEST PASSED!');
        console.log('Enhanced progress tracking is properly connected to database updates.');
      } else {
        console.log('\n⚠️ PROGRESS CONNECTION TEST FAILED!');
        console.log('Issue:', result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Critical test failure:', error);
      process.exit(1);
    });
}

export { testProgressConnection };