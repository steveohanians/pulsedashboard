/**
 * Test screenshot saving directly
 */

import { EffectivenessService } from './server/services/EffectivenessService';
import { db } from './server/db';
import { effectivenessRuns } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testScreenshotSave() {
  console.log('\n=== Testing Screenshot Save ===\n');
  
  const service = new EffectivenessService();
  
  try {
    // Start analysis for client
    console.log('Starting effectiveness analysis...');
    const result = await service.startAnalysis('demo-client-id', true);
    console.log(`Created run: ${result.runId}`);
    
    // Wait a bit for it to complete
    console.log('Waiting for analysis to complete...');
    await new Promise(resolve => setTimeout(resolve, 90000)); // Wait 90 seconds
    
    // Check the run in database
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.id, result.runId));
    
    if (runs.length > 0) {
      const run = runs[0];
      console.log('\nRun Status:', run.status);
      console.log('Screenshot URL:', run.screenshotUrl || 'NULL');
      console.log('Full Page URL:', run.fullPageScreenshotUrl || 'NULL');
      console.log('Overall Score:', run.overallScore);
    } else {
      console.log('Run not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testScreenshotSave();