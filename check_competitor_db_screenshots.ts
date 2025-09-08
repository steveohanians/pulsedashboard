/**
 * Check competitor screenshots directly in database
 */

import { db } from './server/db';
import { effectivenessRuns, competitors } from '@shared/schema';
import { eq, and, desc, isNotNull, or } from 'drizzle-orm';

async function checkCompetitorDbScreenshots() {
  const clientId = 'demo-client-id';
  
  console.log('\n=== Checking Competitor Screenshots in Database ===\n');
  
  try {
    // Get the specific runs from the API test
    const runIds = [
      '7346fe92-cea6-452f-a6d8-93e6da581692', // Stripe
      'e145488b-7ab3-490f-a18e-f3bb0195f0d2'  // Monday
    ];
    
    for (const runId of runIds) {
      const run = await db
        .select()
        .from(effectivenessRuns)
        .where(eq(effectivenessRuns.id, runId));
      
      if (run.length > 0) {
        const r = run[0];
        console.log(`\nRun ID: ${r.id}`);
        console.log(`  Client ID: ${r.clientId}`);
        console.log(`  Competitor ID: ${r.competitorId}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Screenshot URL: ${r.screenshotUrl ? '✓ ' + r.screenshotUrl : '✗ null'}`);
        console.log(`  Full Page URL: ${r.fullPageScreenshotUrl ? '✓ ' + r.fullPageScreenshotUrl : '✗ null'}`);
        console.log(`  Screenshot Error: ${r.screenshotError || 'none'}`);
        console.log(`  Created: ${r.createdAt}`);
      } else {
        console.log(`\n✗ Run ${runId} not found`);
      }
    }
    
    // Also check the most recent competitor runs
    console.log('\n--- Most Recent Competitor Runs ---\n');
    
    const recentRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        isNotNull(effectivenessRuns.competitorId)
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(4);
    
    for (const r of recentRuns) {
      console.log(`\nRun ID: ${r.id}`);
      console.log(`  Competitor ID: ${r.competitorId}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Created: ${r.createdAt}`);
      console.log(`  Screenshot: ${r.screenshotUrl ? '✓ ' + r.screenshotUrl.substring(0, 40) + '...' : '✗ null'}`);
      console.log(`  Full Page: ${r.fullPageScreenshotUrl ? '✓ ' + r.fullPageScreenshotUrl.substring(0, 40) + '...' : '✗ null'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkCompetitorDbScreenshots();