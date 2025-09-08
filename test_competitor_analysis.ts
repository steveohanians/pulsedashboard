import { EffectivenessService } from './server/services/EffectivenessService.js';
import { createProgressTracker } from './server/services/effectiveness/progressTracker.js';
import logger from './server/utils/logging/logger.js';

async function testCompetitorAnalysis() {
  try {
    console.log('🔍 Testing competitor analysis flow...');
    
    // Create service and tracker
    const service = new EffectivenessService();
    const tracker = createProgressTracker('test-client-id');
    
    // Set up scenario with 2 competitors
    tracker.setTotalSteps(1, 2);
    tracker.setCompetitorDomain(0, 'stripe.com');
    tracker.setCompetitorDomain(1, 'monday.com');
    
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
    
    tracker.markStepComplete('competitor_1_initial_html');
    console.log('✅ Competitor 1 Data:', tracker.getState().message);
    
    tracker.markStepComplete('competitor_1_trust');
    console.log('✅ Competitor 1 Trust:', tracker.getState().message);
    
    // Now let's check the actual flow to see where it might be skipping competitors
    console.log('\n🔍 Checking actual effectiveness service logic...');
    
    // Check if there are competitors for demo-client-id  
    const storage = await import('./server/storage.js');
    const demoCompetitors = await storage.default.getCompetitorsByClient('demo-client-id');
    console.log('📊 Demo client competitors:', demoCompetitors?.length || 0);
    
    if (demoCompetitors && demoCompetitors.length > 0) {
      console.log('Competitors found:');
      demoCompetitors.forEach((comp, i) => {
        console.log(`  ${i + 1}. ${comp.domain} (${comp.label})`);
      });
    } else {
      console.log('❌ NO COMPETITORS FOUND - This explains missing progress!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCompetitorAnalysis().then(() => process.exit(0)).catch(console.error);