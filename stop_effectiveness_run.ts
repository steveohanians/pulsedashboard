/**
 * Stop Effectiveness Run Script
 * 
 * Stops any running effectiveness analysis and cleans up the database state
 */

import { db } from './server/db';
import { effectivenessRuns } from './shared/schema';
import { eq, and, or } from 'drizzle-orm';
import logger from './server/utils/logging/logger';

const CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';

async function stopEffectivenessRun() {
  console.log('🛑 Stopping Effectiveness Analysis...\n');
  
  try {
    // 1. Check current running analysis
    console.log('1. Checking for running analysis...');
    
    const runningAnalysis = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, CLIENT_ID),
        or(
          eq(effectivenessRuns.status, 'pending'),
          eq(effectivenessRuns.status, 'initializing'),
          eq(effectivenessRuns.status, 'in_progress'),
          eq(effectivenessRuns.status, 'scraping'),
          eq(effectivenessRuns.status, 'analyzing'),
          eq(effectivenessRuns.status, 'tier1_analyzing'),
          eq(effectivenessRuns.status, 'tier2_analyzing'),
          eq(effectivenessRuns.status, 'tier3_analyzing')
        )
      ))
      .orderBy(effectivenessRuns.createdAt);
    
    if (runningAnalysis.length === 0) {
      console.log('✅ No running analysis found');
      
      // Check if there are any runs at all
      const allRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(eq(effectivenessRuns.clientId, CLIENT_ID))
        .orderBy(effectivenessRuns.createdAt)
        .limit(5);
        
      if (allRuns.length === 0) {
        console.log('📝 No analysis runs found for this client');
      } else {
        console.log(`📊 Found ${allRuns.length} previous runs:`);
        allRuns.forEach((run, index) => {
          console.log(`   ${index + 1}. ${run.status} - ${run.progress || '0%'} - ${run.createdAt.toISOString()}`);
        });
      }
      
      return;
    }
    
    console.log(`⚠️  Found ${runningAnalysis.length} running analysis(es):`);
    runningAnalysis.forEach((run, index) => {
      console.log(`   ${index + 1}. ID: ${run.id}`);
      console.log(`      Status: ${run.status}`);
      console.log(`      Progress: ${run.progress || '0%'}`);
      console.log(`      Started: ${run.createdAt.toISOString()}`);
      console.log(`      Detail: ${run.progressDetail || 'N/A'}`);
      console.log('');
    });
    
    // 2. Stop the running analysis
    console.log('2. Stopping running analysis...');
    
    const runIds = runningAnalysis.map(run => run.id);
    
    const result = await db
      .update(effectivenessRuns)
      .set({
        status: 'failed',
        progress: '0%',
        progressDetail: JSON.stringify({
          error: 'Analysis stopped by user',
          stoppedAt: new Date().toISOString()
        })
      })
      .where(or(...runIds.map(id => eq(effectivenessRuns.id, id))));
    
    console.log(`✅ Stopped ${runIds.length} running analysis(es)`);
    
    // 3. Check final state
    console.log('\n3. Final state check...');
    
    const finalCheck = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, CLIENT_ID))
      .orderBy(effectivenessRuns.createdAt)
      .limit(3);
    
    console.log('📊 Latest runs after cleanup:');
    finalCheck.forEach((run, index) => {
      console.log(`   ${index + 1}. ${run.status} - ${run.progress || '0%'} - ${run.createdAt.toISOString()}`);
    });
    
    console.log('\n🎉 Analysis cleanup completed!');
    console.log('   The UI should now show idle state when you refresh.');
    
  } catch (error) {
    console.error('❌ Error stopping analysis:', error);
    process.exit(1);
  }
}

// Alternative: Delete all runs to get completely clean state
async function deleteAllRuns() {
  console.log('🗑️  Deleting ALL effectiveness runs (clean slate)...\n');
  
  try {
    const deletedRuns = await db
      .delete(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, CLIENT_ID));
    
    console.log('✅ All runs deleted - completely clean state');
    console.log('   The UI will show idle state on next load.');
    
  } catch (error) {
    console.error('❌ Error deleting runs:', error);
    process.exit(1);
  }
}

// Main function with options
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stop';
  
  console.log(`🔧 Using CLIENT_ID: ${CLIENT_ID}`);
  console.log('   (Set CLIENT_ID environment variable to change)\n');
  
  switch (command) {
    case 'stop':
      await stopEffectivenessRun();
      break;
    case 'clean':
      await deleteAllRuns();
      break;
    case 'status':
      await checkStatus();
      break;
    default:
      console.log('Usage:');
      console.log('  npx tsx stop_effectiveness_run.ts stop   # Stop running analysis');
      console.log('  npx tsx stop_effectiveness_run.ts clean  # Delete all runs (clean slate)');
      console.log('  npx tsx stop_effectiveness_run.ts status # Check current status');
      break;
  }
  
  process.exit(0);
}

// Status check function
async function checkStatus() {
  console.log('📊 Checking Current Status...\n');
  
  try {
    const allRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, CLIENT_ID))
      .orderBy(effectivenessRuns.createdAt);
    
    if (allRuns.length === 0) {
      console.log('✅ Clean state - No runs found');
      console.log('   UI should show: "Ready for Analysis"');
      return;
    }
    
    console.log(`📈 Found ${allRuns.length} total runs:`);
    
    const statusCounts = {};
    allRuns.forEach(run => {
      const status = run.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\n📊 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} runs`);
    });
    
    console.log('\n🕐 Latest 5 runs:');
    allRuns.slice(-5).forEach((run, index) => {
      const isRunning = ['pending', 'initializing', 'in_progress', 'scraping', 'analyzing', 
                        'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing'].includes(run.status);
      const indicator = isRunning ? '🔄' : (run.status === 'completed' ? '✅' : '❌');
      
      console.log(`   ${indicator} ${run.status} - ${run.progress || '0%'} - ${run.createdAt.toISOString()}`);
      if (run.progressDetail) {
        console.log(`      Detail: ${run.progressDetail}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking status:', error);
    process.exit(1);
  }
}

// Check if this is the main module (ESM compatible)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  main().catch(console.error);
}