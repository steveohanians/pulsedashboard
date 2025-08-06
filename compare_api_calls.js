// Compare my direct API calls vs what the integration actually uses
async function compareApiCalls() {
  const apiKey = process.env.SEMRUSH_API_KEY;
  const domain = 'baunfire.com';
  
  console.log('=== TESTING DIFFERENT API APPROACHES ===\n');
  
  // 1. My direct test (what failed)
  console.log('1. My direct test approach:');
  const myUrl = 'https://api.semrush.com/analytics/ta/api/v3/summary/';
  const myParams = new URLSearchParams({
    key: apiKey,
    domain: domain,
    date: '202506',
    country: 'US',
    export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel'
  });
  
  console.log('URL:', `${myUrl}?${myParams}`);
  
  try {
    const response1 = await fetch(`${myUrl}?${myParams}`);
    const text1 = await response1.text();
    console.log('Status:', response1.status);
    console.log('Response:', text1.substring(0, 100));
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n2. Integration approach (what should work):');
  
  // 2. Integration approach - check the exact parameters it uses
  const integrationUrl = 'https://api.semrush.com/analytics/ta/api/v3/summary';
  const integrationParams = new URLSearchParams({
    key: apiKey,
    targets: domain, // Note: 'targets' vs 'domain'
    export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel',
    display_date: '2025-06-01' // Note: display_date vs date, and full date format
  });
  
  console.log('URL:', `${integrationUrl}?${integrationParams}`);
  
  try {
    const response2 = await fetch(`${integrationUrl}?${integrationParams}`);
    const text2 = await response2.text();
    console.log('Status:', response2.status);
    console.log('Response:', text2.substring(0, 200));
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n3. Testing another working domain format:');
  
  // 3. Test different domain format
  const testParams = new URLSearchParams({
    key: apiKey,
    targets: 'baunfire.com', // Try without https://
    export_columns: 'target,visits,users',
    display_date: '2025-06-01'
  });
  
  try {
    const response3 = await fetch(`${integrationUrl}?${testParams}`);
    const text3 = await response3.text();
    console.log('Status:', response3.status);
    console.log('Response:', text3.substring(0, 200));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

compareApiCalls();