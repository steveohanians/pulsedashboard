#!/usr/bin/env npx tsx
/**
 * Test script to verify competitor analysis fix
 * Tests that competitor criteria are properly analyzed and not skipped
 */

import { effectivenessService } from './server/services/EffectivenessService';
import { db } from './server/db';
import { effectivenessRuns, criterionScores } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import logger from './server/utils/logging/logger';

async function testCompetitorAnalysis() {
  const clientId = process.argv[2] || 'demo-client-id';
  
  logger.info('Testing competitor analysis fix', { clientId });
  
  try {
    // Start analysis
    logger.info('Starting effectiveness analysis...');
    const { runId } = await effectivenessService.startAnalysis(clientId, true);
    logger.info('Analysis started', { runId });
    
    // Monitor progress
    let lastStatus = '';
    let checkCount = 0;
    const maxChecks = 120; // 2 minutes max
    
    while (checkCount < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const progress = await effectivenessService.getProgress(runId);
      if (progress && progress.progressDetail !== lastStatus) {
        lastStatus = progress.progressDetail;
        logger.info('Progress update', {
          status: progress.status,
          percent: progress.progress,
          detail: progress.progressDetail,
          currentStep: progress.currentStep
        });
      }
      
      if (progress?.status === 'completed' || progress?.status === 'failed') {
        logger.info('Analysis finished', { 
          status: progress.status,
          finalProgress: progress.progress 
        });
        break;
      }
      
      checkCount++;
    }
    
    // Check results - specifically competitor criteria
    logger.info('Checking competitor criterion scores...');
    
    // Get all runs for this analysis session
    const runs = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, clientId))
      .orderBy(effectivenessRuns.createdAt)
      .limit(10);
    
    logger.info(`Found ${runs.length} effectiveness runs`);
    
    // Check each run for criterion scores
    for (const run of runs) {
      const scores = await db
        .select()
        .from(criterionScores)
        .where(eq(criterionScores.runId, run.id));
      
      const runType = run.competitorId ? 'Competitor' : 'Client';
      logger.info(`${runType} run ${run.id.slice(0, 8)}:`, {
        status: run.status,
        overallScore: run.overallScore,
        criteriaCount: scores.length,
        criteria: scores.map(s => s.criterion)
      });
      
      if (run.competitorId && scores.length === 0) {
        logger.error('❌ COMPETITOR CRITERIA SKIPPED!', {
          runId: run.id,
          competitorId: run.competitorId
        });
      } else if (run.competitorId && scores.length > 0) {
        logger.info('✅ Competitor criteria analyzed successfully', {
          runId: run.id,
          competitorId: run.competitorId,
          criteriaAnalyzed: scores.length
        });
      }
    }
    
    // Summary
    const competitorRuns = runs.filter(r => r.competitorId);
    const competitorRunsWithScores = competitorRuns.filter(async r => {
      const scores = await db
        .select()
        .from(criterionScores)
        .where(eq(criterionScores.runId, r.id));
      return scores.length > 0;
    });
    
    logger.info('Test Summary:', {
      totalRuns: runs.length,
      competitorRuns: competitorRuns.length,
      competitorRunsWithCriteria: competitorRunsWithScores.length,
      fixWorking: competitorRunsWithScores.length === competitorRuns.length
    });
    
  } catch (error) {
    logger.error('Test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testCompetitorAnalysis().catch(error => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});