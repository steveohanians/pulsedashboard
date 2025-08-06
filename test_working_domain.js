// Test with a domain that should work in SEMrush
async function testWorkingDomain() {
  try {
    console.log('Testing SEMrush with a working domain (baunfire.com)...');
    
    const domain = 'baunfire.com';
    const apiKey = process.env.SEMRUSH_API_KEY;
    
    const url = 'https://api.semrush.com/analytics/ta/api/v3/summary/';
    const params = new URLSearchParams({
      key: apiKey,
      targets: domain,
      export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate',
      display_date: '2025-06-01'
    });
    
    const response = await fetch(`${url}?${params}`);
    const text = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response body (first 200 chars):', text.substring(0, 200));
    
    if (response.ok && !text.includes('ERROR')) {
      console.log('✅ SEMrush API working for baunfire.com');
    } else {
      console.log('❌ Issue with baunfire.com:', text);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWorkingDomain();