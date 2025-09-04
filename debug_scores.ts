#!/usr/bin/env tsx
/**
 * Debug competitor scoring storage
 */

import { storage } from './server/storage';

async function debugScores() {
  console.log('🔍 DEBUGGING COMPETITOR SCORES\n');
  
  try {
    const clients = await storage.getClients();
    const demoClient = clients.find(c => c.id === 'demo-client-id');
    
    // Get recent competitor runs
    const competitors = await storage.getCompetitorsByClient(demoClient.id);
    console.log(`Found ${competitors.length} competitors`);
    
    for (const comp of competitors) {
      console.log(`\n🔍 Competitor: ${comp.id} (${comp.name || 'Unnamed'})`);
      
      const competitorRun = await storage.getLatestEffectivenessRunByCompetitor(demoClient.id, comp.id);
      if (competitorRun) {
        console.log(`   Latest run: ${competitorRun.id}`);
        console.log(`   Status: ${competitorRun.status}`);
        console.log(`   Score: ${competitorRun.overallScore}`);
        
        // Get ALL criterion scores for this run
        const allScores = await storage.getCriterionScores(competitorRun.id);
        console.log(`   Total scores in DB: ${allScores.length}`);
        
        if (allScores.length > 0) {
          console.log(`   📊 Scores found:`);
          allScores.forEach(score => {
            console.log(`     ${score.criterion}: ${score.score} (competitorId: ${score.competitorId || 'null'})`);
          });
        } else {
          console.log(`   ❌ No scores found in database for run ${competitorRun.id}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  debugScores().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  });
}