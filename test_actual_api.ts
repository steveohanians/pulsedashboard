import fetch from 'node-fetch';

async function testActualAPI() {
  try {
    console.log('Testing actual API endpoint...');
    
    // Make the same call the frontend makes
    const response = await fetch('http://localhost:5000/api/effectiveness/latest/demo-client-id', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('❌ API call failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response received');
    console.log('Has Data:', data.hasData);
    console.log('Run Status:', data.run?.status);
    console.log('Screenshot URL:', data.run?.screenshotUrl || '❌ MISSING');
    console.log('Full Page URL:', data.run?.fullPageScreenshotUrl || '❌ MISSING');
    console.log('Criterion Scores Count:', data.run?.criterionScores?.length || 0);
    console.log('Web Vitals in Run:', data.run?.webVitals || '❌ MISSING');
    
    // Check for web vitals in speed criterion
    if (data.run?.criterionScores) {
      const speedCriterion = data.run.criterionScores.find((c: any) => c.criterion === 'speed');
      if (speedCriterion) {
        console.log('Speed Criterion Evidence:');
        try {
          const evidence = typeof speedCriterion.evidence === 'string' 
            ? JSON.parse(speedCriterion.evidence) 
            : speedCriterion.evidence;
          console.log('  Web Vitals:', evidence.details?.webVitals);
        } catch (e) {
          console.log('  Raw Evidence:', speedCriterion.evidence);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

testActualAPI();