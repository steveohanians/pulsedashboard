import { db } from '../db';
import { effectivenessRuns, criterionScores } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

async function verifyCompleteSystem() {
  console.log('\n=== COMPLETE SYSTEM VERIFICATION ===\n');
  
  // Get most recent run
  const [latestRun] = await db
    .select()
    .from(effectivenessRuns)
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (!latestRun) {
    console.log('❌ No runs found - run an analysis first');
    return false;
  }
  
  console.log(`📋 Latest Run: ${latestRun.id}`);
  console.log(`📅 Created: ${new Date(latestRun.createdAt).toLocaleString()}`);
  console.log(`🌐 Status: ${latestRun.status}\n`);
  
  // Check criterion scores
  const scores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, latestRun.id));
  
  const checks = {
    runCompleted: latestRun.status === 'completed',
    hasScore: latestRun.overallScore !== null,
    hasScreenshot: !!latestRun.screenshotUrl || !!latestRun.screenshotMethod,
    hasInsights: !!latestRun.aiInsights,
    hasProgressDetail: !!latestRun.progressDetail,
    hasCriterionScores: scores.length >= 7, // Expect at least 7 of 8 criteria
    allTiersComplete: !!(latestRun.tier1CompletedAt && latestRun.tier2CompletedAt && latestRun.tier3CompletedAt)
  };
  
  console.log('Core System Checks:');
  console.log('✓ Run Completed:', checks.runCompleted ? '✅' : '❌');
  console.log('✓ Has Score:', checks.hasScore ? `✅ (${latestRun.overallScore}/10)` : '❌');
  console.log('✓ Has Screenshot:', checks.hasScreenshot ? '✅' : '❌');
  console.log('✓ Has AI Insights:', checks.hasInsights ? '✅' : '❌');
  console.log('✓ Has Progress Detail:', checks.hasProgressDetail ? '✅' : '❌');
  console.log('✓ Has Criterion Scores:', checks.hasCriterionScores ? `✅ (${scores.length}/8)` : `❌ (${scores.length}/8)`);
  console.log('✓ All Tiers Complete:', checks.allTiersComplete ? '✅' : '❌');
  
  // Check for fallbacks usage
  const fallbackCount = scores.filter(s => 
    s.evidence?.details?.fallback || 
    s.evidence?.details?.fallbackUsed ||
    s.evidence?.details?.screenshotQuality === 'placeholder'
  ).length;
  
  if (fallbackCount > 0) {
    console.log(`⚠️  Fallbacks Used: ${fallbackCount}/${scores.length} criteria`);
  }
  
  // API Key status
  console.log('\nAPI Configuration:');
  console.log('✓ OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('✓ Screenshot API Key:', process.env.SCREENSHOTONE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('✓ PageSpeed API Key:', process.env.PAGESPEED_API_KEY ? '✅ Set' : '⚠️ Missing (optional)');
  
  const allPassed = Object.values(checks).every(v => v === true);
  
  console.log('\n' + (allPassed ? 
    '🎉 SYSTEM FULLY OPERATIONAL!' : 
    '⚠️ Some components need attention'));
  
  if (checks.hasInsights && latestRun.aiInsights) {
    console.log('\nAI Insights Analysis:');
    console.log('- Fallback Used:', latestRun.aiInsights.fallback ? 'Yes' : 'No');
    console.log('- Confidence Score:', latestRun.aiInsights.confidence || 'Unknown');
    console.log('- Key Pattern:', latestRun.aiInsights.key_pattern || 'Unknown');
    console.log('- Recommendations:', latestRun.aiInsights.recommendations?.length || 0, 'items');
    
    if (latestRun.aiInsights.insight) {
      console.log('- Insight Preview:', latestRun.aiInsights.insight.substring(0, 120) + '...');
    }
  }
  
  if (latestRun.progressDetail) {
    try {
      const progressData = JSON.parse(latestRun.progressDetail);
      console.log('\nProgress Tracking:');
      console.log('- Final Phase:', progressData.phase || 'Unknown');
      console.log('- Sub Phase:', progressData.subPhase || 'N/A');
      if (progressData.totalCompetitors) {
        console.log('- Competitors Analyzed:', progressData.successfulCompetitors || 0, '/', progressData.totalCompetitors);
      }
    } catch (e) {
      console.log('\nProgress Tracking: Raw data saved');
    }
  }
  
  // Performance summary
  if (latestRun.createdAt && latestRun.tier3CompletedAt) {
    const totalTime = new Date(latestRun.tier3CompletedAt).getTime() - new Date(latestRun.createdAt).getTime();
    const minutes = Math.round(totalTime / 60000);
    console.log(`\n⏱️ Total Analysis Time: ${minutes} minutes`);
  }
  
  console.log('\n' + '='.repeat(50));
  
  return allPassed;
}

// ES Module compatible execution check
verifyCompleteSystem()
  .then(success => {
    console.log(success ? 
      '\n✅ ALL SYSTEMS VERIFIED AND OPERATIONAL' : 
      '\n⚠️ SYSTEM VERIFICATION FOUND ISSUES');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  });

export { verifyCompleteSystem };