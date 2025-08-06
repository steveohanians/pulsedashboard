// Debug SEMrush API directly to see what's failing
async function debugSemrush() {
  try {
    console.log('Testing SEMrush API directly...');
    
    const domain = 'focuslabs.agency';
    const apiKey = process.env.SEMRUSH_API_KEY;
    
    if (!apiKey) {
      console.log('❌ SEMRUSH_API_KEY not found');
      return;
    }
    
    console.log('✅ API key found, testing API call...');
    
    // Test the exact same URL that the integration uses
    const url = 'https://api.semrush.com/analytics/ta/api/v3/summary/';
    const params = new URLSearchParams({
      key: apiKey,
      domain: domain,
      date: '202506', // June 2025
      country: 'US',
      export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel'
    });
    
    console.log('API URL:', `${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`);
    const text = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.get('content-type'));
    console.log('Response body:', text);
    
    if (text.includes('ERROR')) {
      console.log('❌ SEMrush API returned error:', text);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugSemrush();