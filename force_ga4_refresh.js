// Force refresh GA4 data with proper storage for all historical periods
const periods = [
  '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', 
  '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', 
  '2025-04', '2025-05', '2025-06'  // Skip 2025-07 as it's already stored
];

async function forceRefreshGA4Data() {
  console.log('🔧 Force refreshing GA4 data with proper storage...');
  
  for (const period of periods) {
    try {
      console.log(`📅 Processing ${period}...`);
      
      // Call the fixed GET endpoint which now stores data
      const response = await fetch(`http://localhost:5000/api/ga4-data/demo-client-id/${period}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log(`✅ ${period}: Bounce Rate ${result.data.bounceRate.toFixed(1)}% - STORED`);
        } else {
          console.error(`❌ ${period}: No data returned`);
        }
      } else {
        console.error(`❌ ${period}: HTTP ${response.status}`);
      }
      
      // Short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ ${period}: ${error.message}`);
    }
  }
  
  console.log('🎉 GA4 refresh complete - checking storage...');
}

forceRefreshGA4Data().catch(console.error);