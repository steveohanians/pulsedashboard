import { db } from './server/db';
import { effectivenessRuns } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

// Get the latest effectiveness run and check its progress messages
async function checkLatestProgress() {
  const latestRun = await db
    .select()
    .from(effectivenessRuns)
    .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);

  if (latestRun.length > 0) {
    const run = latestRun[0];
    console.log('📊 Latest Run Progress Check:');
    console.log('   Run ID:', run.id);
    console.log('   Status:', run.status);
    console.log('   Progress Message:', run.progress);
    
    if (run.progressDetail) {
      try {
        const detail = JSON.parse(run.progressDetail);
        console.log('   Progress Detail:');
        console.log('     - Message:', detail.message);
        console.log('     - Percentage:', detail.overallPercent);
        console.log('     - Phase:', detail.currentPhase);
        console.log('     - Time Elapsed:', detail.timeElapsed);
        console.log('     - Time Remaining:', detail.timeRemaining);
      } catch (e) {
        console.log('   Progress Detail (raw):', run.progressDetail);
      }
    }
  } else {
    console.log('No runs found for demo-client-id');
  }
}

checkLatestProgress().catch(console.error);