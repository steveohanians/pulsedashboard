#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, competitors } from './shared/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

async function checkCompetitorScreenshots() {
  console.log('\n=== CHECKING COMPETITOR SCREENSHOT DATA ===\n');
  
  // Get competitors
  const competitorList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.clientId, 'demo-client-id'));
  
  for (const competitor of competitorList) {
    console.log(`\n${competitor.label} (${competitor.domain}):`);
    
    // Get latest run for this competitor
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
    console.log(`  Screenshot URL: ${run.screenshotUrl || 'NULL'}`);
    console.log(`  Full Page Screenshot URL: ${run.fullPageScreenshotUrl || 'NULL'}`);
    console.log(`  Screenshot Error: ${run.screenshotError || 'None'}`);
    console.log(`  Full Page Error: ${run.fullPageScreenshotError || 'None'}`);
    
    // Check if URLs point to actual files
    if (run.screenshotUrl) {
      const path = run.screenshotUrl.replace('/screenshots/', 'uploads/screenshots/');
      const fs = await import('fs/promises');
      try {
        await fs.access(path);
        console.log(`  ✅ Screenshot file exists`);
      } catch {
        console.log(`  ❌ Screenshot file missing at: ${path}`);
      }
    }
  }
  
  // Also check client for comparison
  console.log('\n\nClear Digital (Client):');
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNotNull(effectivenessRuns.screenshotUrl)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (clientRuns.length > 0) {
    const run = clientRuns[0];
    console.log(`  Run ID: ${run.id.slice(0, 8)}...`);
    console.log(`  Screenshot URL: ${run.screenshotUrl || 'NULL'}`);
    console.log(`  Full Page Screenshot URL: ${run.fullPageScreenshotUrl || 'NULL'}`);
  }
  
  process.exit(0);
}

checkCompetitorScreenshots().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
