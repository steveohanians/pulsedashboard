// Direct trigger of SEMrush integration for focuslabs.agency
async function triggerSemrushIntegration() {
  try {
    console.log('Triggering SEMrush integration for focuslabs.agency...');
    
    // Make direct API call to trigger sync
    const response = await fetch('http://localhost:5000/api/admin/competitors/81885850-6dab-495d-a724-8858fde4e716/resync-semrush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'internal-script'
      }
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
    
    if (response.status === 200) {
      console.log('✅ SEMrush integration triggered successfully');
    } else {
      console.log('❌ Failed to trigger integration:', result);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

triggerSemrushIntegration();