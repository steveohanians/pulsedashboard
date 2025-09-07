import { storage } from './server/storage';
import { db } from './server/db';
import { effectivenessRuns } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

async function checkData() {
  console.log('Checking effectiveness runs for demo-client-id...');
  
  const runs = await db.select().from(effectivenessRuns)
    .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(5);
    
  console.log('Recent runs:', runs.map(r => ({
    id: r.id.substring(0, 8) + '...',
    status: r.status,
    createdAt: r.createdAt,
    overallScore: r.overallScore,
    hasProgress: !!r.progress,
    hasAiInsights: !!r.aiInsights
  })));

  const latestRun = await storage.getLatestEffectivenessRun('demo-client-id');
  if (latestRun) {
    console.log('\nLatest run details:', {
      id: latestRun.id.substring(0, 8) + '...',
      status: latestRun.status,
      overallScore: latestRun.overallScore,
      createdAt: latestRun.createdAt,
      hasAiInsights: !!latestRun.aiInsights,
      progress: latestRun.progress?.substring(0, 50) + '...'
    });
    
    const criterionScores = await storage.getCriterionScores(latestRun.id);
    console.log('Criterion scores count:', criterionScores.length);
    
    if (criterionScores.length === 0 && latestRun.status === 'completed') {
      console.log('⚠️ ISSUE: Completed run has no criterion scores - DATA CORRUPTION DETECTED');
      console.log('💡 SOLUTION: Clear corrupted data to allow fresh effectiveness run');
    } else if (latestRun.status === 'failed') {
      console.log('⚠️ ISSUE: Latest run failed');
      console.log('💡 SOLUTION: Clear failed run to allow fresh effectiveness run');  
    } else if (latestRun.status !== 'completed') {
      console.log('⚠️ ISSUE: Latest run is stuck in status:', latestRun.status);
      console.log('💡 SOLUTION: Clear stuck run to allow fresh effectiveness run');
    } else {
      console.log('✅ Run data looks good');
    }
  } else {
    console.log('No runs found for demo-client-id');
    console.log('💡 This means no effectiveness data exists - frontend should show "Run Analysis" button');
  }
}

checkData().catch(console.error);