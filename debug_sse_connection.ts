/**
 * Debug SSE Connection Script
 * 
 * Quick diagnostic tool to test SSE connectivity and see real-time events
 */

// Polyfill EventSource for Node.js environment
const EventSourcePolyfill = require('eventsource');
(global as any).EventSource = EventSourcePolyfill;

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const TEST_CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';

async function debugSSEConnection() {
  console.log('🔍 SSE Connection Debug Tool\n');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Client ID: ${TEST_CLIENT_ID}\n`);

  // Test 1: Check if SSE endpoint is accessible
  console.log('1. Testing SSE endpoint accessibility...');
  try {
    const response = await fetch(`${SERVER_URL}/api/sse/health`);
    const healthData = await response.json();
    console.log('✅ Health endpoint response:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.log('❌ Health endpoint failed:', error);
    return;
  }

  // Test 2: Connect to SSE stream and listen for events
  console.log('\n2. Connecting to SSE stream...');
  const sseUrl = `${SERVER_URL}/api/sse/progress/${TEST_CLIENT_ID}`;
  console.log(`Connecting to: ${sseUrl}`);

  const eventSource = new EventSource(sseUrl);
  let eventCount = 0;

  // Connection opened
  eventSource.onopen = () => {
    console.log('✅ SSE connection opened');
  };

  // Connection error
  eventSource.onerror = (event: any) => {
    console.log('❌ SSE connection error:', event);
  };

  // Listen for all event types
  const eventTypes = ['connected', 'progress', 'completed', 'error', 'heartbeat', 'timeout'];
  
  eventTypes.forEach(eventType => {
    eventSource.addEventListener(eventType, (event: any) => {
      eventCount++;
      console.log(`📨 [${eventType.toUpperCase()}] Event received:`, {
        data: event.data,
        timestamp: new Date().toISOString()
      });
      
      try {
        if (event.data) {
          const parsed = JSON.parse(event.data);
          console.log(`   Parsed data:`, parsed);
        }
      } catch (e) {
        console.log(`   Raw data (not JSON):`, event.data);
      }
    });
  });

  // Test 3: Wait for events and then trigger an analysis
  console.log('3. Listening for events (10 seconds)...');
  
  setTimeout(async () => {
    console.log('\n4. Triggering analysis...');
    
    try {
      const analysisResponse = await fetch(`${SERVER_URL}/api/effectiveness/refresh/${TEST_CLIENT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      
      if (analysisResponse.ok) {
        const result = await analysisResponse.json();
        console.log('✅ Analysis started:', result);
      } else {
        const error = await analysisResponse.text();
        console.log('❌ Analysis failed:', analysisResponse.status, error);
      }
      
    } catch (error) {
      console.log('❌ Analysis request failed:', error);
    }
    
    // Listen for more events after triggering analysis
    console.log('5. Listening for analysis events (30 seconds)...');
    
    setTimeout(() => {
      console.log(`\n📊 Debug Summary:`);
      console.log(`   Total events received: ${eventCount}`);
      console.log(`   Connection status: ${eventSource.readyState === 1 ? 'Connected' : 'Disconnected'}`);
      
      eventSource.close();
      console.log('🔚 Debug session completed');
      process.exit(0);
    }, 30000);
    
  }, 10000);
}

// Run the debug tool
if (require.main === module) {
  debugSSEConnection().catch(console.error);
}

export { debugSSEConnection };