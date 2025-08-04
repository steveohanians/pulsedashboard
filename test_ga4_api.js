// Test actual GA4 API connection
const fetch = require('node-fetch');

async function testGA4API() {
  const token = 'ya29.A0AS3H6Nx9S-ZNm_EDNqdBSbTKc8yKiUwlj_3ipk2bnobjUxrwM2Pgkc42Pb4JUZZonbreMScX3Elhr56yqgdyGpurfbQSgHArW_apw5u14ckYsJQWfWkkD1y--mh48MS4dugqkZBnsNcYI8oSKyFs6m9bVdIp3NzXBwoZx34-SBGeyND45-5_LeFRCosS353tc6zVt97jaCgYKAbsSARcSFQHGX2MimX27TDuL_0fU6-9wXYV1kg0207';
  
  const requestBody = {
    property: "properties/276066025",
    dateRanges: [{"startDate": "2025-07-01", "endDate": "2025-07-31"}],
    metrics: [
      {"name": "bounceRate"},
      {"name": "averageSessionDuration"},
      {"name": "screenPageViewsPerSession"},
      {"name": "sessionsPerUser"},
      {"name": "sessions"},
      {"name": "totalUsers"}
    ]
  };

  console.log('Making GA4 API request...');
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/276066025:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('Parsed response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error making GA4 API request:', error);
  }
}

testGA4API();