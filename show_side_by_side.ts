#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores, competitors } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function showSideBySide() {
  console.log('\n=== SIDE-BY-SIDE COMPARISON: CLIENT vs COMPETITOR 1 ===\n');
  
  // Get Clear Digital's latest run
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  // Get first competitor (should be Stripe)
  const competitorList = await db
    .select()
    .from(competitors)
    .where(eq(competitors.clientId, 'demo-client-id'))
    .orderBy(competitors.createdAt)
    .limit(1);
  
  if (clientRuns.length === 0 || competitorList.length === 0) {
    console.log('Missing data');
    return;
  }
  
  const clientRun = clientRuns[0];
  const firstCompetitor = competitorList[0];
  
  // Get competitor's latest run
  const compRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      eq(effectivenessRuns.competitorId, firstCompetitor.id),
      eq(effectivenessRuns.status, 'completed')
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(1);
  
  if (compRuns.length === 0) {
    console.log('No competitor run found');
    return;
  }
  
  const compRun = compRuns[0];
  
  // Get scores for both
  const clientScores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, clientRun.id))
    .orderBy(criterionScores.criterion);
  
  const compScores = await db
    .select()
    .from(criterionScores)
    .where(eq(criterionScores.runId, compRun.id))
    .orderBy(criterionScores.criterion);
  
  // Create maps for easy lookup
  const clientMap: { [key: string]: string } = {};
  const compMap: { [key: string]: string } = {};
  
  clientScores.forEach(s => clientMap[s.criterion] = s.score);
  compScores.forEach(s => compMap[s.criterion] = s.score);
  
  // Get all unique criteria
  const allCriteria = new Set([
    ...Object.keys(clientMap),
    ...Object.keys(compMap)
  ]);
  
  // Display header
  console.log('Clear Digital (Client):');
  console.log(`  Run ID: ${clientRun.id.slice(0, 8)}...`);
  console.log(`  Status: ${clientRun.status}`);
  console.log(`  Overall Score: ${clientRun.overallScore || 'N/A'}`);
  console.log(`  Criteria Scored: ${clientScores.length}/8\n`);
  
  console.log(`${firstCompetitor.label} (Competitor 1):`);
  console.log(`  Run ID: ${compRun.id.slice(0, 8)}...`);
  console.log(`  Status: ${compRun.status}`);
  console.log(`  Overall Score: ${compRun.overallScore || 'N/A'}`);
  console.log(`  Criteria Scored: ${compScores.length}/8\n`);
  
  // Display side-by-side
  console.log('=' + '='.repeat(65));
  console.log('Criterion        | Clear Digital | ' + firstCompetitor.label.padEnd(15) + '| Difference');
  console.log('-' + '-'.repeat(65));
  
  const sortedCriteria = Array.from(allCriteria).sort();
  
  // Group by tier
  const tier1 = ['accessibility', 'seo', 'speed', 'trust', 'ux'];
  const tier2 = ['brand_story', 'ctas', 'positioning'];
  
  console.log('TIER 1 (HTML-based):');
  for (const criterion of tier1) {
    if (!allCriteria.has(criterion)) continue;
    
    const clientScore = clientMap[criterion];
    const compScore = compMap[criterion];
    
    const clientStr = clientScore ? parseFloat(clientScore).toFixed(1) : 'MISSING';
    const compStr = compScore ? parseFloat(compScore).toFixed(1) : 'MISSING';
    
    let diff = '';
    if (clientScore && compScore) {
      const numDiff = parseFloat(clientScore) - parseFloat(compScore);
      diff = numDiff > 0 ? `+${numDiff.toFixed(1)}` : numDiff.toFixed(1);
      if (Math.abs(numDiff) < 0.1) diff = '=';
    }
    
    const marker = (!clientScore || !compScore) ? ' ⚠️' : '';
    console.log(
      `  ${criterion.padEnd(15)}| ${clientStr.padEnd(13)} | ${compStr.padEnd(15)}| ${diff}${marker}`
    );
  }
  
  console.log('\nTIER 2 (AI-powered):');
  for (const criterion of tier2) {
    if (!allCriteria.has(criterion)) continue;
    
    const clientScore = clientMap[criterion];
    const compScore = compMap[criterion];
    
    const clientStr = clientScore ? parseFloat(clientScore).toFixed(1) : 'MISSING';
    const compStr = compScore ? parseFloat(compScore).toFixed(1) : 'MISSING';
    
    let diff = '';
    if (clientScore && compScore) {
      const numDiff = parseFloat(clientScore) - parseFloat(compScore);
      diff = numDiff > 0 ? `+${numDiff.toFixed(1)}` : numDiff.toFixed(1);
      if (Math.abs(numDiff) < 0.1) diff = '=';
    }
    
    const marker = (!clientScore || !compScore) ? ' ⚠️' : '';
    console.log(
      `  ${criterion.padEnd(15)}| ${clientStr.padEnd(13)} | ${compStr.padEnd(15)}| ${diff}${marker}`
    );
  }
  
  console.log('=' + '='.repeat(65));
  
  // Summary
  console.log('\n📊 SUMMARY:');
  const clientMissing = tier1.concat(tier2).filter(c => !clientMap[c]);
  const compMissing = tier1.concat(tier2).filter(c => !compMap[c]);
  
  if (clientMissing.length > 0) {
    console.log(`\n❌ Clear Digital missing ${clientMissing.length} criteria:`);
    console.log('  ' + clientMissing.join(', '));
  }
  
  if (compMissing.length > 0) {
    console.log(`\n❌ ${firstCompetitor.label} missing ${compMissing.length} criteria:`);
    console.log('  ' + compMissing.join(', '));
  }
  
  if (clientRun.status === 'failed') {
    console.log(`\n⚠️  Clear Digital run marked as FAILED - missing Tier 2 AI criteria`);
  }
  
  process.exit(0);
}

showSideBySide().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
