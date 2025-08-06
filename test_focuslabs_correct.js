// Test focuslabs.agency with the CORRECT SEMrush API parameters
async function testFocuslabsCorrect() {
  try {
    console.log('Testing focuslabs.agency with CORRECT SEMrush API format...');
    
    const apiKey = process.env.SEMRUSH_API_KEY;
    const domain = 'focuslabs.agency';
    
    // Use the CORRECT format that the integration uses
    const url = 'https://api.semrush.com/analytics/ta/api/v3/summary';
    const params = new URLSearchParams({
      key: apiKey,
      targets: domain, // CORRECT: 'targets' not 'domain'
      export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate',
      display_date: '2025-06-01' // CORRECT: 'display_date' with full date
    });
    
    console.log('Correct URL:', `${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`);
    const text = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response body:', text.substring(0, 300));
    
    if (response.ok && !text.includes('ERROR')) {
      console.log('✅ SUCCESS: focuslabs.agency has SEMrush data!');
    } else if (text.includes('ERROR')) {
      console.log('❌ SEMrush API error:', text);
    } else {
      console.log('❌ HTTP error:', response.status, text);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFocuslabsCorrect();