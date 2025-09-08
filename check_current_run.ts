#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { desc } from 'drizzle-orm';

async function checkCurrentRun() {
  console.log('\n=== CHECKING CURRENT RUN STATUS ===\n');
  
  // Get the latest run
  const runs = await db
    .select()
    .from(effectivenessRuns)
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (runs.length === 0) {
    console.log('❌ No runs found!');
    return;
  }
  
  const run = runs[0];
  const age = Date.now() - run.createdAt.getTime();
  const minutes = Math.floor(age / 60000);
  const seconds = Math.floor((age % 60000) / 1000);
  
  console.log(`Run ID: ${run.id}`);
  console.log(`Status: ${run.status}`);
  console.log(`Progress: ${run.progress || '0%'}`);
  console.log(`Progress Detail: ${run.progressDetail}`);
  console.log(`Age: ${minutes}m ${seconds}s`);
  console.log(`Client ID: ${run.clientId}`);
  console.log(`Overall Score: ${run.overallScore || 'N/A'}`);
  
  // Check if it's stuck
  if (run.status === 'initializing' && age > 30000) {
    console.log('\n⚠️  WARNING: Run stuck in initializing state!');
  } else if (run.status === 'analyzing' && run.progress === '0%' && age > 60000) {
    console.log('\n⚠️  WARNING: Run stuck at 0% progress!');
  } else if (run.status === 'analyzing') {
    console.log('\n✅ Run appears to be processing normally');
  }
  
  // Check for criterion scores
  const { criterionScores } = await import('./shared/schema');
  const { eq } = await import('drizzle-orm');
  
  const scores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, run.id));
  
  console.log(`\nCriterion scores saved: ${scores.length}/8`);
  if (scores.length > 0) {
    console.log('Completed criteria:');
    scores.forEach(s => console.log(`  - ${s.criterion}: ${s.score}`));
  }
  
  process.exit(0);
}

checkCurrentRun().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
