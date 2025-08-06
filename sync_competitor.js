// Simple competitor sync using fetch
async function syncCompetitor() {
  try {
    console.log('Starting competitor sync...');
    
    // Login first
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      credentials: 'include'
    });
    
    const loginText = await loginResponse.text();
    console.log('Login status:', loginResponse.status);
    
    if (loginResponse.status !== 200) {
      console.log('Login failed:', loginText);
      return;
    }
    
    // Get session cookie from login response
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', setCookieHeader);
    
    if (!setCookieHeader) {
      console.log('No session cookie received');
      return;
    }
    
    // Extract session ID
    const sessionMatch = setCookieHeader.match(/connect\.sid=([^;]+)/);
    if (!sessionMatch) {
      console.log('Could not extract session ID');
      return;
    }
    
    const sessionId = sessionMatch[1];
    console.log('Session ID extracted:', sessionId);
    
    // Now call the competitor sync with the session cookie
    const syncResponse = await fetch('http://localhost:5000/api/admin/competitors/dc0250db-6375-4cb3-ab09-eaf98a125c16/resync-semrush', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `connect.sid=${sessionId}`
      }
    });
    
    const syncResult = await syncResponse.text();
    console.log('Sync status:', syncResponse.status);
    console.log('Sync result:', syncResult);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

syncCompetitor();