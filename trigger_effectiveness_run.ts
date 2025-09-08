#!/usr/bin/env npx tsx

import { effectivenessService } from './server/services/EffectivenessService';

async function triggerEffectivenessRun() {
  console.log('\n=== TRIGGERING NEW EFFECTIVENESS RUN ===\n');
  
  try {
    // Start analysis for demo-client-id with force=true to bypass cooldown
    const result = await effectivenessService.startAnalysis('demo-client-id', true);
    
    console.log('✅ Analysis started successfully!');
    console.log(`Run ID: ${result.runId}`);
    console.log(`Status: ${result.status}`);
    console.log('\nThe analysis will run in the background.');
    console.log('You can monitor progress in the UI or check logs.');
    
    // Keep process alive for a moment to ensure async processing starts
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Analysis is running. Check the UI for progress updates.');
    
  } catch (error) {
    console.error('❌ Failed to start analysis:', error);
  }
  
  process.exit(0);
}

triggerEffectivenessRun().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
