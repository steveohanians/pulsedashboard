#!/usr/bin/env npx tsx

import { db } from './server/db';
import { effectivenessRuns, criterionScores, competitors } from './shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';

async function checkAICriteria() {
  console.log('\n=== TIER 2 (AI-POWERED) CRITERIA CHECK ===\n');
  
  const aiCriteria = ['brand_story', 'ctas', 'positioning'];
  
  // Get all recent runs (client and competitors)
  const recentRuns = await db
    .select({
      run: effectivenessRuns,
      competitor: competitors
    })
    .from(effectivenessRuns)
    .leftJoin(competitors, eq(effectivenessRuns.competitorId, competitors.id))
    .where(eq(effectivenessRuns.clientId, 'demo-client-id'))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(10);
  
  console.log('Checking last 10 runs for AI criteria scores:\n');
  
  for (const { run, competitor } of recentRuns) {
    const entityName = competitor ? competitor.label : 'Clear Digital (Client)';
    const scores = await db
      .select()
      .from(criterionScores)
      .where(and(
        eq(criterionScores.runId, run.id),
        or(
          eq(criterionScores.criterion, 'brand_story'),
          eq(criterionScores.criterion, 'ctas'),
          eq(criterionScores.criterion, 'positioning')
        )
      ))
      .orderBy(criterionScores.criterion);
    
    console.log(`${entityName}:`);
    console.log(`  Run: ${run.id.slice(0,8)}... (${run.status})`);
    
    if (scores.length === 0) {
      console.log('  ❌ NO AI CRITERIA SCORES');
    } else {
      console.log(`  ✅ AI Criteria (${scores.length}/3):`);
      
      for (const score of scores) {
        const evidence = score.evidence as any;
        const hasFallback = evidence?.details?.fallback === true;
        const reasoning = evidence?.reasoning || '';
        
        console.log(`    - ${score.criterion}: ${score.score}${hasFallback ? ' (FALLBACK)' : ''}`);
        
        // Check if it's a suspiciously perfect score
        if (parseFloat(score.score) === 10.0) {
          console.log(`      ⚠️  Perfect 10.0 score - might be default/fallback`);
        }
        
        // Check evidence quality
        if (reasoning.includes('fallback') || reasoning.includes('conservative')) {
          console.log(`      ⚠️  Evidence suggests fallback: "${reasoning.slice(0, 50)}..."`);
        }
      }
    }
    console.log();
  }
  
  // Statistical analysis
  console.log('=== STATISTICAL ANALYSIS ===\n');
  
  const allAIScores = await db
    .select()
    .from(criterionScores)
    .where(or(
      eq(criterionScores.criterion, 'brand_story'),
      eq(criterionScores.criterion, 'ctas'),
      eq(criterionScores.criterion, 'positioning')
    ));
  
  const scoreDistribution: { [key: string]: { [score: string]: number } } = {
    brand_story: {},
    ctas: {},
    positioning: {}
  };
  
  for (const score of allAIScores) {
    const val = parseFloat(score.score).toFixed(1);
    if (!scoreDistribution[score.criterion][val]) {
      scoreDistribution[score.criterion][val] = 0;
    }
    scoreDistribution[score.criterion][val]++;
  }
  
  for (const criterion of aiCriteria) {
    console.log(`${criterion} score distribution:`);
    const dist = scoreDistribution[criterion];
    const scores = Object.keys(dist).sort((a, b) => parseFloat(b) - parseFloat(a));
    
    for (const score of scores) {
      const count = dist[score];
      const bar = '█'.repeat(Math.min(count, 20));
      console.log(`  ${score}: ${bar} (${count})`);
    }
    
    // Check for suspicious patterns
    if (dist['10.0'] > 5) {
      console.log(`  ⚠️  WARNING: ${dist['10.0']} perfect 10.0 scores - likely using fallback!`);
    }
    console.log();
  }
  
  process.exit(0);
}

checkAICriteria().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});