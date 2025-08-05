// Test script to manually trigger portfolio sync for June 2025 with Summary endpoint
import { semrushService } from './server/services/semrush/semrushService.js';

async function testPortfolioSyncJune2025() {
  console.log('🧪 Testing portfolio sync for June 2025 with Summary endpoint...');
  
  try {
    // Test if SEMrush service can fetch June 2025 data for Splunk
    const domain = 'splunk.com';
    const result = await semrushService.fetchHistoricalData(domain);
    
    console.log('📊 Historical data result size:', result.size);
    
    // Check if June 2025 data exists
    const june2025Data = result.get('2025-06');
    if (june2025Data) {
      console.log('✅ June 2025 data found for', domain);
      console.log('📈 Traffic channels count:', june2025Data.trafficChannels.length);
      console.log('🚀 Traffic channels sample:', june2025Data.trafficChannels.slice(0, 3));
    } else {
      console.log('❌ No June 2025 data found for', domain);
    }
    
    // List all available periods
    console.log('📅 Available periods:', Array.from(result.keys()));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPortfolioSyncJune2025();