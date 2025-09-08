#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores } from './shared/schema';
import { eq, lt, sql } from 'drizzle-orm';

async function clearOldRuns() {
  console.log('\n=== CLEARING OLD EFFECTIVENESS RUNS ===\n');
  
  // Get all runs older than 5 minutes
  const cutoffTime = new Date(Date.now() - 5 * 60 * 1000);
  
  const oldRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(lt(effectivenessRuns.createdAt, cutoffTime));
  
  if (oldRuns.length === 0) {
    console.log('No old runs to clear');
    return;
  }
  
  console.log(`Found ${oldRuns.length} run(s) older than 5 minutes\n`);
  
  // Delete criterion scores for old runs
  let totalScoresDeleted = 0;
  for (const run of oldRuns) {
    const deleted = await db
      .delete(criterionScores)
      .where(eq(criterionScores.runId, run.id));
    
    console.log(`Deleted scores for run ${run.id.slice(0, 8)}...`);
    totalScoresDeleted++;
  }
  
  // Delete the old runs
  const deletedRuns = await db
    .delete(effectivenessRuns)
    .where(lt(effectivenessRuns.createdAt, cutoffTime));
  
  console.log(`\n✅ Cleared ${oldRuns.length} old run(s) and their associated scores`);
  
  // Show remaining runs
  const remainingRuns = await db
    .select()
    .from(effectivenessRuns);
  
  console.log(`\n📊 Remaining runs: ${remainingRuns.length}`);
  
  if (remainingRuns.length > 0) {
    for (const run of remainingRuns) {
      const age = Date.now() - run.createdAt.getTime();
      const seconds = Math.floor(age / 1000);
      console.log(`  - ${run.id.slice(0, 8)}... (${seconds}s old, status: ${run.status})`);
    }
  }
  
  process.exit(0);
}

clearOldRuns().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
