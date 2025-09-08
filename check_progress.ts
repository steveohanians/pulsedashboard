/**
 * Quick Progress Check
 * 
 * Shows current effectiveness analysis status and progress
 */

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

const CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';

async function checkProgress() {
  console.log(`🔍 Checking Progress for Client: ${CLIENT_ID}\n`);
  
  try {
    // Get latest run
    const latestRun = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, CLIENT_ID))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (latestRun.length === 0) {
      console.log('✅ No runs found - Clean state');
      console.log('   UI should show: "Ready for Analysis"');
      return;
    }
    
    const run = latestRun[0];
    const isRunning = ['pending', 'initializing', 'in_progress', 'scraping', 'analyzing', 
                      'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing'].includes(run.status);
    
    console.log('📊 Latest Run Status:');
    console.log(`   ID: ${run.id}`);
    console.log(`   Status: ${run.status} ${isRunning ? '🔄 (RUNNING)' : ''}`);
    console.log(`   Progress: ${run.progress || '0%'}`);
    console.log(`   Started: ${run.createdAt.toISOString()}`);
    console.log(`   Age: ${Math.round((Date.now() - run.createdAt.getTime()) / 1000)} seconds ago`);
    
    if (run.progressDetail) {
      console.log(`   Detail: ${run.progressDetail}`);
    }
    
    if (isRunning) {
      console.log('\n⚠️  Analysis is currently running!');
      console.log('   To stop it, run: npx tsx stop_effectiveness_run.ts stop');
      console.log('   To clean all runs: npx tsx stop_effectiveness_run.ts clean');
    } else {
      console.log('\n✅ No analysis currently running');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProgress().then(() => process.exit(0));