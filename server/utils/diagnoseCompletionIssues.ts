import { db } from '../db';
import { effectivenessRuns, criterionScores } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import logger from './logging/logger';

async function diagnoseCompletionIssues() {
  console.log('\n=== DIAGNOSING COMPLETION ISSUES ===\n');
  
  // Check API keys
  console.log('1. API Key Status:');
  console.log('   SCREENSHOTONE_API_KEY:', process.env.SCREENSHOTONE_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('   PAGESPEED_API_KEY:', process.env.PAGESPEED_API_KEY ? '✓ Set' : '✗ Missing');
  
  // Get most recent runs
  const recentRuns = await db
    .select()
    .from(effectivenessRuns)
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(3);
  
  console.log('\n2. Recent Runs Analysis:');
  for (const run of recentRuns) {
    console.log(`\n   Run ID: ${run.id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Screenshot URL: ${run.screenshotUrl || '✗ MISSING'}`);
    console.log(`   Full Page Screenshot: ${run.fullPageScreenshotUrl || '✗ MISSING'}`);
    console.log(`   AI Insights: ${run.aiInsights ? '✓ Present' : '✗ MISSING'}`);
    console.log(`   Insights Generated At: ${run.insightsGeneratedAt || 'Never'}`);
    
    // Check criterion scores for this run
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id));
    
    console.log(`   Criterion Scores: ${scores.length}/8`);
    
    // Check for fallback usage
    const fallbackScores = scores.filter(s => 
      s.evidence?.details?.fallback || 
      s.evidence?.details?.screenshotQuality === 'placeholder'
    );
    console.log(`   Using Fallbacks: ${fallbackScores.length} criteria`);
    
    // Check for specific error details
    if (run.screenshotError) {
      console.log(`   Screenshot Error: ${run.screenshotError}`);
    }
    if (run.fullPageScreenshotError) {
      console.log(`   Full Page Error: ${run.fullPageScreenshotError}`);
    }
    
    // Analyze evidence details for insights
    const evidenceWithErrors = scores.filter(s => 
      s.evidence?.details?.error || 
      s.evidence?.details?.apiStatus === 'failed'
    );
    if (evidenceWithErrors.length > 0) {
      console.log(`   API Errors in Evidence: ${evidenceWithErrors.length} criteria`);
      evidenceWithErrors.forEach(score => {
        console.log(`     - ${score.criterion}: ${score.evidence?.details?.error || 'API failed'}`);
      });
    }
  }
  
  console.log('\n3. Common Issues:');
  if (!process.env.SCREENSHOTONE_API_KEY) {
    console.log('   ⚠️  No screenshot API key - should use placeholders');
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('   ⚠️  No OpenAI key - AI insights cannot generate');
  }
  if (!process.env.PAGESPEED_API_KEY) {
    console.log('   ⚠️  No PageSpeed API key - performance data limited');
  }
  
  // Check for specific patterns
  const runsWithoutScreenshots = recentRuns.filter(r => !r.screenshotUrl);
  const runsWithoutInsights = recentRuns.filter(r => !r.aiInsights);
  
  console.log('\n4. Issue Patterns:');
  console.log(`   Runs missing screenshots: ${runsWithoutScreenshots.length}/${recentRuns.length}`);
  console.log(`   Runs missing AI insights: ${runsWithoutInsights.length}/${recentRuns.length}`);
  
  // Check if insights service is configured
  try {
    const { createInsightsService } = await import('../services/effectiveness');
    console.log('   ✓ Insights service factory loaded successfully');
    
    // Test creating an actual service instance
    const testService = createInsightsService({ 
      getEffectivenessRun: () => ({}), 
      updateEffectivenessRun: () => ({}) 
    });
    console.log('   ✓ Insights service instance created successfully');
  } catch (error) {
    console.log(`   ✗ Insights service error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Check screenshot service
  try {
    const { screenshotService } = await import('../services/effectiveness/screenshot');
    console.log('   ✓ Screenshot service loaded successfully');
  } catch (error) {
    console.log(`   ✗ Screenshot service error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log('\n5. Recommendations:');
  if (runsWithoutScreenshots.length > 0) {
    console.log('   📸 Screenshot Issues:');
    console.log('      - Check SCREENSHOTONE_API_KEY is set');
    console.log('      - Verify API quota/limits not exceeded');
    console.log('      - Check if Playwright browser is installed');
  }
  
  if (runsWithoutInsights.length > 0) {
    console.log('   🤖 AI Insights Issues:');
    console.log('      - Check OPENAI_API_KEY is set and valid');
    console.log('      - Verify OpenAI API quota/limits');
    console.log('      - Check if insights generation is called after analysis');
  }
  
  return true;
}

// Run diagnostic immediately
diagnoseCompletionIssues()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });

export { diagnoseCompletionIssues };