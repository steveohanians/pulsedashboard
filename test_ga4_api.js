// Test GA4 storage after fixing TypeScript errors
async function testGA4Storage() {
  console.log('🧪 Testing GA4 storage...');
  
  // Test one period to verify storage works
  const testPeriod = '2024-08';
  
  try {
    console.log(`📅 Testing storage for ${testPeriod}...`);
    
    const response = await fetch(`http://localhost:5000/api/ga4-data/demo-client-id/${testPeriod}`, {
      method: 'GET'
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Fetched ${testPeriod}: ${result.data.bounceRate.toFixed(1)}% bounce rate`);
    } else {
      console.error(`❌ Failed to fetch ${testPeriod}: ${response.status}`);
    }
    
    // Wait a moment and check database
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const checkResponse = await fetch('http://localhost:5000/api/admin/metrics-count', {
      method: 'GET'
    });
    
    if (checkResponse.ok) {
      const counts = await checkResponse.json();
      console.log('📊 Database check:', counts);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGA4Storage().catch(console.error);