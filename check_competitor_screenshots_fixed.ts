#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function checkCompetitorScreenshotsProperly() {
  console.log('\n=== CHECKING SCREENSHOT DATA (FIXED) ===\n');
  
  // Get ACTUAL client run (where competitorId is NULL)
  console.log('Clear Digital (Client - FIXED QUERY):');
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)  // This ensures we get CLIENT runs only
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (clientRuns.length > 0) {
    const run = clientRuns[0];
    console.log(`  Run ID: ${run.id.slice(0, 8)}...`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Screenshot URL: ${run.screenshotUrl || 'NULL'}`);
    console.log(`  Full Page Screenshot URL: ${run.fullPageScreenshotUrl || 'NULL'}`);
  } else {
    console.log('  No client runs found');
  }
  
  // Get competitors
  const competitorList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.clientId, 'demo-client-id'));
  
  for (const competitor of competitorList) {
    console.log(`\n${competitor.label}:`);
    
    // Get latest completed run for this competitor
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        eq(effectivenessRuns.competitorId, competitor.id),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (runs.length === 0) {
      console.log('  No completed runs found');
      continue;
    }
    
    const run = runs[0];
    console.log(`  Run ID: ${run.id.slice(0, 8)}...`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Screenshot URL: ${run.screenshotUrl || 'NULL'}`);
    console.log(`  Full Page Screenshot URL: ${run.fullPageScreenshotUrl || 'NULL'}`);
  }
  
  process.exit(0);
}

checkCompetitorScreenshotsProperly().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
