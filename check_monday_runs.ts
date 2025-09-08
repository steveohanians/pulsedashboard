#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores, competitors } from './shared/schema';
import { eq, and, desc } from 'drizzle-orm';

async function checkMondayRuns() {
  // Get Monday competitor
  const mondayCompetitor = await db
    .select()
    .from(competitors)
    .where(eq(competitors.label, 'Monday'))
    .limit(1);

  if (mondayCompetitor.length === 0) {
    console.log('Monday competitor not found');
    return;
  }

  console.log(`Monday competitor: ${mondayCompetitor[0].label} (${mondayCompetitor[0].domain})\n`);

  // Get all runs for Monday
  const runs = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      eq(effectivenessRuns.competitorId, mondayCompetitor[0].id)
    ))
    .orderBy(desc(effectivenessRuns.createdAt));

  console.log(`Found ${runs.length} Monday.com runs:\n`);
  
  for (const run of runs) {
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id))
      .orderBy(criterionScores.criterion);
    
    console.log(`Run ${run.id.slice(0,8)}...`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Overall Score: ${run.overallScore}`);
    console.log(`  Created: ${run.createdAt}`);
    console.log(`  Criteria: ${scores.map(s => `${s.criterion}:${s.score}`).join(', ')}`);
    console.log();
  }

  // Now check what the API would return
  console.log('=== What the API returns (latest COMPLETED run) ===\n');
  
  const latestCompleted = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      eq(effectivenessRuns.competitorId, mondayCompetitor[0].id),
      eq(effectivenessRuns.status, 'completed')
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);

  if (latestCompleted.length > 0) {
    const run = latestCompleted[0];
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id))
      .orderBy(criterionScores.criterion);
    
    console.log(`Latest completed run: ${run.id.slice(0,8)}...`);
    console.log(`  Overall Score: ${run.overallScore}`);
    console.log(`  Created: ${run.createdAt}`);
    console.log(`  Criteria: ${scores.map(s => `${s.criterion}:${s.score}`).join(', ')}`);
  } else {
    console.log('No completed runs found for Monday.com');
  }

  process.exit(0);
}

checkMondayRuns().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});