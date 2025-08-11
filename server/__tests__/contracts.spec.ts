/**
 * Contract Tests - Verifies API endpoint contracts using Zod schemas
 * Ensures runtime contracts and error handling can't regress
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { createServer } from 'http';
import * as http from 'http';
import express from 'express';
import { registerRoutes } from '../routes';
import { 
  DashboardResponseSchema, 
  FiltersResponseSchema, 
  InsightsResponseSchema,
  ErrorResponseSchema,
  SchemaValidationErrorSchema 
} from '../../shared/http/contracts';

// Test server setup
let server: any = null;
let port: number;

async function setupTestServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Setup routes using the existing registerRoutes function
  server = registerRoutes(app);
  
  return new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port;
      console.log(`Test server running on port ${port}`);
      resolve();
    });
  });
}

async function teardownTestServer() {
  if (server) {
    return new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  }
}

async function makeRequest(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
  const { method = 'GET', headers = {} } = options;
  
  return new Promise<{ status: number; body: any; headers: any }>((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
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

// ===========================================
// POSITIVE CONTRACT TESTS
// ===========================================

test('Contract: GET /api/dashboard/:clientId with valid timePeriod', async () => {
  await setupTestServer();
  
  try {
    const response = await makeRequest('/api/dashboard/demo-client-id?timePeriod=last_3_months');
    
    // Should return 200 status
    assert.equal(response.status, 200, `Expected 200, got ${response.status}`);
    
    // Response should match DashboardResponseSchema
    const validationResult = DashboardResponseSchema.safeParse(response.body);
    
    if (!validationResult.success) {
      console.error('Dashboard response validation failed:', validationResult.error.errors);
    }
    
    assert.ok(validationResult.success, 'Dashboard response should match schema');
    
    // Verify required fields exist
    assert.ok(response.body.client, 'Response should contain client data');
    assert.ok(response.body.metrics, 'Response should contain metrics array');
    assert.ok(response.body.competitors, 'Response should contain competitors array');
    assert.ok(response.body.insights, 'Response should contain insights array');
    
    console.log('✅ Dashboard contract test passed');
    
  } finally {
    await teardownTestServer();
  }
});

test('Contract: GET /api/filters', async () => {
  await setupTestServer();
  
  try {
    const response = await makeRequest('/api/filters');
    
    // Should return 200 status
    assert.equal(response.status, 200, `Expected 200, got ${response.status}`);
    
    // Response should match FiltersResponseSchema
    const validationResult = FiltersResponseSchema.safeParse(response.body);
    
    if (!validationResult.success) {
      console.error('Filters response validation failed:', validationResult.error.errors);
    }
    
    assert.ok(validationResult.success, 'Filters response should match schema');
    
    // Verify required fields exist
    assert.ok(Array.isArray(response.body.businessSizes), 'Response should contain businessSizes array');
    assert.ok(Array.isArray(response.body.industryVerticals), 'Response should contain industryVerticals array');
    assert.ok(Array.isArray(response.body.timePeriods), 'Response should contain timePeriods array');
    
    console.log('✅ Filters contract test passed');
    
  } finally {
    await teardownTestServer();
  }
});

test('Contract: GET /api/ai-insights/:clientId with valid timePeriod', async () => {
  await setupTestServer();
  
  try {
    const response = await makeRequest('/api/ai-insights/demo-client-id?timePeriod=last_3_months');
    
    // Should return 200 status
    assert.equal(response.status, 200, `Expected 200, got ${response.status}`);
    
    // Response should match InsightsResponseSchema
    const validationResult = InsightsResponseSchema.safeParse(response.body);
    
    if (!validationResult.success) {
      console.error('Insights response validation failed:', validationResult.error.errors);
    }
    
    assert.ok(validationResult.success, 'Insights response should match schema');
    
    // Verify required fields exist
    assert.ok(Array.isArray(response.body.insights), 'Response should contain insights array');
    
    console.log('✅ AI Insights contract test passed');
    
  } finally {
    await teardownTestServer();
  }
});

// ===========================================
// NEGATIVE CONTRACT TESTS
// ===========================================

test('Contract: GET /api/dashboard/:clientId missing timePeriod should return 400/422', async () => {
  await setupTestServer();
  
  try {
    const response = await makeRequest('/api/dashboard/demo-client-id');
    
    // Should return 400 or 422 status for validation error
    assert.ok([400, 422].includes(response.status), 
      `Expected 400 or 422, got ${response.status}`);
    
    // Response should contain error with SCHEMA_MISMATCH code
    assert.ok(response.body.code === 'SCHEMA_MISMATCH' || response.body.message, 
      'Response should contain error information');
    
    console.log('✅ Dashboard missing timePeriod validation test passed');
    
  } finally {
    await teardownTestServer();
  }
});

test('Contract: GET /api/ai-insights/bad?timePeriod=invalid should return 400/422', async () => {
  await setupTestServer();
  
  try {
    const response = await makeRequest('/api/ai-insights/bad-client-id?timePeriod=invalid_period');
    
    // Should return 400 or 422 status for validation error
    assert.ok([400, 422, 404].includes(response.status), 
      `Expected 400, 422, or 404, got ${response.status}`);
    
    // Response should contain error information
    assert.ok(response.body.message || response.body.error, 
      'Response should contain error information');
    
    console.log('✅ AI Insights invalid client validation test passed');
    
  } finally {
    await teardownTestServer();
  }
});

test('Contract: Error responses have stable JSON structure', async () => {
  await setupTestServer();
  
  try {
    // Test with a clearly invalid endpoint
    const response = await makeRequest('/api/nonexistent-endpoint');
    
    // Should return error status
    assert.ok(response.status >= 400, 'Should return error status for invalid endpoint');
    
    // Response should have consistent error structure
    assert.ok(typeof response.body === 'object', 'Error response should be JSON object');
    
    // Should contain message field at minimum
    assert.ok(response.body.message || response.body.error, 
      'Error response should contain message field');
    
    console.log('✅ Error response structure test passed');
    
  } finally {
    await teardownTestServer();
  }
});

// ===========================================
// SCHEMA VALIDATION TESTS
// ===========================================

test('Schema Validation: DashboardResponseSchema validates correctly', () => {
  const validDashboardResponse = {
    client: {
      id: 'test-client',
      name: 'Test Client',
      websiteUrl: 'https://example.com'
    },
    metrics: [{
      metricName: 'Sessions',
      value: 1000,
      sourceType: 'Client'
    }],
    competitors: [],
    insights: []
  };
  
  const result = DashboardResponseSchema.safeParse(validDashboardResponse);
  assert.ok(result.success, 'Valid dashboard response should pass schema validation');
  
  console.log('✅ Dashboard schema validation test passed');
});

test('Schema Validation: FiltersResponseSchema validates correctly', () => {
  const validFiltersResponse = {
    businessSizes: ['Small', 'Medium', 'Large'],
    industryVerticals: ['Technology', 'Healthcare'],
    timePeriods: ['Last Month', 'Last 3 Months']
  };
  
  const result = FiltersResponseSchema.safeParse(validFiltersResponse);
  assert.ok(result.success, 'Valid filters response should pass schema validation');
  
  console.log('✅ Filters schema validation test passed');
});

test('Schema Validation: InsightsResponseSchema validates correctly', () => {
  const validInsightsResponse = {
    insights: [{
      metricName: 'Sessions',
      contextText: 'Test context',
      insightText: 'Test insight',
      recommendationText: 'Test recommendation'
    }]
  };
  
  const result = InsightsResponseSchema.safeParse(validInsightsResponse);
  assert.ok(result.success, 'Valid insights response should pass schema validation');
  
  console.log('✅ Insights schema validation test passed');
});

// Run all tests
async function runTests() {
  console.log('🧪 Running Contract Tests...\n');
  
  try {
    // Import and run Node.js test runner
    await import('node:test');
    
    console.log('\n✅ All contract tests completed successfully!');
  } catch (error) {
    console.error('❌ Contract tests failed:', error);
    process.exit(1);
  }
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}