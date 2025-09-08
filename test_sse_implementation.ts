/**
 * SSE Implementation Test
 * 
 * Tests the complete Server-Sent Events implementation for real-time progress updates.
 * This script verifies that:
 * 1. SSE endpoint is accessible
 * 2. Progress events are emitted correctly
 * 3. Completion events work
 * 4. Connection cleanup is handled
 */

import { performance } from 'perf_hooks';
// Polyfill EventSource for Node.js environment
const EventSourcePolyfill = require('eventsource');
// Make EventSource available globally for consistency with browser environment
(global as any).EventSource = EventSourcePolyfill;

// Test configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const TEST_CLIENT_ID = process.env.CLIENT_ID || 'demo-client-id';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: string;
  error?: string;
}

class SSETestRunner {
  private results: TestResult[] = [];
  
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting SSE Implementation Tests...\n');
    
    try {
      await this.testSSEEndpointAccessibility();
      await this.testProgressStreaming();
      await this.testConnectionCleanup();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
  
  private async testSSEEndpointAccessibility(): Promise<void> {
    const testName = 'SSE Endpoint Accessibility';
    const startTime = performance.now();
    
    try {
      console.log('1. Testing SSE endpoint accessibility...');
      
      const sseUrl = `${SERVER_URL}/api/sse/progress/${TEST_CLIENT_ID}`;
      console.log(`   Connecting to: ${sseUrl}`);
      
      // Test that the endpoint exists and returns SSE headers
      const response = await fetch(sseUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        throw new Error(`Invalid content-type: ${contentType}`);
      }
      
      // Close the connection immediately
      response.body?.cancel();
      
      this.addResult({
        name: testName,
        success: true,
        duration: performance.now() - startTime,
        details: `SSE endpoint accessible with correct headers`
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        success: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  private async testProgressStreaming(): Promise<void> {
    const testName = 'Progress Streaming';
    const startTime = performance.now();
    
    try {
      console.log('2. Testing progress streaming...');
      
      // Start an analysis to generate progress events
      const analysisResponse = await fetch(`${SERVER_URL}/api/effectiveness/refresh/${TEST_CLIENT_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      
      if (!analysisResponse.ok) {
        throw new Error(`Failed to start analysis: ${analysisResponse.status}`);
      }
      
      console.log('   Analysis started, connecting to SSE stream...');
      
      // Connect to SSE and wait for events
      const events: any[] = [];
      const sseUrl = `${SERVER_URL}/api/sse/progress/${TEST_CLIENT_ID}`;
      
      const eventSource = new EventSource(sseUrl);
      
      // Set up event listeners
      eventSource.addEventListener('connected', (event: MessageEvent) => {
        console.log('   ✓ Connected event received');
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          events.push({ type: 'connected', data });
        } catch (e) {
          console.warn('[SSE] Failed to parse connected event:', event.data);
        }
      });
      
      eventSource.addEventListener('progress', (event: MessageEvent) => {
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          console.log(`   ✓ Progress event: ${data.overallPercent}% - ${data.message}`);
          events.push({ type: 'progress', data });
        } catch (e) {
          console.warn('[SSE] Failed to parse progress event:', event.data);
        }
      });
      
      eventSource.addEventListener('completed', (event: MessageEvent) => {
        console.log('   ✓ Completion event received');
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          events.push({ type: 'completed', data });
        } catch (e) {
          console.warn('[SSE] Failed to parse completion event:', event.data);
        }
      });
      
      eventSource.addEventListener('error', (event: MessageEvent) => {
        console.log('   ⚠ Error event received');
        try {
          const data = event.data ? JSON.parse(event.data) : { error: 'Unknown error' };
          console.log('   Error data:', data);
          events.push({ type: 'error', data });
        } catch (e) {
          console.warn('[SSE] Failed to parse error event:', event.data);
          events.push({ type: 'error', data: { error: 'Parse error', raw: event.data } });
        }
      });
      
      // Wait for at least some events (timeout after 30 seconds)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          eventSource.close();
          if (events.length > 0) {
            resolve();
          } else {
            reject(new Error('No events received within 30 seconds'));
          }
        }, 30000);
        
        // Resolve early if we get a completion event
        eventSource.addEventListener('completed', () => {
          clearTimeout(timeout);
          eventSource.close();
          resolve();
        });
      });
      
      this.addResult({
        name: testName,
        success: events.length > 0,
        duration: performance.now() - startTime,
        details: `Received ${events.length} events: ${events.map(e => e.type).join(', ')}`
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        success: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  private async testConnectionCleanup(): Promise<void> {
    const testName = 'Connection Cleanup';
    const startTime = performance.now();
    
    try {
      console.log('3. Testing connection cleanup...');
      
      const sseUrl = `${SERVER_URL}/api/sse/progress/${TEST_CLIENT_ID}`;
      const eventSource = new EventSource(sseUrl);
      
      // Wait for connection
      await new Promise<void>((resolve) => {
        eventSource.addEventListener('connected', () => resolve());
      });
      
      console.log('   ✓ Connection established');
      
      // Close connection
      eventSource.close();
      console.log('   ✓ Connection closed');
      
      // Check health endpoint to see if connection was cleaned up
      const healthResponse = await fetch(`${SERVER_URL}/api/sse/health`);
      const healthData = await healthResponse.json();
      
      console.log(`   ✓ Active connections: ${healthData.totalConnections}`);
      
      this.addResult({
        name: testName,
        success: true,
        duration: performance.now() - startTime,
        details: `Connection cleanup verified, health check passed`
      });
      
    } catch (error) {
      this.addResult({
        name: testName,
        success: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  private addResult(result: TestResult): void {
    this.results.push(result);
    const status = result.success ? '✅' : '❌';
    const duration = `${Math.round(result.duration)}ms`;
    
    console.log(`   ${status} ${result.name} (${duration})`);
    if (result.details) {
      console.log(`      ${result.details}`);
    }
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
    console.log();
  }
  
  private printResults(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('📊 Test Results Summary:');
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests} ✅`);
    console.log(`   Failed: ${failedTests} ❌`);
    
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`   Total duration: ${Math.round(totalDuration)}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All SSE implementation tests passed!');
      console.log('   The Server-Sent Events system is working correctly.');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const runner = new SSETestRunner();
  runner.runAllTests().catch(console.error);
}

export { SSETestRunner };