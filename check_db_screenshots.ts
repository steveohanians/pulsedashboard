import { storage } from './server/storage.js';

async function checkScreenshots() {
  // Get latest run
  const runs = await storage.getAllEffectivenessRuns('demo-client-id');
  const latestRun = runs[0];
  
  if (!latestRun) {
    console.log('No runs found');
    return;
  }
  
  console.log('Latest Run ID:', latestRun.id);
  console.log('Screenshot URL:', latestRun.screenshotUrl || 'NOT STORED');
  console.log('Full Page URL:', latestRun.fullPageScreenshotUrl || 'NOT STORED');
  
  // Check criterion scores for evidence
  const scores = await storage.getCriterionScores(latestRun.id);
  console.log('\nCriterion Evidence Storage:');
  for (const score of scores.slice(0, 3)) {
    const evidence = JSON.parse(score.evidence || '{}');
    console.log(`- ${score.criterion}: Screenshot URL: ${evidence.screenshotUrl ? 'YES' : 'NO'}`);
  }
}

checkScreenshots().then(() => process.exit(0));