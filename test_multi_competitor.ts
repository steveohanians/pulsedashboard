/**
 * Multi-Competitor Enhanced Scoring Test
 * 
 * Tests the Enhanced Effectiveness Scoring System with a main client + up to 3 competitors
 * to validate production readiness under realistic usage scenarios
 */

import { EnhancedWebsiteEffectivenessScorer } from './server/services/effectiveness/enhancedScorer';
import logger from './server/utils/logging/logger';

// Test configuration
const TEST_SITES = [
  {
    name: 'Main Client',
    url: 'https://anthropic.com',
    type: 'primary'
  },
  {
    name: 'Competitor 1',
    url: 'https://openai.com',
    type: 'competitor'
  },
  {
    name: 'Competitor 2', 
    url: 'https://cohere.com',
    type: 'competitor'
  },
  {
    name: 'Competitor 3',
    url: 'https://mistral.ai',
    type: 'competitor'
  }
];

interface TestResult {
  site: typeof TEST_SITES[0];
  score: number;
  duration: number;
  criteriaCompleted: number;
  hasScreenshot: boolean;
  hasWebVitals: boolean;
  error?: string;
  progressUpdates: number;
}

async function runMultiCompetitorTest() {
  console.log('🏆 MULTI-COMPETITOR ENHANCED SCORING TEST\n');
  console.log(`Testing ${TEST_SITES.length} sites: Main client + ${TEST_SITES.length - 1} competitors\n`);

  const scorer = new EnhancedWebsiteEffectivenessScorer();
  const results: TestResult[] = [];
  const overallStartTime = Date.now();

  for (let i = 0; i < TEST_SITES.length; i++) {
    const site = TEST_SITES[i];
    console.log(`📊 [${i + 1}/${TEST_SITES.length}] Testing ${site.name}: ${site.url}`);
    console.log('⏳ Expected completion: 45-90 seconds...\n');

    const testResult: TestResult = {
      site,
      score: 0,
      duration: 0,
      criteriaCompleted: 0,
      hasScreenshot: false,
      hasWebVitals: false,
      progressUpdates: 0
    };

    const siteStartTime = Date.now();
    let progressCount = 0;

    try {
      const result = await scorer.scoreWebsiteProgressive(
        site.url,
        undefined, // No runId for test
        async (status, progress, results) => {
          progressCount++;
          const elapsed = Math.round((Date.now() - siteStartTime) / 1000);
          console.log(`  [${elapsed}s] ${status}: ${progress}`);
          
          if (results) {
            console.log(`    └─ Score: ${results.overallScore}/10, Criteria: ${results.criterionResults?.length || 0}/8`);
          }
        }
      );

      testResult.duration = Date.now() - siteStartTime;
      testResult.score = result.overallScore;
      testResult.criteriaCompleted = result.criterionResults.length;
      testResult.hasScreenshot = !!result.screenshotUrl;
      testResult.hasWebVitals = !!result.webVitals;
      testResult.progressUpdates = progressCount;

      console.log(`\n✅ ${site.name} completed successfully!`);
      console.log(`   Score: ${result.overallScore}/10`);
      console.log(`   Duration: ${Math.round(testResult.duration / 1000)}s`);
      console.log(`   Criteria: ${testResult.criteriaCompleted}/8`);
      console.log(`   Screenshot: ${testResult.hasScreenshot ? 'YES' : 'NO'}`);
      console.log(`   Web Vitals: ${testResult.hasWebVitals ? 'YES' : 'NO'}`);
      console.log(`   Progress Updates: ${testResult.progressUpdates}\n`);

    } catch (error) {
      testResult.error = error.message;
      testResult.duration = Date.now() - siteStartTime;
      
      console.log(`❌ ${site.name} failed: ${error.message}`);
      console.log(`   Duration: ${Math.round(testResult.duration / 1000)}s`);
      console.log(`   Progress Updates: ${progressCount}\n`);
    }

    results.push(testResult);
    
    // Add a small delay between tests to be respectful to servers
    if (i < TEST_SITES.length - 1) {
      console.log('⏸️  Waiting 5 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  const totalDuration = Date.now() - overallStartTime;

  // Generate comprehensive report
  generateCompetitorReport(results, totalDuration);
}

function generateCompetitorReport(results: TestResult[], totalDuration: number) {
  console.log('📈 MULTI-COMPETITOR ANALYSIS REPORT\n');
  console.log('=' .repeat(80));

  // Overall statistics
  const successfulTests = results.filter(r => !r.error);
  const failedTests = results.filter(r => r.error);
  
  console.log('\n🎯 OVERALL STATISTICS:');
  console.log(`   Total Duration: ${Math.round(totalDuration / 1000 / 60)}m ${Math.round((totalDuration / 1000) % 60)}s`);
  console.log(`   Successful Tests: ${successfulTests.length}/${results.length}`);
  console.log(`   Failed Tests: ${failedTests.length}/${results.length}`);
  console.log(`   Success Rate: ${Math.round((successfulTests.length / results.length) * 100)}%`);

  // Performance analysis
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const maxDuration = Math.max(...successfulTests.map(r => r.duration));
    const minDuration = Math.min(...successfulTests.map(r => r.duration));

    console.log('\n⚡ PERFORMANCE ANALYSIS:');
    console.log(`   Average Duration: ${Math.round(avgDuration / 1000)}s`);
    console.log(`   Fastest Completion: ${Math.round(minDuration / 1000)}s`);
    console.log(`   Slowest Completion: ${Math.round(maxDuration / 1000)}s`);
    console.log(`   Performance Target (<90s): ${avgDuration < 90000 ? '✅ MET' : '❌ MISSED'}`);
  }

  // Scoring comparison
  console.log('\n🏆 SCORING COMPARISON:');
  console.log('   Site                Score   Duration  Criteria  Screenshot  WebVitals  Status');
  console.log('   ' + '-'.repeat(75));
  
  results.forEach(result => {
    const status = result.error ? 'FAILED' : 'SUCCESS';
    const duration = `${Math.round(result.duration / 1000)}s`.padStart(8);
    const score = result.error ? 'N/A' : `${result.score}/10`.padStart(7);
    const criteria = result.error ? 'N/A' : `${result.criteriaCompleted}/8`.padStart(7);
    const screenshot = (result.hasScreenshot ? 'YES' : 'NO').padStart(9);
    const webVitals = (result.hasWebVitals ? 'YES' : 'NO').padStart(9);
    
    console.log(`   ${result.site.name.padEnd(18)} ${score} ${duration} ${criteria}   ${screenshot}   ${webVitals}   ${status}`);
  });

  // Competitive analysis
  const mainClient = results.find(r => r.site.type === 'primary');
  const competitors = results.filter(r => r.site.type === 'competitor' && !r.error);

  if (mainClient && !mainClient.error && competitors.length > 0) {
    console.log('\n🎯 COMPETITIVE ANALYSIS:');
    console.log(`   Main Client Score: ${mainClient.score}/10`);
    
    const avgCompetitorScore = competitors.reduce((sum, r) => sum + r.score, 0) / competitors.length;
    console.log(`   Average Competitor Score: ${avgCompetitorScore.toFixed(1)}/10`);
    
    const scoreDiff = mainClient.score - avgCompetitorScore;
    const competitive = scoreDiff > 0 ? 'AHEAD' : scoreDiff < -0.5 ? 'BEHIND' : 'COMPETITIVE';
    
    console.log(`   Performance Gap: ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)} points`);
    console.log(`   Market Position: ${competitive}`);

    // Best and worst performing criteria would require more detailed results
    console.log('\n   Recommendations:');
    if (scoreDiff < 0) {
      console.log('   - Analyze top-performing competitor features');
      console.log('   - Focus on criteria where competitors excel');
    } else if (scoreDiff > 1) {
      console.log('   - Maintain competitive advantages');
      console.log('   - Consider showcasing superior features');
    } else {
      console.log('   - Continue competitive monitoring');
      console.log('   - Identify differentiation opportunities');
    }
  }

  // System validation
  console.log('\n🔧 SYSTEM VALIDATION:');
  const allCriteriaWorking = successfulTests.every(r => r.criteriaCompleted >= 7);
  const allScreenshotsWorking = successfulTests.every(r => r.hasScreenshot);
  const allWebVitalsWorking = successfulTests.every(r => r.hasWebVitals);
  const performanceTarget = successfulTests.length === 0 || successfulTests.every(r => r.duration < 90000);

  console.log(`   All Data Sources: ${allScreenshotsWorking && allWebVitalsWorking ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`   All Criteria (≥7/8): ${allCriteriaWorking ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`   Performance Target: ${performanceTarget ? '✅ MET' : '❌ MISSED'}`);
  console.log(`   Progressive UI: ${successfulTests.every(r => r.progressUpdates >= 3) ? '✅ WORKING' : '❌ ISSUES'}`);

  // Error analysis
  if (failedTests.length > 0) {
    console.log('\n❌ ERROR ANALYSIS:');
    failedTests.forEach(result => {
      console.log(`   ${result.site.name}: ${result.error}`);
    });
  }

  // Final verdict
  const systemHealthy = successfulTests.length >= results.length * 0.75 && 
                       allCriteriaWorking && 
                       performanceTarget;

  console.log('\n' + '='.repeat(80));
  console.log(`🚀 FINAL VERDICT: ${systemHealthy ? '✅ PRODUCTION READY' : '❌ NEEDS ATTENTION'}`);
  
  if (systemHealthy) {
    console.log('   System performs reliably across multiple sites');
    console.log('   All critical components operational');
    console.log('   Performance targets met');
    console.log('   Ready for competitive analysis workflows');
  } else {
    console.log('   Issues detected that require investigation');
    console.log('   Review failed tests and performance metrics');
    console.log('   Address system limitations before production');
  }
  
  console.log('=' .repeat(80));
}

// Performance monitoring
function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log('\n📊 Memory Usage:');
  for (let key in used) {
    console.log(`   ${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

// Run the multi-competitor test
console.log('🚀 Starting Multi-Competitor Enhanced Scoring System Test...\n');
runMultiCompetitorTest()
  .then(() => {
    logMemoryUsage();
    console.log('\n🎉 Multi-competitor test completed!');
  })
  .catch((error) => {
    console.error('\n❌ Multi-competitor test failed:', error);
    process.exit(1);
  });