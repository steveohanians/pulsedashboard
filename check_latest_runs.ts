#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { desc, eq } from 'drizzle-orm';

async function checkLatestRuns() {
  console.log('\n=== CHECKING LATEST EFFECTIVENESS RUNS ===\n');
  
  // Get the 5 most recent runs
  const recentRuns = await db
    .select()
    .from(effectivenessRuns)
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(5);
  
  if (recentRuns.length === 0) {
    console.log('No runs found in database');
    return;
  }
  
  console.log(`Found ${recentRuns.length} recent run(s):\n`);
  
  for (const run of recentRuns) {
    const age = Date.now() - run.createdAt.getTime();
    const minutes = Math.floor(age / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let ageStr = '';
    if (days > 0) ageStr = `${days}d ago`;
    else if (hours > 0) ageStr = `${hours}h ago`;
    else ageStr = `${minutes}m ago`;
    
    console.log(`Run ID: ${run.id.slice(0, 8)}...`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Progress: ${run.progress || '0%'}`);
    console.log(`  Progress Detail: ${run.progressDetail || 'N/A'}`);
    console.log(`  Created: ${ageStr}`);
    console.log(`  Client ID: ${run.clientId}`);
    console.log(`  Is Competitor: ${run.competitorId ? 'Yes' : 'No (client run)'}`);
    console.log();
  }
  
  // Check specifically for "Analysis completed successfully" in progressDetail
  const completedRuns = recentRuns.filter(r => 
    r.progressDetail === 'Analysis completed successfully'
  );
  
  if (completedRuns.length > 0) {
    console.log(`⚠️  Found ${completedRuns.length} run(s) with "Analysis completed successfully" message`);
    console.log('These might be displayed when the UI loads.');
  }
  
  process.exit(0);
}

checkLatestRuns().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
