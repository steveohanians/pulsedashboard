import { effectivenessService } from './server/services/EffectivenessService.js';
import logger from './server/utils/logging/logger.js';

async function testLiveAnalysis() {
  try {
    console.log('🔥 STARTING LIVE EFFECTIVENESS ANALYSIS');
    console.log('This will show us exactly what happens during competitor processing...\n');
    
    const service = effectivenessService;
    
    // Start analysis for demo-client-id (has competitors: stripe.com, monday.com)
    console.log('💫 Starting analysis for demo-client-id');
    const result = await service.startAnalysis('demo-client-id', true); // force = true
    
    console.log('✅ Analysis started with runId:', result.runId);
    console.log('\n📊 Now monitoring progress...');
    console.log('(Check server logs to see competitor progress messages)\n');
    
    // Monitor progress for 3 minutes
    let lastPercent = 0;
    const startTime = Date.now();
    const timeoutTime = 3 * 60 * 1000; // 3 minutes
    
    const progressInterval = setInterval(async () => {
      try {
        const progress = await service.getProgress(result.runId);
        
        if (progress) {
          const percent = progress.progress?.overallPercent || 0;
          
          if (percent !== lastPercent) {
            console.log(`📈 Progress: ${percent}% - ${progress.progressDetail}`);
            lastPercent = percent;
          }
          
          if (progress.status === 'completed') {
            console.log('🎉 ANALYSIS COMPLETED!');
            clearInterval(progressInterval);
            
            // Get final results
            const results = await service.getLatestResults('demo-client-id');
            console.log('📊 Final Score:', results?.overallScore || 'No score');
            
            process.exit(0);
          }
          
          if (progress.status === 'failed') {
            console.log('❌ ANALYSIS FAILED:', progress.progressDetail);
            clearInterval(progressInterval);
            process.exit(1);
          }
        }
        
        // Timeout after 3 minutes
        if (Date.now() - startTime > timeoutTime) {
          console.log('⏰ TIMEOUT: Analysis taking too long');
          clearInterval(progressInterval);
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Progress check error:', error.message);
      }
    }, 2000); // Check every 2 seconds
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLiveAnalysis();