#!/usr/bin/env npx tsx

import { db } from './server/db';
import { criterionScores, effectivenessRuns, competitors } from './shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';

async function checkOpenAIEvidence() {
  console.log('\n=== CHECKING IF OPENAI IS ACTUALLY RUNNING ===\n');
  
  // First check if API key exists
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  console.log(`OpenAI API Key configured: ${hasApiKey ? '✅ YES' : '❌ NO'}`);
  if (hasApiKey) {
    console.log(`API Key length: ${process.env.OPENAI_API_KEY!.length} characters`);
    console.log(`API Key starts with: ${process.env.OPENAI_API_KEY!.substring(0, 7)}...`);
  }
  console.log();
  
  const aiCriteria = ['brand_story', 'ctas', 'positioning'];
  
  // Get recent AI criterion scores with evidence
  const recentAIScores = await db
    .select({
      score: criterionScores,
      run: effectivenessRuns,
      competitor: competitors
    })
    .from(criterionScores)
    .innerJoin(effectivenessRuns, eq(criterionScores.runId, effectivenessRuns.id))
    .leftJoin(competitors, eq(effectivenessRuns.competitorId, competitors.id))
    .where(or(
      eq(criterionScores.criterion, 'brand_story'),
      eq(criterionScores.criterion, 'ctas'),
      eq(criterionScores.criterion, 'positioning')
    ))
    .orderBy(desc(criterionScores.createdAt))
    .limit(15);
  
  console.log('=== ANALYZING EVIDENCE FROM RECENT AI CRITERIA ===\n');
  
  let realAICount = 0;
  let fallbackCount = 0;
  let unclearCount = 0;
  
  for (const { score, run, competitor } of recentAIScores) {
    const entity = competitor ? competitor.label : 'Clear Digital';
    const evidence = score.evidence as any;
    
    console.log(`${entity} - ${score.criterion}: ${score.score}`);
    console.log(`  Run: ${run.id.slice(0, 8)}...`);
    
    // Check for signs of real AI response vs fallback
    let isRealAI = false;
    let isFallback = false;
    
    // Check for fallback indicators
    if (evidence?.details?.fallback === true) {
      console.log('  ❌ FALLBACK: Explicitly marked as fallback');
      isFallback = true;
    }
    
    // Check for circuit breaker
    if (evidence?.reasoning?.includes('fallback') || 
        evidence?.reasoning?.includes('circuit breaker') ||
        evidence?.reasoning?.includes('service unavailable')) {
      console.log('  ❌ FALLBACK: Circuit breaker or service unavailable');
      isFallback = true;
    }
    
    // Check for real AI response indicators
    if (evidence?.details?.analysisDetails) {
      console.log('  ✅ REAL AI: Has detailed analysis');
      isRealAI = true;
    }
    
    if (evidence?.details?.aiResponse || evidence?.details?.openaiResponse) {
      console.log('  ✅ REAL AI: Has OpenAI response data');
      isRealAI = true;
    }
    
    // Check evidence description length and content
    const desc = evidence?.description || '';
    const reasoning = evidence?.reasoning || '';
    
    if (desc.length > 200 && !desc.includes('fallback')) {
      console.log(`  ✅ REAL AI: Detailed description (${desc.length} chars)`);
      isRealAI = true;
    }
    
    if (reasoning.length > 100 && !reasoning.includes('fallback')) {
      console.log(`  ✅ REAL AI: Detailed reasoning (${reasoning.length} chars)`);
      isRealAI = true;
    }
    
    // Check for specific extracted content
    if (evidence?.details?.heroMessage || 
        evidence?.details?.valueProps ||
        evidence?.details?.brandNarrative ||
        evidence?.details?.ctaButtons) {
      console.log('  ✅ REAL AI: Contains extracted content from page');
      isRealAI = true;
    }
    
    // Show a sample of the evidence
    if (evidence?.description) {
      console.log(`  Evidence: "${evidence.description.substring(0, 100)}..."`);
    }
    
    if (isRealAI && !isFallback) {
      console.log('  🎯 VERDICT: Real AI response');
      realAICount++;
    } else if (isFallback) {
      console.log('  🔄 VERDICT: Fallback score');
      fallbackCount++;
    } else {
      console.log('  ❓ VERDICT: Unclear (might be simplified AI or default)');
      unclearCount++;
    }
    
    console.log();
  }
  
  console.log('=== SUMMARY ===\n');
  console.log(`Total samples analyzed: ${recentAIScores.length}`);
  console.log(`Real AI responses: ${realAICount} (${Math.round(realAICount / recentAIScores.length * 100)}%)`);
  console.log(`Fallback scores: ${fallbackCount} (${Math.round(fallbackCount / recentAIScores.length * 100)}%)`);
  console.log(`Unclear: ${unclearCount} (${Math.round(unclearCount / recentAIScores.length * 100)}%)`);
  
  // Check a specific Monday.com 10.0 score in detail
  console.log('\n=== DEEP DIVE: Monday.com Perfect Scores ===\n');
  
  const mondayPerfectScores = await db
    .select()
    .from(criterionScores)
    .innerJoin(effectivenessRuns, eq(criterionScores.runId, effectivenessRuns.id))
    .innerJoin(competitors, eq(effectivenessRuns.competitorId, competitors.id))
    .where(and(
      eq(competitors.label, 'Monday'),
      or(
        eq(criterionScores.criterion, 'brand_story'),
        eq(criterionScores.criterion, 'ctas'),
        eq(criterionScores.criterion, 'positioning')
      ),
      eq(criterionScores.score, '10')
    ))
    .limit(3);
  
  for (const row of mondayPerfectScores) {
    const score = row.criterionScores;
    if (!score) continue;
    console.log(`\nMonday.com - ${score.criterion}: 10.0`);
    const evidence = score.evidence as any;
    
    if (evidence) {
      console.log('Full evidence structure:');
      console.log(JSON.stringify(evidence, null, 2).substring(0, 1000));
    }
  }
  
  process.exit(0);
}

checkOpenAIEvidence().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});