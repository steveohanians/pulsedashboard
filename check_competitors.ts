import { db } from './server/db.js';
import { competitors } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { createProgressTracker } from './server/services/effectiveness/progressTracker.js';

async function checkCompetitors() {
  try {
    console.log('🔍 Checking competitors for demo-client-id...');
    
    const demoCompetitors = await db
      .select()
      .from(competitors)
      .where(eq(competitors.clientId, 'demo-client-id'));
    
    console.log('📊 Found competitors:', demoCompetitors.length);
    
    if (demoCompetitors.length === 0) {
      console.log('❌ NO COMPETITORS FOUND!');
      console.log('   This explains why no competitor progress messages show.');
      console.log('   The analysis only processes the client, not competitors.');
      return;
    }
    
    console.log('\nCompetitors found:');
    demoCompetitors.forEach((comp, i) => {
      console.log(`  ${i + 1}. ${comp.domain} (${comp.label}) - ID: ${comp.id.slice(0,8)}`);
    });
    
    // Test progress tracker messages
    console.log('\n📋 Testing expected competitor progress messages:');
    const tracker = createProgressTracker('test');
    tracker.setTotalSteps(1, demoCompetitors.length);
    
    demoCompetitors.forEach((comp, i) => {
      tracker.setCompetitorDomain(i, comp.domain);
    });
    
    // Simulate competitor analysis steps
    console.log('\n=== EXPECTED COMPETITOR MESSAGES ===');
    
    tracker.markStepComplete('competitor_0_initial_html');
    console.log(`Step: competitor_0_initial_html → "${tracker.getState().message}"`);
    
    tracker.markStepComplete('competitor_0_seo');  
    console.log(`Step: competitor_0_seo → "${tracker.getState().message}"`);
    
    if (demoCompetitors.length > 1) {
      tracker.markStepComplete('competitor_1_seo');
      console.log(`Step: competitor_1_seo → "${tracker.getState().message}"`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCompetitors().then(() => process.exit(0)).catch(console.error);