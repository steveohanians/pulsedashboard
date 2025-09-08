#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores } from './shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

async function checkClientTier2() {
  console.log('\n=== INVESTIGATING CLEAR DIGITAL TIER 2 FAILURES ===\n');
  
  // Get Clear Digital's latest runs
  const clientRuns = await db
    .select()
    .from(effectivenessRuns)
    .where(and(
      eq(effectivenessRuns.clientId, 'demo-client-id'),
      isNull(effectivenessRuns.competitorId)
    ))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(3);
  
  for (const run of clientRuns) {
    console.log(`\nRun: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Created: ${run.createdAt.toISOString()}`);
    console.log(`Progress Detail: ${run.progressDetail}`);
    
    // Get all scores for this run
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id));
    
    const tier1 = ['speed', 'seo', 'accessibility', 'ux', 'trust'];
    const tier2 = ['brand_story', 'ctas', 'positioning'];
    
    const tier1Scores = scores.filter(s => tier1.includes(s.criterion));
    const tier2Scores = scores.filter(s => tier2.includes(s.criterion));
    
    console.log(`\nTier 1 (HTML-based): ${tier1Scores.length}/5`);
    tier1Scores.forEach(s => console.log(`  - ${s.criterion}: ${s.score}`));
    
    console.log(`\nTier 2 (AI-powered): ${tier2Scores.length}/3`);
    if (tier2Scores.length === 0) {
      console.log('  ❌ NO TIER 2 SCORES - OpenAI criteria completely missing!');
    } else {
      tier2Scores.forEach(s => {
        const evidence = s.evidence as any;
        const fallback = evidence?.details?.fallback;
        console.log(`  - ${s.criterion}: ${s.score}${fallback ? ' (FALLBACK)' : ''}`);
      });
    }
    
    // Check if run was marked failed due to missing criteria
    if (run.status === 'failed' && scores.length < 8) {
      console.log(`\n⚠️  Run marked FAILED - only ${scores.length}/8 criteria completed`);
      console.log('Missing criteria:', tier1.concat(tier2).filter(c => !scores.find(s => s.criterion === c)));
    }
  }
  
  process.exit(0);
}

checkClientTier2().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
