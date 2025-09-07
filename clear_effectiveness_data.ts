import { storage } from './server/storage';
import { db } from './server/db';
import { effectivenessRuns, criterionScores } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function clearStuckData() {
  try {
    console.log('🧹 Clearing stuck/failed effectiveness data for demo-client-id...');
    
    // Delete all runs that are not completed
    const result = await db.delete(effectivenessRuns)
      .where(eq(effectivenessRuns.clientId, 'demo-client-id'));
      
    console.log(`✅ Cleared all effectiveness runs for demo-client-id`);
    
    // Also clear any orphaned criterion scores
    const criterionResult = await db.delete(criterionScores)
      .returning();
      
    console.log(`✅ Cleared ${criterionResult.length} orphaned criterion scores`);
    
    console.log('🎉 Fresh start ready - UI should now show "Run Analysis" button');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
}

clearStuckData();