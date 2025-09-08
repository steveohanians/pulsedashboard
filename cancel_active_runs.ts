#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { eq, or, and, sql } from 'drizzle-orm';

async function cancelActiveRuns() {
  console.log('\n=== CHECKING FOR ACTIVE EFFECTIVENESS RUNS ===\n');
  
  // Find all runs that are in progress
  const activeRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(or(
      eq(effectivenessRuns.status, 'pending'),
      eq(effectivenessRuns.status, 'initializing'),
      eq(effectivenessRuns.status, 'in_progress')
    ));
  
  if (activeRuns.length === 0) {
    console.log('✅ No active runs found');
    return;
  }
  
  console.log(`Found ${activeRuns.length} active run(s):\n`);
  
  for (const run of activeRuns) {
    const runtime = Date.now() - run.createdAt.getTime();
    const minutes = Math.floor(runtime / 60000);
    const seconds = Math.floor((runtime % 60000) / 1000);
    
    console.log(`Run ID: ${run.id}`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Client ID: ${run.clientId}`);
    console.log(`  Competitor ID: ${run.competitorId || 'N/A (client run)'}`);
    console.log(`  Running for: ${minutes}m ${seconds}s`);
    console.log(`  Progress: ${run.progress || '0%'}`);
    console.log();
  }
  
  console.log('Cancelling all active runs...\n');
  
  // Update all active runs to failed status
  const result = await db
    .update(effectivenessRuns)
    .set({
      status: 'failed',
      progressDetail: JSON.stringify({ 
        error: 'Run cancelled by user',
        cancelledAt: new Date().toISOString()
      })
    })
    .where(or(
      eq(effectivenessRuns.status, 'pending'),
      eq(effectivenessRuns.status, 'initializing'),
      eq(effectivenessRuns.status, 'in_progress')
    ));
  
  console.log(`✅ Cancelled ${activeRuns.length} run(s)`);
  
  process.exit(0);
}

cancelActiveRuns().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
