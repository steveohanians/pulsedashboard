#!/usr/bin/env npx tsx

import { db } from './server/db';
import { storage } from './server/storage';
import { effectivenessRuns, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function testAPILogic() {
  console.log('\n=== TESTING API LOGIC DIRECTLY ===\n');
  
  const clientId = 'demo-client-id';
  
  // Get latest client run
  const runs = await db
    .select()
    .from(effectivenessRuns)
    .where(eq(effectivenessRuns.clientId, clientId))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  const latestRun = runs[0];
  console.log('Latest run ID:', latestRun.id.slice(0, 8));
  
  // Get client criterion scores
  const clientCriterionScores = await storage.getCriterionScores(latestRun.id);
  const clientSpeed = clientCriterionScores.find(s => s.criterion === 'speed');
  console.log('\nCLIENT criterionScores:');
  console.log('  Speed score:', clientSpeed?.score || 'MISSING');
  console.log('  Total criteria:', clientCriterionScores.length);
  
  // Get competitor data using the EXACT logic from the API
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
      console.log(`    Total criteria: ${competitorCriterionScores.length}`);
    }
  }
  
  process.exit(0);
}

testAPILogic().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
