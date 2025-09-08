/**
 * Simple test to check API response for competitor screenshots
 * Assumes server is already running on port 3000
 */

async function testSimpleApi() {
  console.log('\n=== Testing API Response for Competitor Screenshots ===\n');
  
  try {
    const response = await fetch('http://localhost:5000/api/effectiveness/latest/demo-client-id', {
      headers: {
        'Cookie': 'sessionId=test-session'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✓ API Request Successful\n');
      
      // Check client data
      if (data.run) {
        console.log('Client Run:');
        console.log(`  ID: ${data.run.id}`);
        console.log(`  Status: ${data.run.status}`);
        console.log(`  Screenshot: ${data.run.screenshotUrl ? '✓ Present' : '✗ Missing'}`);
        console.log(`  Full Page: ${data.run.fullPageScreenshotUrl ? '✓ Present' : '✗ Missing'}`);
      }
      
      // Check competitor data
      if (data.competitorEffectivenessData && data.competitorEffectivenessData.length > 0) {
        console.log(`\n✓ Found ${data.competitorEffectivenessData.length} Competitors:\n`);
        
        data.competitorEffectivenessData.forEach((comp: any) => {
          console.log(`${comp.competitor.label}:`);
          console.log(`  Run ID: ${comp.run.id}`);
          console.log(`  Screenshot: ${comp.run.screenshotUrl ? '✓ ' + comp.run.screenshotUrl : '✗ Missing'}`);
          console.log(`  Full Page: ${comp.run.fullPageScreenshotUrl ? '✓ ' + comp.run.fullPageScreenshotUrl : '✗ Missing'}`);
          console.log(`  Properties: [${Object.keys(comp.run).join(', ')}]\n`);
        });
        
        // Show raw data for first competitor to debug
        console.log('--- First Competitor Raw Data ---');
        console.log(JSON.stringify(data.competitorEffectivenessData[0].run, null, 2).substring(0, 500) + '...');
      } else {
        console.log('\n✗ No competitor data found in response');
      }
      
    } else {
      console.log(`✗ API request failed: ${response.status} ${response.statusText}`);
    }
    
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.log('✗ Server is not running on port 5000');
      console.log('  Please start the server first with: npm run dev');
    } else {
      console.error('✗ Error:', error.message);
    }
  }
}

testSimpleApi();