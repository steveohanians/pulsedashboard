import { db } from './server/db.js';
import { effectivenessRuns } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function cleanupStuckRun() {
  try {
    console.log('🔧 Cleaning up stuck analysis run...');

    // Update the stuck analyzing run to failed status
    const result = await db.update(effectivenessRuns)
      .set({ 
        status: 'failed',
        progress: 'Analysis interrupted - database connection issue',
        updatedAt: new Date()
      })
      .where(eq(effectivenessRuns.id, '1ad6857c-11a4-4ca0-84fa-9fb335845994'))
      .returning();

    console.log('✅ Updated stuck run:', result[0]?.id?.slice(0,8) || 'No rows affected');

    // Test the API call to verify fix
    console.log('🧪 Testing API response...');
    const response = await fetch('http://localhost:5000/api/effectiveness/latest/demo-client-id');
    
    if (!response.ok) {
      console.log('❌ API request failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('📊 API now returns run:', data.run?.id?.slice(0,8), 'status:', data.run?.status, 'score:', data.run?.overallScore);
    
    if (data.run?.status === 'completed' && data.run?.overallScore) {
      console.log('🎉 SUCCESS: API now returns completed results!');
    } else {
      console.log('⚠️  Still showing incomplete results');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupStuckRun().then(() => process.exit(0)).catch(console.error);