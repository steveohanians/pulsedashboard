import { db } from './server/db.js';
import { effectivenessRuns } from './shared/schema.js';
import { desc, eq, isNull, and, or } from 'drizzle-orm';

async function testFixedQuery() {
  try {
    console.log('🔧 Testing fixed query logic...');
    
    const clientId = 'demo-client-id';
    
    // First try to get the latest completed run
    console.log('1. Looking for completed runs...');
    const completedResults = await db
      .select()
      .from(effectivenessRuns)
      .where(and(
        eq(effectivenessRuns.clientId, clientId),
        isNull(effectivenessRuns.competitorId),
        eq(effectivenessRuns.status, 'completed')
      ))
      .orderBy(desc(effectivenessRuns.createdAt))
      .limit(1);
    
    if (completedResults.length > 0) {
      console.log('✅ Found completed run:', completedResults[0].id.slice(0,8), 'score:', completedResults[0].overallScore);
      
      // Test API
      const response = await fetch('http://localhost:5000/api/effectiveness/latest/demo-client-id');
      const data = await response.json();
      
      console.log('🌐 API returns:', data.run.id.slice(0,8), 'status:', data.run.status, 'score:', data.run.overallScore);
      
      if (data.run.id === completedResults[0].id) {
        console.log('🎉 SUCCESS: API now returns the correct completed run!');
      } else {
        console.log('❌ API still returns wrong run. Server may need reload.');
      }
    } else {
      console.log('❌ No completed runs found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFixedQuery().then(() => process.exit(0)).catch(console.error);