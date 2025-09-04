#!/usr/bin/env tsx
/**
 * Quick verification of bug fixes
 */

import { EnhancedWebsiteEffectivenessScorer } from './server/services/effectiveness/enhancedScorer';
import logger from './server/utils/logging/logger';

async function testCriterionScoring() {
  console.log('🔧 Testing Criterion Scoring Fixes...');
  
  const scorer = new EnhancedWebsiteEffectivenessScorer();
  
  try {
    // Test a simple, fast scoring run
    const result = await scorer.scoreWebsiteProgressive(
      'https://example.com',
      undefined,
      async (status, progress, results, progressDetail) => {
        console.log(`Status: ${status} | Progress: ${progress}`);
        if (progressDetail?.tierDetails) {
          console.log(`Tier ${progressDetail.tierDetails.tier} complete: ${progressDetail.tierDetails.completedCriteria}/${progressDetail.tierDetails.totalCriteria} criteria`);
        }
      }
    );
    
    console.log(`✅ Scoring complete! Overall Score: ${result.overallScore}`);
    console.log(`✅ Criterion Results: ${result.criterionResults.length}/8 criteria scored`);
    
    // Check if all 8 criteria were scored
    const expectedCriteria = ['ux', 'trust', 'accessibility', 'seo', 'positioning', 'brand_story', 'ctas', 'speed'];
    const scoredCriteria = result.criterionResults.map(r => r.criterion);
    const missingCriteria = expectedCriteria.filter(c => !scoredCriteria.includes(c));
    
    if (missingCriteria.length === 0) {
      console.log('✅ All 8 criteria scored successfully');
    } else {
      console.log(`❌ Missing criteria: ${missingCriteria.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Quick Fix Verification Test\n');
  
  await testCriterionScoring();
  
  console.log('\n✅ Test completed');
  process.exit(0);
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}