// Script to populate 15 months of historical GA4 data
const periods = [
  '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', 
  '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', 
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08'
];

const clientId = 'demo-client-id';

async function fetchAndStoreHistoricalData() {
  console.log('🚀 Starting comprehensive 15-month GA4 data fetch...');
  
  for (const period of periods) {
    try {
      console.log(`📅 Fetching and storing data for ${period}...`);
      
      // First fetch the data
      const fetchResponse = await fetch(`http://localhost:5000/api/ga4-data/${clientId}/${period}`);
      
      if (!fetchResponse.ok) {
        console.error(`❌ Failed to fetch data for ${period}: ${fetchResponse.status}`);
        continue;
      }
      
      const fetchData = await fetchResponse.json();
      
      if (!fetchData.success || !fetchData.data) {
        console.error(`❌ No data returned for ${period}`);
        continue;
      }
      
      // Store the data via the store endpoint
      const storeResponse = await fetch('http://localhost:5000/api/ga4-data/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: clientId,
          period: period,
          data: fetchData.data,
          forceUpdate: true
        })
      });
      
      if (storeResponse.ok) {
        console.log(`✅ Successfully stored data for ${period}`);
      } else {
        console.error(`❌ Failed to store data for ${period}: ${storeResponse.status}`);
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error processing ${period}:`, error.message);
    }
  }
  
  console.log('🎉 Historical data population complete!');
}

fetchAndStoreHistoricalData().catch(console.error);