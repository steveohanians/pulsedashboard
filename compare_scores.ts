#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function compareScores() {
  console.log('\n=== LATEST RUN COMPARISON ===\n');
  
  // Get Clear Digital's latest CLIENT run
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  // Get Monday's latest run (first competitor)
  const mondayCompetitor = await db
    .select()
    .from(competitors)
    .where(eq(competitors.label, 'Monday'))
    .limit(1);
  
  let mondayRun = null;
  if (mondayCompetitor.length > 0) {
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        eq(effectivenessRuns.competitorId, mondayCompetitor[0].id),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (runs.length > 0) {
      mondayRun = runs[0];
    }
  }
  
  if (clientRuns.length === 0 || !mondayRun) {
    console.log('Missing data for comparison');
    return;
  }
  
  const clientRun = clientRuns[0];
  
  // Get scores for both
  const clientScores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, clientRun.id))
    .orderBy(criterionScores.criterion);
  
  const mondayScores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, mondayRun.id))
    .orderBy(criterionScores.criterion);
  
  // Create score maps
  const clientScoreMap: { [key: string]: number } = {};
  const mondayScoreMap: { [key: string]: number } = {};
  
  clientScores.forEach(s => {
    clientScoreMap[s.criterion] = parseFloat(s.score);
  });
  
  mondayScores.forEach(s => {
    mondayScoreMap[s.criterion] = parseFloat(s.score);
  });
  
  // Get all criteria
  const allCriteria = new Set([
    ...Object.keys(clientScoreMap),
    ...Object.keys(mondayScoreMap)
  ]);
  
  // Display header
  console.log('Clear Digital (Client):');
  console.log(`  Run ID: ${clientRun.id.slice(0, 8)}...`);
  console.log(`  Status: ${clientRun.status} ${clientRun.status === 'failed' ? '❌' : '✅'}`);
  console.log(`  Overall Score: ${clientRun.overallScore}`);
  console.log(`  Criteria Count: ${clientScores.length}\n`);
  
  console.log('Monday.com (Competitor 1):');
  console.log(`  Run ID: ${mondayRun.id.slice(0, 8)}...`);
  console.log(`  Status: ${mondayRun.status} ${mondayRun.status === 'failed' ? '❌' : '✅'}`);
  console.log(`  Overall Score: ${mondayRun.overallScore}`);
  console.log(`  Criteria Count: ${mondayScores.length}\n`);
  
  // Display side-by-side comparison
  console.log('SIDE-BY-SIDE CRITERION SCORES:');
  console.log('=' + '='.repeat(60));
  console.log('Criterion        | Clear Digital | Monday.com    | Difference');
  console.log('-' + '-'.repeat(60));
  
  const sortedCriteria = Array.from(allCriteria).sort();
  
  for (const criterion of sortedCriteria) {
    const clientScore = clientScoreMap[criterion];
    const mondayScore = mondayScoreMap[criterion];
    
    const clientStr = clientScore !== undefined ? clientScore.toFixed(1) : 'MISSING';
    const mondayStr = mondayScore !== undefined ? mondayScore.toFixed(1) : 'MISSING';
    
    let diff = '';
    if (clientScore !== undefined && mondayScore !== undefined) {
      const numDiff = clientScore - mondayScore;
      diff = numDiff > 0 ? `+${numDiff.toFixed(1)}` : numDiff.toFixed(1);
      if (Math.abs(numDiff) < 0.1) diff = 'SAME';
    }
    
    // Highlight if one is missing
    const marker = (clientScore === undefined || mondayScore === undefined) ? ' ⚠️' : '';
    
    console.log(
      `${criterion.padEnd(15)} | ${clientStr.padEnd(13)} | ${mondayStr.padEnd(13)} | ${diff}${marker}`
    );
  }
  
  console.log('\n' + '=' + '='.repeat(60));
  
  // Analysis
  console.log('\n🔍 ANALYSIS:\n');
  
  if (clientRun.status === 'failed' && clientScores.length < 8) {
    console.log(`✅ YES - Clear Digital's run is marked as FAILED because only ${clientScores.length}/8 criteria completed`);
    console.log('   Missing criteria for Clear Digital:');
    const expectedCriteria = ['accessibility', 'brand_story', 'ctas', 'positioning', 'seo', 'speed', 'trust', 'ux'];
    expectedCriteria.forEach(c => {
      if (!(c in clientScoreMap)) {
        console.log(`     - ${c}`);
      }
    });
  }
  
  // Check if scores are actually the same
  let identicalCount = 0;
  for (const criterion of sortedCriteria) {
    if (clientScoreMap[criterion] === mondayScoreMap[criterion] && 
        clientScoreMap[criterion] !== undefined) {
      identicalCount++;
    }
  }
  
  if (identicalCount > 3) {
    console.log(`\n⚠️  WARNING: ${identicalCount} criteria have IDENTICAL scores!`);
    console.log('   This might indicate data is being mixed up.');
  }
  
  // Special check for speed
  if (clientScoreMap['speed'] !== undefined) {
    console.log(`\n📊 Speed Score Check:`);
    console.log(`   Clear Digital: ${clientScoreMap['speed']}`);
    console.log(`   Monday.com: ${mondayScoreMap['speed'] || 'N/A'}`);
    
    if (Math.abs(clientScoreMap['speed'] - 4.5) < 0.1) {
      console.log('   ⚠️  Clear Digital has speed=4.5, which is Monday\'s typical score!');
    }
  }
  
  process.exit(0);
}

compareScores().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});