import { db } from './server/db.ts';
import { effectivenessRuns } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

async function checkCompletedRun() {
  try {
    const runs = await db.select().from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(3);

    console.log('Latest effectiveness runs for demo-client-id:');
    runs.forEach(run => {
      console.log({
        id: run.id?.slice(0, 8),
        status: run.status,
        progress: run.progress,
        overallScore: run.overallScore,
        hasResults: !!run.results,
        createdAt: run.createdAt?.toISOString(),
        updatedAt: run.updatedAt?.toISOString()
      });
    });

    if (runs.length > 0) {
      const latestRun = runs[0];
      console.log('\nLatest run details:');
      if (latestRun.results) {
        const results = JSON.parse(latestRun.results);
        console.log('Results keys:', Object.keys(results));
        if (results.overallScore) {
          console.log('Overall score:', results.overallScore);
        }
      } else {
        console.log('No results found in latest run');
      }
    }
  } catch (error) {
    console.error('Error checking runs:', error);
  } finally {
    process.exit(0);
  }
}

checkCompletedRun();