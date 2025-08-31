import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function clearAllRuns() {
  try {
    const result = await db.execute(sql`
      DELETE FROM effectiveness_runs
      WHERE client_id = 'demo-client-id'
        AND created_at > NOW() - INTERVAL '24 hours'
    `);

    console.log(`Cleared ${(result as any).rowCount} effectiveness runs from last 24 hours`);
  } catch (error) {
    console.error('Delete failed:', error);
  }
}

clearAllRuns().catch(console.error);