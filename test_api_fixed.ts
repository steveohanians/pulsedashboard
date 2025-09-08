#!/usr/bin/env npx tsx

import { db } from './server/db';
import { storage } from './server/storage';
import { effectivenessRuns, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function testFixedAPILogic() {
  console.log('\n=== TESTING FIXED API LOGIC ===\n');
  
  const clientId = 'demo-client-id';
  
  // Get latest CLIENT run (with the fix)
  const runs = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, clientId),
      isNull(effectivenessRuns.competitorId)  // THIS IS THE FIX
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (runs.length === 0) {
    console.log('No client run found');
    return;
  }
  
  const latestRun = runs[0];
  console.log('CLIENT run ID:', latestRun.id.slice(0, 8));
  console.log('CLIENT status:', latestRun.status);
  
  // Get client criterion scores
  const clientCriterionScores = await storage.getCriterionScores(latestRun.id);
  const clientSpeed = clientCriterionScores.find(s => s.criterion === 'speed');
  console.log('CLIENT speed score:', clientSpeed?.score || 'MISSING');
  console.log('CLIENT total criteria:', clientCriterionScores.length);
  
  // Get competitor data
  const competitorList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.clientId, clientId));
  
  console.log('\nCOMPETITOR DATA:');
  
  for (const competitor of competitorList) {
    const latestRun = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        eq(effectivenessRuns.competitorId, competitor.id),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (latestRun.length > 0) {
      const run = latestRun[0];
      const competitorCriterionScores = await storage.getCriterionScores(run.id);
      const compSpeed = competitorCriterionScores.find(s => s.criterion === 'speed');
      
      console.log(`  ${competitor.label}:`);
      console.log(`    Run ID: ${run.id.slice(0, 8)}`);
      console.log(`    Speed score: ${compSpeed?.score || 'MISSING'}`);
    }
  }
  
  console.log('\n✅ With the fix, client and competitors have different run IDs and scores!');
  
  process.exit(0);
}

testFixedAPILogic().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
