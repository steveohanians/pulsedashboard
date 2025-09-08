#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { eq } from 'drizzle-orm';

async function forceUpdateRun() {
  console.log('\n=== FORCING RUN UPDATE ===\n');
  
  const runId = '0986025a-dcbb-49d7-8d19-477d8ef45d67';
  
  // Update the run to failed so UI can recover
  await db
    .update(effectivenessRuns)
    .set({
      status: 'failed',
      progress: '0%',
      progressDetail: 'Analysis failed - process got stuck during initialization'
    })
    .where(eq(effectivenessRuns.id, runId));
  
  console.log('✅ Updated stuck run to failed status');
  console.log('The UI should now allow you to start a new analysis');
  
  process.exit(0);
}

forceUpdateRun().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
