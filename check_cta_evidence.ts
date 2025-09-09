import { db } from './server/db';
import { criterionScores } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

async function checkCTAEvidence() {
  console.log('\n=== CTA Evidence Analysis ===\n');
  
  const scores = await db
    .select()
    .from(criterionScores)
    .where(and(
      eq(criterionScores.runId, '617c630e-9665-43f6-b5fb-516c364e24e7'),
      eq(criterionScores.criterion, 'ctas')
    ));
  
  if (scores[0]) {
    const evidence = scores[0].evidence;
    console.log('CTA Content Preview (first 300 chars):');
    console.log(evidence.details.ctaContent);
    console.log('\nAnalysis Results:');
    console.log('- cta_above_fold:', evidence.details.analysis.cta_above_fold);
    console.log('- cta_present:', evidence.details.analysis.cta_present);
    console.log('- Primary CTAs found:', evidence.details.analysis.cta_primary_examples);
    console.log('- Secondary CTAs found:', evidence.details.analysis.cta_secondary_examples);
    console.log('\nFull Analysis Object:');
    console.log(JSON.stringify(evidence.details.analysis, null, 2));
  }
  
  process.exit(0);
}

checkCTAEvidence();
