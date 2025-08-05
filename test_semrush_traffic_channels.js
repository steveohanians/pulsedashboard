// Test script to verify SEMrush Summary endpoint provides traffic channel data

async function testSEMrushTrafficChannels() {
  console.log('🧪 Testing SEMrush Summary endpoint for traffic channel data...');
  
  // Get the SEMrush API key from environment
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    console.error('❌ SEMRUSH_API_KEY not found in environment');
    return;
  }

  const domain = 'splunk.com';
  const displayDate = '2025-06-01'; // June 2025 data (within SEMrush range)
  
  const url = 'https://api.semrush.com/analytics/ta/api/v3/summary';
  const params = new URLSearchParams({
    key: apiKey,
    targets: domain,
    export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel',
    display_date: displayDate
  });

  try {
    console.log(`📡 Calling SEMrush API: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`);
    const text = await response.text();
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response text:', text);
    
    if (text.includes('ERROR')) {
      console.log('❌ SEMrush API returned error:', text);
      return;
    }

    // Parse CSV response
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      console.log('❌ No data returned from SEMrush');
      return;
    }

    const headers = lines[0].split(';');
    const data = lines[1].split(';');
    
    console.log('📊 Headers:', headers);
    console.log('📊 Data:', data);
    
    // Check for traffic channel data
    const trafficChannelColumns = ['direct', 'referral', 'social', 'search', 'search_organic', 'search_paid', 'social_organic', 'social_paid', 'mail', 'display_ad', 'unknown_channel'];
    
    console.log('\n🚀 TRAFFIC CHANNEL DATA:');
    trafficChannelColumns.forEach(column => {
      const index = headers.indexOf(column);
      if (index !== -1) {
        const value = data[index];
        console.log(`  ${column}: ${value}`);
      } else {
        console.log(`  ${column}: NOT FOUND`);
      }
    });

    // Calculate total visits for percentage calculation
    const totalVisits = parseFloat(data[headers.indexOf('visits')]) || 0;
    console.log(`\n📈 Total visits: ${totalVisits}`);
    
    if (totalVisits > 0) {
      console.log('\n🎯 TRAFFIC CHANNEL PERCENTAGES:');
      trafficChannelColumns.forEach(column => {
        const index = headers.indexOf(column);
        if (index !== -1) {
          const visits = parseFloat(data[index]) || 0;
          const percentage = ((visits / totalVisits) * 100).toFixed(1);
          if (visits > 0) {
            console.log(`  ${column}: ${visits} visits (${percentage}%)`);
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSEMrushTrafficChannels();