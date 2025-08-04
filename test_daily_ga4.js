/**
 * Test script to fetch daily GA4 data for July 2025 (current period)
 * This will demonstrate the daily data fetching for intra-month variations
 */

const fetch = require('node-fetch');

async function testDailyGA4Fetch() {
  try {
    console.log('🧪 Testing daily GA4 data fetch for demo-client-id...');
    
    // Test the admin route for refreshing current daily data
    const response = await fetch('http://localhost:5000/api/admin/ga4/refresh-current-daily/demo-client-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.text();
    console.log('📊 Admin route response:', result);
    
    // Also test direct GA4 daily data endpoint
    const directResponse = await fetch('http://localhost:5000/api/ga4-data/daily/demo-client-id/2025-07', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const directResult = await directResponse.text();
    console.log('🔧 Direct GA4 daily endpoint response:', directResult);
    
  } catch (error) {
    console.error('❌ Error testing daily GA4 fetch:', error.message);
  }
}

testDailyGA4Fetch();