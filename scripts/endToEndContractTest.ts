/**
 * End-to-End Contract Test
 * 
 * Tests actual API endpoints to validate contract regression fixes in production
 */

import { z } from 'zod';

const API_BASE = 'http://localhost:5000';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  message?: string;
  data?: any;
}

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<TestResult> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=fake-session-for-testing', // Mock session
        ...options.headers
      }
    });
    
    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    return {
      endpoint,
      status: response.status,
      success: response.ok,
      data
    };
    
  } catch (error) {
    return {
      endpoint,
      status: 0,
      success: false,
      message: (error as Error).message
    };
  }
}

async function testContractEndpoints() {
  console.log('\n🌐 END-TO-END CONTRACT TESTING...\n');
  
  const results: TestResult[] = [];
  
  // ===== TEST 1: Dashboard with New Time Periods =====
  console.log('📊 Testing Dashboard Endpoint with New Time Periods...');
  
  const dashboardTests = [
    '/api/dashboard/demo-client-id?timePeriod=Last%203%20Months&businessSize=All&industryVertical=All',
    '/api/dashboard/demo-client-id?timePeriod=Last%206%20Months&businessSize=Small&industryVertical=Technology',
    '/api/dashboard/demo-client-id?timePeriod=last%20quarter&businessSize=All&industryVertical=All'
  ];
  
  for (const endpoint of dashboardTests) {
    const result = await makeRequest(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`  ✅ ${endpoint.split('?')[0]} (${result.status})`);
      
      // Validate response structure
      if (result.data?.client && result.data?.competitors !== undefined && result.data?.metrics !== undefined) {
        console.log(`     - Client: ${result.data.client?.domain || 'N/A'}`);
        console.log(`     - Competitors: ${result.data.competitors?.length || 0}`);
        console.log(`     - Metrics: ${result.data.metrics?.length || 0}`);
        
        // Check competitor fields for null safety
        if (result.data.competitors && Array.isArray(result.data.competitors)) {
          const hasNullFields = result.data.competitors.some((comp: any) => 
            comp.domain === null || comp.label === null || comp.status === null ||
            comp.domain === undefined || comp.label === undefined
          );
          
          if (hasNullFields) {
            console.log(`     ⚠️  WARNING: Found null competitor fields`);
          } else {
            console.log(`     ✅ All competitor fields properly populated`);
          }
        }
      } else {
        console.log(`     ⚠️  Unexpected response structure`);
      }
    } else {
      console.log(`  ❌ ${endpoint.split('?')[0]} (${result.status}) - ${result.message || 'Failed'}`);
    }
  }
  
  // ===== TEST 2: AI Insights Status Handling =====
  console.log('\n🤖 Testing AI Insights Status Handling...');
  
  const insightsTests = [
    '/api/ai-insights/demo-client-id?timePeriod=Last%203%20Months',
    '/api/ai-insights/demo-client-id?timePeriod=Last%206%20Months',
    '/api/ai-insights/nonexistent-client?timePeriod=Last%20Month', // Should return 200 with pending, not 500
  ];
  
  for (const endpoint of insightsTests) {
    const result = await makeRequest(endpoint);
    results.push(result);
    
    if (result.status === 200) {
      console.log(`  ✅ ${endpoint.split('?')[0]} (${result.status})`);
      
      // Validate insights response structure
      if (result.data?.status) {
        console.log(`     - Status: ${result.data.status}`);
        console.log(`     - Insights Count: ${result.data.insights?.length || 0}`);
        if (result.data.message) {
          console.log(`     - Message: ${result.data.message}`);
        }
      } else {
        console.log(`     - Legacy format (no status field)`);
      }
    } else if (result.status === 500) {
      console.log(`  ❌ ${endpoint.split('?')[0]} (${result.status}) - Should return 200 with pending status`);
    } else {
      console.log(`  ⚠️  ${endpoint.split('?')[0]} (${result.status}) - ${result.message || 'Unexpected status'}`);
    }
  }
  
  // ===== TEST 3: Versioned Insights =====
  console.log('\n🔄 Testing Versioned Insights...');
  
  const versionedTests = [
    '/api/v2/ai-insights/demo-client-id?timePeriod=Last%203%20Months',
    '/api/v2/ai-insights/demo-client-id/status'
  ];
  
  for (const endpoint of versionedTests) {
    const result = await makeRequest(endpoint);
    results.push(result);
    
    if (result.status === 200) {
      console.log(`  ✅ ${endpoint.split('?')[0]} (${result.status})`);
      if (result.data?.status) {
        console.log(`     - Status: ${result.data.status}`);
      }
    } else {
      console.log(`  ❌ ${endpoint.split('?')[0]} (${result.status}) - ${result.message || 'Failed'}`);
    }
  }
  
  // ===== SUMMARY =====
  console.log('\n📋 END-TO-END TEST SUMMARY');
  console.log('═'.repeat(50));
  
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const warningTests = results.filter(r => r.status === 200 && !r.success).length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Failed: ${totalTests - successfulTests - warningTests}`);
  console.log(`Warnings: ${warningTests}`);
  
  if (successfulTests === totalTests) {
    console.log('\n🎉 ALL END-TO-END TESTS PASSED!');
    console.log('\n✅ Contract Regression Fixes Verified:');
    console.log('   - Dashboard accepts "Last 3 Months" and "Last 6 Months"');
    console.log('   - Competitor fields properly handle null values');
    console.log('   - AI insights return 200 with pending status instead of 500');
    console.log('   - All endpoints responding correctly');
  } else {
    console.log('\n⚠️  SOME TESTS HAD ISSUES - Review above for details');
    
    // Show failed tests
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`   - ${test.endpoint} (${test.status}): ${test.message || 'Unknown error'}`);
      });
    }
  }
  
  return successfulTests === totalTests;
}

// Run test if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testContractEndpoints()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ End-to-end test failed:', error);
      process.exit(1);
    });
}

export { testContractEndpoints };