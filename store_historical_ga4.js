// Script to properly store 15 months of GA4 data using the existing services
const periods = [
  '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', 
  '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', 
  '2025-04', '2025-05', '2025-06'  // Skip 2025-07 since it's already stored
];

const clientId = 'demo-client-id';

async function storeHistoricalGA4Data() {
  console.log('🚀 Starting GA4 historical data storage using existing services...');
  
  for (const period of periods) {
    try {
      console.log(`📅 Processing period ${period}...`);
      
      // Use the POST refresh endpoint that properly stores data
      const response = await fetch(`http://localhost:5000/api/refresh-ga4-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: clientId,
          period: period,
          forceRefresh: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Successfully processed ${period}:`, result.message);
      } else {
        console.error(`❌ Failed to process ${period}: ${response.status}`);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing ${period}:`, error.message);
    }
  }
  
  console.log('🎉 Historical GA4 data storage complete!');
  
  // Verify stored data
  console.log('🔍 Verifying stored data...');
  try {
    const verifyResponse = await fetch('http://localhost:5000/api/metrics/count');
    if (verifyResponse.ok) {
      const countData = await verifyResponse.json();
      console.log('📊 Data verification:', countData);
    }
  } catch (error) {
    console.log('Could not verify data count:', error.message);
  }
}

storeHistoricalGA4Data().catch(console.error);