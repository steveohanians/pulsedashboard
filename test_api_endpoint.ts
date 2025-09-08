import { db } from './server/db.js';
import { effectivenessRuns, criterionScores } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

async function testApiEndpoint() {
  console.log('=== TESTING API ENDPOINT DATA ===');
  
  // Get the latest run directly from database
  const runs = await db
    .select()
    .from(effectivenessRuns)
    .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
    
  if (runs.length === 0) {
    console.log('❌ No runs found');
    return;
  }
  
  const latestRun = runs[0];
  console.log('Latest Run:');
  console.log('  ID:', latestRun.id);
  console.log('  Status:', latestRun.status);
  console.log('  Overall Score:', latestRun.overallScore);
  console.log('  Screenshot URL:', latestRun.screenshotUrl || '❌ MISSING');
  console.log('  Full Page URL:', latestRun.fullPageScreenshotUrl || '❌ MISSING');
  console.log('  Progress:', latestRun.progress);
  console.log('  Created At:', latestRun.createdAt);
  
  // Get criterion scores
  const scores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, latestRun.id));
    
  console.log(`\nCriterion Scores (${scores.length} total):`);
  scores.forEach(score => {
    console.log(`  ${score.criterion}: ${score.score}/10 (tier ${score.tier})`);
    
    if (score.criterion === 'speed') {
      console.log('    Speed Evidence:');
      try {
        const evidence = typeof score.evidence === 'string' ? JSON.parse(score.evidence) : score.evidence;
        console.log('      Performance Score:', evidence.performanceScore);
        console.log('      Web Vitals:', evidence.details?.webVitals);
        console.log('      LCP:', evidence.details?.webVitals?.lcp);
        console.log('      CLS:', evidence.details?.webVitals?.cls);
        console.log('      FID:', evidence.details?.webVitals?.fid);
      } catch (e) {
        console.log('      Raw Evidence:', score.evidence);
      }
    }
  });
}

testApiEndpoint().catch(console.error);