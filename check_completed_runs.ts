import { db } from './server/db.js';
import { effectivenessRuns } from './shared/schema.js';
import { desc, eq, isNull, and } from 'drizzle-orm';

async function checkCompletedRuns() {
  try {
    console.log('🔍 Checking completed runs query...');
    
    const completedRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, 'demo-client-id'),
        isNull(effectivenessRuns.competitorId),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt));
      
    console.log('📊 Found', completedRuns.length, 'completed runs:');
    completedRuns.forEach(run => {
      console.log(`- ${run.id.slice(0,8)}: score=${run.overallScore}, created=${run.createdAt.toISOString().slice(0,16)}`);
    });
    
    if (completedRuns.length === 0) {
      console.log('\n⚠️  No completed runs found! That\'s why API returns latest run of any status.');
      
      // Check all runs to see their statuses
      console.log('\n🔍 All runs:');
      const allRuns = await db
        .select()
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, 'demo-client-id'),
          isNull(effectivenessRuns.competitorId)
        ))
        .orderBy(desc(effectivenessRuns.createdAt))
        .limit(5);
        
      allRuns.forEach(run => {
        console.log(`- ${run.id.slice(0,8)}: status="${run.status}", score=${run.overallScore}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCompletedRuns().then(() => process.exit(0)).catch(console.error);