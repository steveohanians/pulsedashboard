/**
 * Exhaustive API Contract Verification Test
 * Tests all canonical routes, alias routes, Zod schemas, and deprecation headers
 * 
 * MATRIX TESTING:
 * - Canonical routes: /api/dashboard/:clientId, /api/filters, /api/ai-insights/:clientId  
 * - Alias routes: /api/insights/:clientId, /api/insights
 * - Time periods: Last Month, Last 3 Months, Last 6 Months
 * - Validates: Zod schemas, identical payloads, deprecation headers
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as http from 'http';
import express from 'express';
import { registerRoutes } from '../routes';
import { 
  DashboardResponseSchema, 
  FiltersResponseSchema, 
  InsightsResponseSchema 
} from '../../shared/http/contracts';

// Test configuration
const TEST_CLIENT_ID = 'demo-client-id';
const TIME_PERIODS = ['Last Month', 'Last 3 Months', 'Last 6 Months'];

// Test results tracking
interface TestResult {
  endpoint: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const testResults: TestResult[] = [];

// Test server setup
let server: any = null;
let port: number;
let sessionCookie: string = '';

async function setupTestServer() {
  // Set development mode for auto-authentication
  process.env.NODE_ENV = 'development';
  
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  server = await registerRoutes(app);
  
  return new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port;
      console.log(`🧪 Test server running on port ${port}`);
      resolve();
    });
  });
}

async function authenticate() {
  try {
    // Trigger auto-authentication by calling /api/user in development mode
    const authResponse = await makeRequest('/api/user');
    
    if (authResponse.headers['set-cookie']) {
      sessionCookie = authResponse.headers['set-cookie'][0];
      console.log('🔐 Authentication successful');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Authentication failed, proceeding without auth');
  }
  return false;
}

async function teardownTestServer() {
  if (server) {
    return new Promise<void>((resolve) => {
      server.close(() => {
        console.log('🔌 Test server closed');
        resolve();
      });
    });
  }
}

async function makeRequest(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
  const { method = 'GET', headers = {} } = options;
  
  // Include session cookie for authentication
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };
  
  if (sessionCookie) {
    requestHeaders['Cookie'] = sessionCookie;
  }
  
  return new Promise<{ status: number; body: any; headers: any }>((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method,
      headers: requestHeaders
    }, (res: any) => {
      let data = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            body,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

function addResult(endpoint: string, test: string, status: 'PASS' | 'FAIL', details?: string) {
  testResults.push({ endpoint, test, status, details });
}

function deepEqual(obj1: any, obj2: any): boolean {
  try {
    assert.deepStrictEqual(obj1, obj2);
    return true;
  } catch {
    return false;
  }
}

// ===========================================
// CANONICAL ROUTES TESTING
// ===========================================

async function testCanonicalRoutes() {
  console.log('\n📋 Testing Canonical Routes with Zod Schema Validation...');
  
  // Test /api/dashboard/:clientId
  for (const timePeriod of TIME_PERIODS) {
    try {
      const response = await makeRequest(`/api/dashboard/${TEST_CLIENT_ID}?timePeriod=${encodeURIComponent(timePeriod)}`);
      
      if (response.status === 200) {
        const validationResult = DashboardResponseSchema.safeParse(response.body);
        if (validationResult.success) {
          addResult('/api/dashboard/:clientId', `Zod Schema (${timePeriod})`, 'PASS');
        } else {
          addResult('/api/dashboard/:clientId', `Zod Schema (${timePeriod})`, 'FAIL', 
            `Schema validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
        }
      } else {
        addResult('/api/dashboard/:clientId', `HTTP Status (${timePeriod})`, 'FAIL', 
          `Expected 200, got ${response.status}`);
      }
    } catch (error) {
      addResult('/api/dashboard/:clientId', `Request (${timePeriod})`, 'FAIL', (error as Error).message);
    }
  }

  // Test /api/filters
  try {
    const response = await makeRequest('/api/filters');
    
    if (response.status === 200) {
      const validationResult = FiltersResponseSchema.safeParse(response.body);
      if (validationResult.success) {
        addResult('/api/filters', 'Zod Schema', 'PASS');
      } else {
        addResult('/api/filters', 'Zod Schema', 'FAIL', 
          `Schema validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
      }
    } else {
      addResult('/api/filters', 'HTTP Status', 'FAIL', `Expected 200, got ${response.status}`);
    }
  } catch (error) {
    addResult('/api/filters', 'Request', 'FAIL', (error as Error).message);
  }

  // Test /api/ai-insights/:clientId
  for (const timePeriod of TIME_PERIODS) {
    try {
      const response = await makeRequest(`/api/ai-insights/${TEST_CLIENT_ID}?timePeriod=${encodeURIComponent(timePeriod)}`);
      
      if (response.status === 200) {
        const validationResult = InsightsResponseSchema.safeParse(response.body);
        if (validationResult.success) {
          addResult('/api/ai-insights/:clientId', `Zod Schema (${timePeriod})`, 'PASS');
        } else {
          addResult('/api/ai-insights/:clientId', `Zod Schema (${timePeriod})`, 'FAIL', 
            `Schema validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
        }
      } else {
        addResult('/api/ai-insights/:clientId', `HTTP Status (${timePeriod})`, 'FAIL', 
          `Expected 200, got ${response.status}`);
      }
    } catch (error) {
      addResult('/api/ai-insights/:clientId', `Request (${timePeriod})`, 'FAIL', (error as Error).message);
    }
  }
}

// ===========================================
// ALIAS ROUTES TESTING
// ===========================================

async function testAliasRoutes() {
  console.log('\n🔄 Testing Alias Routes for Deprecation Headers and Identical Payloads...');
  
  // Test /api/insights/:clientId (alias of /api/ai-insights/:clientId)
  for (const timePeriod of TIME_PERIODS) {
    try {
      // Get canonical response
      const canonicalResponse = await makeRequest(`/api/ai-insights/${TEST_CLIENT_ID}?timePeriod=${encodeURIComponent(timePeriod)}`);
      
      // Get alias response
      const aliasResponse = await makeRequest(`/api/insights/${TEST_CLIENT_ID}?timePeriod=${encodeURIComponent(timePeriod)}`);
      
      // Check deprecation headers
      const hasDeprecation = aliasResponse.headers['deprecation'] === 'true';
      const hasSunset = aliasResponse.headers['sunset'] === '2026-01-01';
      const hasSuccessorLink = aliasResponse.headers['link']?.includes(`</api/ai-insights/${TEST_CLIENT_ID}>; rel="successor-version"`);
      
      if (hasDeprecation && hasSunset && hasSuccessorLink) {
        addResult('/api/insights/:clientId', `Deprecation Headers (${timePeriod})`, 'PASS');
      } else {
        addResult('/api/insights/:clientId', `Deprecation Headers (${timePeriod})`, 'FAIL', 
          `Missing headers: deprecation=${hasDeprecation}, sunset=${hasSunset}, link=${hasSuccessorLink}`);
      }
      
      // Check identical payloads
      if (canonicalResponse.status === 200 && aliasResponse.status === 200) {
        if (deepEqual(canonicalResponse.body, aliasResponse.body)) {
          addResult('/api/insights/:clientId', `Identical Payload (${timePeriod})`, 'PASS');
        } else {
          addResult('/api/insights/:clientId', `Identical Payload (${timePeriod})`, 'FAIL', 
            'Payloads differ between canonical and alias routes');
        }
      } else {
        addResult('/api/insights/:clientId', `Status Codes (${timePeriod})`, 'FAIL', 
          `Canonical: ${canonicalResponse.status}, Alias: ${aliasResponse.status}`);
      }
      
    } catch (error) {
      addResult('/api/insights/:clientId', `Request (${timePeriod})`, 'FAIL', (error as Error).message);
    }
  }

  // Test /api/insights (legacy route)
  try {
    const response = await makeRequest('/api/insights');
    
    // Check deprecation headers
    const hasDeprecation = response.headers['deprecation'] === 'true';
    const hasSunset = response.headers['sunset'] === '2026-01-01';
    const hasSuccessorLink = response.headers['link']?.includes('</api/ai-insights/'); // Dynamic clientId
    
    if (hasDeprecation && hasSunset && hasSuccessorLink) {
      addResult('/api/insights', 'Deprecation Headers', 'PASS');
    } else {
      addResult('/api/insights', 'Deprecation Headers', 'FAIL', 
        `Missing headers: deprecation=${hasDeprecation}, sunset=${hasSunset}, link=${hasSuccessorLink}`);
    }
    
    // Check response structure (should be insights array or error for missing auth)
    if (response.status === 200 || response.status === 403) {
      addResult('/api/insights', 'Response Structure', 'PASS');
    } else {
      addResult('/api/insights', 'Response Structure', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    addResult('/api/insights', 'Request', 'FAIL', (error as Error).message);
  }
}

// ===========================================
// EDGE CASE TESTING
// ===========================================

async function testEdgeCases() {
  console.log('\n⚠️  Testing Edge Cases and Error Scenarios...');
  
  // Test invalid time period
  try {
    const response = await makeRequest(`/api/dashboard/${TEST_CLIENT_ID}?timePeriod=invalid_period`);
    
    if ([400, 422].includes(response.status)) {
      addResult('Edge Cases', 'Invalid Time Period', 'PASS');
    } else {
      addResult('Edge Cases', 'Invalid Time Period', 'FAIL', 
        `Expected 400/422, got ${response.status}`);
    }
  } catch (error) {
    addResult('Edge Cases', 'Invalid Time Period', 'FAIL', (error as Error).message);
  }
  
  // Test missing client ID
  try {
    const response = await makeRequest('/api/dashboard/');
    
    if ([400, 404].includes(response.status)) {
      addResult('Edge Cases', 'Missing Client ID', 'PASS');
    } else {
      addResult('Edge Cases', 'Missing Client ID', 'FAIL', 
        `Expected 400/404, got ${response.status}`);
    }
  } catch (error) {
    addResult('Edge Cases', 'Missing Client ID', 'FAIL', (error as Error).message);
  }
}

// ===========================================
// RESULTS REPORTING
// ===========================================

function printResultsTable() {
  console.log('\n📊 API CONTRACT VERIFICATION RESULTS');
  console.log('=' .repeat(80));
  
  // Group results by endpoint
  const groupedResults = new Map<string, TestResult[]>();
  testResults.forEach(result => {
    if (!groupedResults.has(result.endpoint)) {
      groupedResults.set(result.endpoint, []);
    }
    groupedResults.get(result.endpoint)!.push(result);
  });
  
  // Print grouped results
  groupedResults.forEach((results, endpoint) => {
    console.log(`\n🔹 ${endpoint}`);
    console.log('-'.repeat(60));
    
    results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${status} ${result.test.padEnd(30)} ${result.status}`);
      if (result.details && result.status === 'FAIL') {
        console.log(`     Details: ${result.details}`);
      }
    });
  });
  
  // Summary statistics
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'PASS').length;
  const failedTests = totalTests - passedTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\n📈 SUMMARY');
  console.log('=' .repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${successRate}%`);
  
  if (failedTests > 0) {
    console.log('\n⚠️  FAILURES DETECTED - Review failed tests above for details');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED - API contracts are verified');
  }
}

// ===========================================
// MAIN TEST RUNNER
// ===========================================

test('Exhaustive API Contract Verification', async () => {
  console.log('🚀 Starting Exhaustive API Contract Verification...');
  
  await setupTestServer();
  
  try {
    // Authenticate first
    await authenticate();
    
    await testCanonicalRoutes();
    await testAliasRoutes();
    await testEdgeCases();
    
    printResultsTable();
    
  } finally {
    await teardownTestServer();
  }
});

// CLI runner
async function runTests() {
  console.log('🧪 Running Exhaustive API Contract Tests...\n');
  
  try {
    await import('node:test');
    console.log('\n✅ All contract verification tests completed!');
  } catch (error) {
    console.error('❌ Contract verification tests failed:', error);
    process.exit(1);
  }
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}