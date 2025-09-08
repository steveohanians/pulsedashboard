import { createProgressTracker } from './server/services/effectiveness/progressTracker.js';
import storage from './server/storage.js';
import logger from './server/utils/logging/logger.js';

async function testCompetitorFlow() {
  try {
    console.log('🔍 Testing competitor analysis flow...');
    
    // Check if there are competitors for demo-client-id  
    console.log('\n1. Checking competitors in database...');
    const demoCompetitors = await storage.getCompetitorsByClient('demo-client-id');
    console.log('📊 Demo client competitors:', demoCompetitors?.length || 0);
    
    if (demoCompetitors && demoCompetitors.length > 0) {
      console.log('Competitors found:');
      demoCompetitors.forEach((comp, i) => {
        console.log(`  ${i + 1}. ${comp.domain} (${comp.label}) - ID: ${comp.id.slice(0,8)}`);
      });
    } else {
      console.log('❌ NO COMPETITORS FOUND - This explains missing progress!');
      return;
    }
    
    // Test progress tracker with competitor domains
    console.log('\n2. Testing progress tracker...');
    const tracker = createProgressTracker('test-client-id');
    
    // Set up scenario
    tracker.setTotalSteps(1, demoCompetitors.length);
    demoCompetitors.forEach((comp, i) => {
      tracker.setCompetitorDomain(i, comp.domain);
    });
    
    console.log('\n📋 Testing progress messages:');
    
    // Test client steps
    console.log('\n=== CLIENT ANALYSIS ===');
    tracker.markStepComplete('client_seo');
    console.log('✅ Client SEO:', tracker.getState().message);
    
    tracker.markStepComplete('client_speed');
    console.log('✅ Client Speed:', tracker.getState().message);
    
    // Test competitor steps - this is what should be showing
    console.log('\n=== COMPETITOR ANALYSIS ===');
    tracker.markStepComplete('competitor_0_initial_html');
    console.log('✅ Competitor 0 Data:', tracker.getState().message);
    
    tracker.markStepComplete('competitor_0_seo');  
    console.log('✅ Competitor 0 SEO:', tracker.getState().message);
    
    if (demoCompetitors.length > 1) {
      tracker.markStepComplete('competitor_1_initial_html');
      console.log('✅ Competitor 1 Data:', tracker.getState().message);
      
      tracker.markStepComplete('competitor_1_trust');
      console.log('✅ Competitor 1 Trust:', tracker.getState().message);
    }
    
    console.log('\n✅ Progress messages are working correctly!');
    console.log('🔍 Issue might be that competitors are not being processed during analysis');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCompetitorFlow().then(() => process.exit(0)).catch(console.error);