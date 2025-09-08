#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function checkClientRun() {
  // Get Clear Digital's CLIENT runs (not competitor)
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(5);
  
  console.log('Clear Digital CLIENT runs (not competitor runs):');
  console.log('=' + '='.repeat(60) + '\n');
  
  for (const run of clientRuns) {
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id))
      .orderBy(criterionScores.criterion);
    
    console.log(`Run ${run.id.slice(0,8)}...`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Overall Score: ${run.overallScore}`);
    console.log(`  Created: ${run.createdAt}`);
    console.log(`  Criteria Count: ${scores.length}`);
    
    if (scores.length > 0) {
      console.log('  Scores:');
      for (const score of scores) {
        console.log(`    ${score.criterion}: ${score.score}`);
      }
    }
    console.log();
  }
  
  // Now check what the API would return
  console.log('=== What the API would return (latest run) ===\n');
  
  if (clientRuns.length > 0) {
    const latestRun = clientRuns[0];
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, latestRun.id))
      .orderBy(criterionScores.criterion);
    
    console.log(`This is what should show as CLIENT data in the UI:`);
    console.log(`  Run: ${latestRun.id.slice(0,8)}...`);
    console.log(`  Status: ${latestRun.status}`);
    console.log(`  Overall Score: ${latestRun.overallScore}`);
    
    if (scores.length > 0) {
      console.log('  Criteria:');
      for (const score of scores) {
        console.log(`    ${score.criterion}: ${score.score}`);
      }
    } else {
      console.log('  NO CRITERION SCORES!');
    }
    
    // Check for speed specifically
    const speedScore = scores.find(s => s.criterion === 'speed');
    console.log(`\n  SPEED SCORE: ${speedScore ? speedScore.score : 'NOT FOUND'}`);
    console.log(`\n  If this shows 4.5, then it's Monday's score being used for the client!`);
  }
  
  process.exit(0);
}

checkClientRun().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});