import { db } from './server/db.js';
import { effectivenessRuns } from './shared/schema.js';
import { desc, eq } from 'drizzle-orm';

async function checkLatestRun() {
  try {
    console.log('Checking latest effectiveness runs...');
    
    const runs = await db.select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(3);

    console.log('\n📊 Latest 3 runs:');
    runs.forEach((run, i) => {
      console.log(`${i + 1}. ${run.id.slice(0,8)}: ${run.status} | Score: ${run.overallScore} | Completed: ${run.completedAt ? 'Yes' : 'No'} | Progress: ${run.progress || 'N/A'}`);
    });

    if (runs[0]) {
      console.log('\n🔍 Latest run full details:');
      const latest = runs[0];
      console.log(`ID: ${latest.id}`);
      console.log(`Status: ${latest.status}`);
      console.log(`Overall Score: ${latest.overallScore}`);
      console.log(`Progress: ${latest.progress}`);
      console.log(`Created: ${latest.createdAt}`);
      console.log(`Completed: ${latest.completedAt}`);
      console.log(`Has Results: ${!!latest.results ? 'Yes' : 'No'}`);
      
      if (latest.results) {
        try {
          const results = JSON.parse(latest.results);
          console.log(`Results Keys: ${Object.keys(results).join(', ')}`);
          if (results.criteriaScores) {
            console.log(`Criteria Count: ${Object.keys(results.criteriaScores).length}`);
          }
        } catch (e) {
          console.log('Results parsing error:', e.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking runs:', error.message);
  }
}

checkLatestRun().then(() => process.exit(0)).catch(console.error);