/**
 * Inspect what data is sent to OpenAI for insights generation
 */

import { db } from './server/db';
import { effectivenessRuns, criterionScores } from '@shared/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { EffectivenessPromptBuilder } from './server/services/effectiveness/promptBuilder';

async function inspectOpenAIData() {
  console.log('\n=== Inspecting OpenAI Input Data ===\n');
  
  try {
    // Get the latest client run
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        isNull(effectivenessRuns.competitorId)
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (runs.length === 0) {
      console.log('No runs found');
      return;
    }
    
    const run = runs[0];
    console.log('Run ID:', run.id);
    console.log('Overall Score:', run.overallScore);
    console.log('');
    
    // Get criterion scores
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, run.id));
    
    console.log('=== Criterion Scores Sent to OpenAI ===\n');
    scores.forEach(score => {
      console.log(`${score.criterion}: ${score.score}/10`);
      if (score.passes) {
        console.log('  Passed checks:', score.passes.passed);
        console.log('  Failed checks:', score.passes.failed);
      }
      console.log('');
    });
    
    // Look specifically for CTA checks
    console.log('=== CTA-Related Data ===\n');
    const ctaScore = scores.find(s => s.criterion === 'ctas');
    if (ctaScore) {
      console.log('CTAs Score:', ctaScore.score);
      console.log('CTAs Passes:', JSON.stringify(ctaScore.passes, null, 2));
      console.log('CTAs Evidence:', JSON.stringify(ctaScore.evidence, null, 2));
    }
    
    // Show what the prompt builder would extract
    console.log('\n=== Failed Checks Sent to OpenAI ===\n');
    const failedChecks = scores
      .flatMap(criterion => criterion.passes?.failed || [])
      .filter(Boolean);
    console.log('Failed checks:', failedChecks);
    
    // Show human-readable descriptions
    console.log('\n=== Human-Readable Failed Checks ===\n');
    const CHECK_DESCRIPTIONS: Record<string, string> = {
      no_target_audience: "missing clear target audience definition",
      no_specific_value: "lacking specific value propositions",
      no_third_party_proof: "absence of third-party validation",
      lcp_poor: "slow page loading speed",
      few_above_fold_ctas: "limited call-to-action visibility",
      no_proof_elements: "missing proof elements",
      no_recent_proof: "outdated testimonials or case studies",
      poor_mobile_ux: "suboptimal mobile experience",
      missing_alt_text: "accessibility issues with images",
      poor_contrast: "poor color contrast",
      no_clear_value_prop: "unclear value proposition",
      weak_cta_copy: "weak call-to-action messaging",
      missing_urgency: "lack of urgency elements",
      no_social_proof: "insufficient social proof",
      poor_navigation: "confusing navigation structure",
      missing_contact_info: "hard-to-find contact information",
      no_clear_approach: "unclear service approach or methodology",
      brevity_check: "overly verbose content that needs simplification",
      no_sitemap: "missing XML sitemap",
      no_structured_data: "absence of structured data markup"
    };
    
    const readableFailedChecks = failedChecks
      .map(check => CHECK_DESCRIPTIONS[check] || check)
      .join(', ');
    console.log('Human-readable:', readableFailedChecks);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

inspectOpenAIData();
