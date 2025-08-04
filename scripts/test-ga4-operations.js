#!/usr/bin/env node
/**
 * Test GA4 Operations - Comprehensive testing script
 * Tests all GA4 endpoints and validates the fixes implemented
 */

import { AdminAPI } from './admin-operations.js';
import { DataDiagnostics } from './data-diagnostics.js';

async function testGA4Operations() {
  console.log('🚀 Testing GA4 Operations and Fixes\n');

  const api = new AdminAPI();
  const diagnostics = new DataDiagnostics();

  try {
    // Test 1: Authentication
    console.log('1️⃣ Testing Authentication...');
    await api.login();
    
    // Test 2: Client Validation
    console.log('\n2️⃣ Testing Client Data...');
    const clients = await api.getClients();
    const demoClient = clients.find(c => c.id === 'demo-client-id');
    if (!demoClient) {
      throw new Error('Demo client not found');
    }
    console.log(`✓ Found demo client: ${demoClient.name}`);

    // Test 3: GA4 Property Access
    console.log('\n3️⃣ Testing GA4 Property Access...');
    const propertyAccess = await api.getGA4PropertyAccess('demo-client-id');
    console.log(`✓ Property Access: ${propertyAccess.propertyId} (${propertyAccess.propertyName})`);
    console.log(`✓ Verified: ${propertyAccess.accessVerified}`);

    // Test 4: Schema Validation
    console.log('\n4️⃣ Testing Database Schema...');
    await diagnostics.checkSchema();

    // Test 5: Data Freshness
    console.log('\n5️⃣ Testing Data Freshness...');
    await diagnostics.checkDataFreshness('demo-client-id');

    // Test 6: Current Metrics
    console.log('\n6️⃣ Testing Current Metrics...');
    const metrics = await diagnostics.checkMetricsData('demo-client-id');
    console.log(`✓ Found ${metrics.length} recent metrics records`);

    console.log('\n✅ All tests passed! GA4 operations are working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGA4Operations().then(() => process.exit(0));
}

export { testGA4Operations };