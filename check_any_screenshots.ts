/**
 * Check if ANY runs have screenshots
 */

import { db } from './server/db';
import { effectivenessRuns } from '@shared/schema';
import { eq, isNotNull, and, desc } from 'drizzle-orm';

async function checkAnyScreenshots() {
  console.log('\n=== Checking for ANY Runs with Screenshots ===\n');
  
  try {
    // Check runs WITH screenshots
    const runsWithScreenshots = await db
      .select({
        id: effectivenessRuns.id,
        clientId: effectivenessRuns.clientId,
        competitorId: effectivenessRuns.competitorId,
        screenshotUrl: effectivenessRuns.screenshotUrl,
        fullPageScreenshotUrl: effectivenessRuns.fullPageScreenshotUrl,
        createdAt: effectivenessRuns.createdAt
      })
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        isNotNull(effectivenessRuns.screenshotUrl)
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(5);
    
    if (runsWithScreenshots.length > 0) {
      console.log(`Found ${runsWithScreenshots.length} runs WITH screenshots:\n`);
      for (const run of runsWithScreenshots) {
        console.log(`Run ID: ${run.id}`);
        console.log(`  Type: ${run.competitorId ? 'Competitor' : 'Client'}`);
        console.log(`  Created: ${run.createdAt}`);
        console.log(`  Screenshot: ${run.screenshotUrl}`);
        console.log(`  Full Page: ${run.fullPageScreenshotUrl}\n`);
      }
    } else {
      console.log('❌ NO runs found with screenshots');
    }
    
    // Check latest runs WITHOUT screenshots
    const recentRuns = await db
      .select({
        id: effectivenessRuns.id,
        clientId: effectivenessRuns.clientId,
        competitorId: effectivenessRuns.competitorId,
        status: effectivenessRuns.status,
        createdAt: effectivenessRuns.createdAt
      })
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(5);
    
    console.log('\n--- Most Recent Runs (any status) ---\n');
    for (const run of recentRuns) {
      console.log(`${run.createdAt.toISOString().substring(11,19)} - ${run.status} - ${run.competitorId ? 'Competitor' : 'Client'} - ${run.id}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkAnyScreenshots();