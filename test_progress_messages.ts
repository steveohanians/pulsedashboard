#!/usr/bin/env node

/**
 * Quick Test: Progress Message Flow
 * 
 * Tests the new centralized progress tracking system to ensure
 * it provides smooth, forward-only progress updates.
 */

import { effectivenessService } from './server/services/EffectivenessService.js';

async function testProgressFlow() {
  console.log('\n========================================');
  console.log('  PROGRESS TRACKING TEST');
  console.log('========================================\n');

  try {
    // Start analysis for demo client
    console.log('🚀 Starting analysis...');
    const { runId } = await effectivenessService.startAnalysis('demo-client-id', true);
    console.log(`✓ Analysis started with runId: ${runId.slice(0, 8)}\n`);

    // Monitor progress for 30 seconds
    const progressHistory: Array<{time: number, progress: number, message: string}> = [];
    const startTime = Date.now();
    
    console.log('📊 Monitoring progress (30 seconds)...\n');
    
    const monitorInterval = setInterval(async () => {
      const progress = await effectivenessService.getProgress(runId);
      
      if (progress) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        progressHistory.push({
          time: elapsed,
          progress: progress.progress,
          message: progress.progressDetail
        });
        
        console.log(`[${elapsed}s] ${progress.progress}% | ${progress.progressDetail}`);
        
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(monitorInterval);
          console.log('\n✓ Analysis completed!');
          analyzeProgressSmoothing();
        }
      }
    }, 2000);

    // Stop monitoring after 30 seconds
    setTimeout(() => {
      clearInterval(monitorInterval);
      console.log('\n⏰ Monitoring stopped after 30 seconds');
      analyzeProgressSmoothing();
    }, 30000);

    function analyzeProgressSmoothing() {
      console.log('\n📈 PROGRESS ANALYSIS:');
      console.log('──────────────────────');
      
      let hadBackwardJump = false;
      let maxProgress = 0;
      
      for (let i = 0; i < progressHistory.length; i++) {
        const curr = progressHistory[i];
        if (curr.progress < maxProgress) {
          console.log(`❌ Backward jump detected: ${maxProgress}% → ${curr.progress}% at ${curr.time}s`);
          hadBackwardJump = true;
        }
        maxProgress = Math.max(maxProgress, curr.progress);
      }
      
      if (!hadBackwardJump && progressHistory.length > 0) {
        console.log('✅ No backward progress jumps detected');
        console.log(`✅ Progress range: 0% → ${maxProgress}%`);
      }
      
      console.log(`✅ Total progress updates: ${progressHistory.length}`);
      console.log('\n📋 PROGRESS HISTORY:');
      progressHistory.forEach(p => {
        console.log(`  ${p.time}s: ${p.progress}% - ${p.message}`);
      });
      
      console.log('\n🎉 Progress tracking test completed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run test
testProgressFlow().catch(console.error);