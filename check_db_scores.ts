#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function checkDatabaseScores() {
  console.log('\n=== DATABASE SCORE CHECK ===\n');
  
  // Get Clear Digital's latest run
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (clientRuns.length === 0) {
    console.log('No client run found');
    return;
  }
  
  const clientRun = clientRuns[0];
  console.log('CLIENT (Clear Digital):');
  console.log('  Run ID:', clientRun.id.slice(0, 8));
  console.log('  Status:', clientRun.status);
  
  // Get client scores
  const clientScores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, clientRun.id));
  
  const clientSpeedScore = clientScores.find(s => s.criterion === 'speed');
  console.log('  Speed score in DB:', clientSpeedScore?.score || 'MISSING');
  console.log('  All scores:', clientScores.map(s => `${s.criterion}:${s.score}`).join(', '));
  
  // Get Monday's latest run
  const mondayComp = await db
    .select()
    .from(competitors)
    .where(eq(competitors.label, 'Monday'))
    .limit(1);
  
  if (mondayComp.length > 0) {
    const mondayRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        eq(effectivenessRuns.competitorId, mondayComp[0].id)
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (mondayRuns.length > 0) {
      const mondayRun = mondayRuns[0];
      console.log('\nCOMPETITOR (Monday):');
      console.log('  Run ID:', mondayRun.id.slice(0, 8));
      console.log('  Status:', mondayRun.status);
      
      const mondayScores = await db
        .select()
        .from(criterionScores)
        .where(eq(criterionScores.runId, mondayRun.id));
      
      const mondaySpeedScore = mondayScores.find(s => s.criterion === 'speed');
      console.log('  Speed score in DB:', mondaySpeedScore?.score || 'MISSING');
      console.log('  All scores:', mondayScores.map(s => `${s.criterion}:${s.score}`).join(', '));
      
      // Check for data mixing
      console.log('\n=== DATA INTEGRITY ===');
      if (clientSpeedScore && mondaySpeedScore) {
        if (clientSpeedScore.score === mondaySpeedScore.score) {
          console.log(`❌ PROBLEM: Both have same speed score: ${clientSpeedScore.score}`);
        } else {
          console.log(`✅ Different speed scores: Client=${clientSpeedScore.score}, Monday=${mondaySpeedScore.score}`);
        }
      }
    }
  }
  
  process.exit(0);
}

checkDatabaseScores().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
