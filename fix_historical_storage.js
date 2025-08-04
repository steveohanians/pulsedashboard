// Directly use the GA4 service to store historical data with proper period parameters
const periods = [
  '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', 
  '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', 
  '2025-04', '2025-05', '2025-06'  // Skip 2025-07 since it's already there
];

async function storeHistoricalDataDirectly() {
  console.log('🚀 Starting direct GA4 historical data storage...');
  
  for (const period of periods) {
    try {
      console.log(`📅 Processing ${period}...`);
      
      // Calculate date range for the period
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`  📊 Date range: ${startDateStr} to ${endDateStr}`);
      
      // Call the fetch endpoint which should store data with period parameter
      const response = await fetch(`http://localhost:5000/api/ga4-data/demo-client-id/${period}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log(`  ✅ Fetched data for ${period}: ${result.data.bounceRate.toFixed(1)}% bounce rate`);
          
          // Check if data was stored by calling a simple verification
          const verifyResponse = await fetch(`http://localhost:5000/api/ga4-data/demo-client-id/${period}`, {
            method: 'GET'
          });
          
          if (verifyResponse.ok) {
            console.log(`  ✅ Data available for ${period}`);
          }
        } else {
          console.error(`  ❌ No data returned for ${period}`);
        }
      } else {
        console.error(`  ❌ Failed to fetch ${period}: ${response.status}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing ${period}:`, error.message);
    }
  }
  
  console.log('🎉 Historical data processing complete!');
}

storeHistoricalDataDirectly().catch(console.error);