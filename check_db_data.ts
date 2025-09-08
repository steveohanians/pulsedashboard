import { storage } from './server/storage.js';

async function main() {
  const data = await storage.getLatestEffectivenessRun('demo-client-id');
  
  console.log('=== DATABASE DATA STRUCTURE ===');
  console.log('Run Data:');
  console.log('  ID:', data.run?.id);
  console.log('  Status:', data.run?.status);
  console.log('  Overall Score:', data.run?.overallScore);
  console.log('  Screenshot URL:', data.run?.screenshotUrl || 'MISSING');
  console.log('  Full Page URL:', data.run?.fullPageScreenshotUrl || 'MISSING');
  
  console.log('\nCriterion Scores Count:', data.criterionScores?.length || 0);
  
  if (data.criterionScores?.length > 0) {
    console.log('\n=== CRITERION DETAILS ===');
    data.criterionScores.forEach(score => {
      console.log(`${score.criterion}:`);
      console.log(`  Score: ${score.score}`);
      console.log(`  Passes: ${score.passes}`);
      console.log(`  Tier: ${score.tier}`);
      
      if (score.criterion === 'speed') {
        console.log('  Evidence (Speed/Web Vitals):');
        try {
          const evidence = typeof score.evidence === 'string' ? JSON.parse(score.evidence) : score.evidence;
          console.log('    Performance Score:', evidence.performanceScore);
          console.log('    Web Vitals:', evidence.details?.webVitals);
          console.log('    API Status:', evidence.details?.apiStatus);
        } catch (e) {
          console.log('    Raw Evidence:', score.evidence);
        }
      }
    });
  }
  
  console.log('\n=== RAW RUN OBJECT ===');
  console.log(JSON.stringify(data.run, null, 2));
}

main().catch(console.error);