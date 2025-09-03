import { db } from '../db';
import { effectivenessRuns, criterionScores, clients } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

async function fullSystemDiagnostic() {
  console.log('\n=== FULL SYSTEM DIAGNOSTIC ===\n');
  
  // 1. Check ALL clients
  const allClients = await db.select().from(clients);
  console.log(`Total clients in database: ${allClients.length}`);
  if (allClients.length > 0) {
    allClients.forEach(c => console.log(`  - ${c.id}: ${c.name} (${c.websiteUrl})`));
  } else {
    console.log('  No clients found in database');
  }
  
  // 2. Check recent runs for ALL clients
  console.log('\n--- Recent Runs Per Client ---');
  for (const client of allClients) {
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, client.id))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(3); // Show last 3 runs per client
    
    if (runs.length > 0) {
      console.log(`\n${client.name} (${runs.length} recent runs):`);
      
      runs.forEach((run, index) => {
        console.log(`  Run ${index + 1} (${run.id}):`);
        console.log(`    Created: ${new Date(run.createdAt).toLocaleString()}`);
        console.log(`    Status: ${run.status}`);
        console.log(`    Score: ${run.overallScore || 'NULL'}`);
        console.log(`    Progress: ${run.progress || 'NULL'}`);
        console.log(`    Screenshot: ${run.screenshotUrl || 'NULL'}`);
        console.log(`    Full Screenshot: ${run.fullPageScreenshotUrl || 'NULL'}`);
        console.log(`    AI Insights: ${run.aiInsights ? 'YES' : 'NO'}`);
        console.log(`    Insights Generated: ${run.insightsGeneratedAt || 'NO'}`);
        console.log(`    Progress Detail: ${run.progressDetail ? 'YES' : 'NO'}`);
        
        // Show progress detail if exists
        if (run.progressDetail) {
          try {
            const detail = JSON.parse(run.progressDetail);
            console.log(`    Progress Detail: ${JSON.stringify(detail, null, 6)}`);
          } catch {
            console.log(`    Progress Detail (raw): ${run.progressDetail.substring(0, 100)}...`);
          }
        }
        
        // Show AI insights preview if exists
        if (run.aiInsights) {
          console.log(`    AI Insights Preview:`);
          console.log(`      Fallback: ${run.aiInsights.fallback || 'No'}`);
          console.log(`      Confidence: ${run.aiInsights.confidence || 'Unknown'}`);
          console.log(`      Key Pattern: ${run.aiInsights.key_pattern || 'Unknown'}`);
          if (run.aiInsights.insight) {
            console.log(`      Insight: ${run.aiInsights.insight.substring(0, 150)}...`);
          }
          if (run.aiInsights.recommendations) {
            console.log(`      Recommendations: ${run.aiInsights.recommendations.length} items`);
          }
        }
      });
      
      // Check criterion scores for most recent run
      const latestRun = runs[0];
      const scores = await db
        .select()
        .from(criterionScores)
        .where(eq(criterionScores.runId, latestRun.id));
      
      console.log(`    Criterion Scores: ${scores.length}/8`);
      if (scores.length > 0) {
        scores.forEach(score => {
          const fallbackUsed = score.evidence?.details?.fallback || 
                              score.evidence?.details?.fallbackUsed ||
                              score.evidence?.details?.screenshotQuality === 'placeholder';
          console.log(`      - ${score.criterion}: ${score.score}/10 ${fallbackUsed ? '(fallback)' : ''}`);
        });
      }
    } else {
      console.log(`\n${client.name}: No runs found`);
    }
  }
  
  // 3. Overall statistics
  console.log('\n--- Overall Statistics ---');
  const totalRuns = await db.select().from(effectivenessRuns);
  const completedRuns = totalRuns.filter(r => r.status === 'completed');
  const failedRuns = totalRuns.filter(r => r.status === 'failed');
  const runsWithInsights = totalRuns.filter(r => r.aiInsights);
  const runsWithScreenshots = totalRuns.filter(r => r.screenshotUrl);
  const runsWithProgressDetail = totalRuns.filter(r => r.progressDetail);
  
  console.log(`Total runs: ${totalRuns.length}`);
  console.log(`Completed runs: ${completedRuns.length}`);
  console.log(`Failed runs: ${failedRuns.length}`);
  console.log(`Runs with AI insights: ${runsWithInsights.length} (${Math.round(runsWithInsights.length/totalRuns.length*100)}%)`);
  console.log(`Runs with screenshots: ${runsWithScreenshots.length} (${Math.round(runsWithScreenshots.length/totalRuns.length*100)}%)`);
  console.log(`Runs with progress detail: ${runsWithProgressDetail.length} (${Math.round(runsWithProgressDetail.length/totalRuns.length*100)}%)`);
  
  // 4. Check environment variables
  console.log('\n--- Environment Variables ---');
  console.log(`SCREENSHOTONE_API_KEY: ${process.env.SCREENSHOTONE_API_KEY ? 'SET (' + process.env.SCREENSHOTONE_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET (' + process.env.OPENAI_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`PAGESPEED_API_KEY: ${process.env.PAGESPEED_API_KEY ? 'SET (' + process.env.PAGESPEED_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? 'SET (' + process.env.GOOGLE_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
  
  // 5. Recent activity summary
  console.log('\n--- Recent Activity (Last 24 Hours) ---');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const recentRuns = totalRuns.filter(r => new Date(r.createdAt) > yesterday);
  console.log(`Runs in last 24 hours: ${recentRuns.length}`);
  
  if (recentRuns.length > 0) {
    console.log('Recent run statuses:');
    const statusCounts = recentRuns.reduce((acc, run) => {
      acc[run.status] = (acc[run.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} runs`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

// Run diagnostic
fullSystemDiagnostic()
  .then(() => {
    console.log('\n✅ Full system diagnostic completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });

export { fullSystemDiagnostic };