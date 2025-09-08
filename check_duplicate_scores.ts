#!/usr/bin/env npx tsx
/**
 * Check for duplicate scores in the database
 */

import { db } from './server/db';
import { effectivenessRuns, criterionScores, clients, competitors } from './shared/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';

async function checkDuplicateScores() {
  console.log('Checking for duplicate scores...\n');
  
  // Get the latest runs for Clear Digital
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.name, 'Clear Digital'))
    .limit(1);
    
  if (!client.length) {
    console.log('Clear Digital client not found');
    return;
  }
  
  const clientId = client[0].id;
  console.log(`Client: ${client[0].name} (${clientId})`);
  console.log(`Website: ${client[0].websiteUrl}\n`);
  
  // Get latest effectiveness runs
  const runs = await db
    .select({
      run: effectivenessRuns,
      competitor: competitors
    })
    .from(effectivenessRuns)
    .leftJoin(competitors, eq(effectivenessRuns.competitorId, competitors.id))
    .where(eq(effectivenessRuns.clientId, clientId))
    .orderBy(desc(effectivenessRuns.createdAt))
    .limit(10);
  
  console.log(`Found ${runs.length} recent runs\n`);
  
  // Group runs by type
  const clientRun = runs.find(r => !r.run.competitorId);
  const competitorRuns = runs.filter(r => r.run.competitorId);
  
  // Get scores for each run
  const runScores: { [key: string]: any } = {};
  
  if (clientRun) {
    const scores = await db
      .select()
      .from(criterionScores)
      .where(eq(criterionScores.runId, clientRun.run.id))
      .orderBy(criterionScores.criterion);
    
    runScores['Clear Digital'] = {
      runId: clientRun.run.id,
      overallScore: clientRun.run.overallScore,
      status: clientRun.run.status,
      scores: scores.map(s => ({
        criterion: s.criterion,
        score: parseFloat(s.score)
      }))
    };
  }
  
  for (const compRun of competitorRuns) {
    if (compRun.competitor) {
      const scores = await db
        .select()
        .from(criterionScores)
        .where(eq(criterionScores.runId, compRun.run.id))
        .orderBy(criterionScores.criterion);
      
      runScores[compRun.competitor.label] = {
        runId: compRun.run.id,
        domain: compRun.competitor.domain,
        overallScore: compRun.run.overallScore,
        status: compRun.run.status,
        scores: scores.map(s => ({
          criterion: s.criterion,
          score: parseFloat(s.score)
        }))
      };
    }
  }
  
  // Display results
  console.log('=== ANALYSIS RESULTS ===\n');
  
  for (const [name, data] of Object.entries(runScores)) {
    console.log(`${name}:`);
    console.log(`  Run ID: ${data.runId.slice(0, 8)}...`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Overall Score: ${data.overallScore}`);
    if (data.domain) {
      console.log(`  Domain: ${data.domain}`);
    }
    console.log('  Criterion Scores:');
    for (const score of data.scores) {
      console.log(`    ${score.criterion}: ${score.score}`);
    }
    console.log();
  }
  
  // Check for duplicates
  console.log('=== DUPLICATE CHECK ===\n');
  
  const names = Object.keys(runScores);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const name1 = names[i];
      const name2 = names[j];
      const scores1 = runScores[name1].scores;
      const scores2 = runScores[name2].scores;
      
      if (scores1.length === scores2.length && scores1.length > 0) {
        const allSame = scores1.every((s1: any, idx: number) => 
          s1.score === scores2[idx].score && s1.criterion === scores2[idx].criterion
        );
        
        if (allSame) {
          console.log(`⚠️  DUPLICATE SCORES: ${name1} and ${name2} have identical scores!`);
          console.log(`    ${name1} domain: ${runScores[name1].domain || client[0].websiteUrl}`);
          console.log(`    ${name2} domain: ${runScores[name2].domain || client[0].websiteUrl}`);
        }
      }
    }
  }
  
  process.exit(0);
}

checkDuplicateScores().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});