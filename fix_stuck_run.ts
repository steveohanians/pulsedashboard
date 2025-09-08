import { db } from './server/db.ts';
import { effectivenessRuns } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function fixStuckRun() {
  try {
    const stuckRunId = '7bfaaef0-343c-4834-b825-f66707f6c003';
    
    console.log(`Updating stuck run ${stuckRunId.slice(0, 8)} to failed status...`);
    
    const result = await db.update(effectivenessRuns)
      .set({
        status: 'failed',
        progressDetail: 'Analysis interrupted by server restart'
      })
      .where(eq(effectivenessRuns.id, stuckRunId))
      .returning();

    if (result.length > 0) {
      console.log('✅ Successfully updated stuck run to failed status');
      console.log({
        id: result[0].id?.slice(0, 8),
        status: result[0].status,
        progress: result[0].progress,
        progressDetail: result[0].progressDetail
      });
    } else {
      console.log('❌ No run found with that ID');
    }
  } catch (error) {
    console.error('Error fixing stuck run:', error);
  } finally {
    process.exit(0);
  }
}

fixStuckRun();