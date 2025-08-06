// Test the complete SEMrush integration flow to find the real failure point
async function triggerSemrushTest() {
  try {
    console.log('Testing complete SEMrush integration for focuslabs.agency...');
    
    // Simulate competitor creation via API call
    const response = await fetch('http://localhost:5000/api/admin/competitors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test' // Simulate authentication
      },
      body: JSON.stringify({
        label: 'focuslabs.agency',
        domain: 'https://focuslabs.agency',
        businessSize: 'Small Business',
        industryVertical: 'Technology'
      })
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.ok) {
      console.log('✅ Competitor creation succeeded!');
    } else {
      console.log('❌ Competitor creation failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

triggerSemrushTest();