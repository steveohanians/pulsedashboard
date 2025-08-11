#!/usr/bin/env node

/**
 * Test script to verify /api/ai-insights/:clientId canonical route
 * and /api/insights/:clientId legacy alias return identical payloads
 * with proper deprecation headers.
 */

import { createServer } from '../server/index.js';
import supertest from 'supertest';
import { InsightsResponseSchema } from '../shared/http/contracts.js';

async function runTests() {
  console.log('🧪 Starting AI Insights Route Tests...\n');
  
  // Create test server
  const app = await createServer();
  const request = supertest(app);
  
  const testClientId = 'demo-client-id';
  const testTimePeriod = 'Last Month';
  
  // Test data storage
  let canonicalResponse, canonicalHeaders;
  let legacyResponse, legacyHeaders;
  let legacyNoParamResponse, legacyNoParamHeaders;
  
  console.log('📋 Test Plan:');
  console.log('1. Test canonical /api/ai-insights/:clientId route');
  console.log('2. Test legacy /api/insights/:clientId alias with deprecation headers');
  console.log('3. Test legacy /api/insights alias with deprecation headers');
  console.log('4. Validate response payloads are identical');
  console.log('5. Validate schema compliance\n');
  
  try {
    // Test 1: Canonical route
    console.log('🚀 Testing canonical route: /api/ai-insights/:clientId');
    const canonicalResult = await request
      .get(`/api/ai-insights/${testClientId}?timePeriod=${encodeURIComponent(testTimePeriod)}`)
      .expect(200);
    
    canonicalResponse = canonicalResult.body;
    canonicalHeaders = canonicalResult.headers;
    
    console.log('✅ Canonical route successful');
    console.log(`   Status: ${canonicalResult.status}`);
    console.log(`   Insights count: ${canonicalResponse.insights?.length || 0}`);
    console.log(`   Has deprecation header: ${!!canonicalHeaders.deprecation}`);
    
    // Test 2: Legacy alias with clientId
    console.log('\n🔄 Testing legacy alias: /api/insights/:clientId');
    const legacyResult = await request
      .get(`/api/insights/${testClientId}?timePeriod=${encodeURIComponent(testTimePeriod)}`)
      .expect(200);
    
    legacyResponse = legacyResult.body;
    legacyHeaders = legacyResult.headers;
    
    console.log('✅ Legacy alias successful');
    console.log(`   Status: ${legacyResult.status}`);
    console.log(`   Insights count: ${legacyResponse.insights?.length || 0}`);
    console.log(`   Has deprecation header: ${!!legacyHeaders.deprecation}`);
    console.log(`   Deprecation value: ${legacyHeaders.deprecation}`);
    console.log(`   Sunset header: ${legacyHeaders.sunset}`);
    console.log(`   Link header: ${legacyHeaders.link}`);
    
    // Test 3: Legacy alias without clientId (requires authentication)
    console.log('\n🔄 Testing legacy alias (no auth): /api/insights');
    const legacyNoParamResult = await request
      .get(`/api/insights?period=${encodeURIComponent(testTimePeriod)}`)
      .expect(403); // Should fail without authentication
    
    console.log('✅ Legacy no-param route properly requires authentication');
    console.log(`   Status: ${legacyNoParamResult.status} (expected 403)`);
    
    // Test 4: Validate payloads are identical
    console.log('\n🔍 Validating payload consistency...');
    
    const canonicalJson = JSON.stringify(canonicalResponse, null, 2);
    const legacyJson = JSON.stringify(legacyResponse, null, 2);
    
    if (canonicalJson === legacyJson) {
      console.log('✅ Payloads are identical between canonical and legacy routes');
    } else {
      console.log('❌ Payloads differ between canonical and legacy routes');
      console.log('Canonical response keys:', Object.keys(canonicalResponse));
      console.log('Legacy response keys:', Object.keys(legacyResponse));
      throw new Error('Payload mismatch detected');
    }
    
    // Test 5: Schema validation
    console.log('\n📋 Validating schema compliance...');
    
    try {
      const canonicalValidation = InsightsResponseSchema.safeParse(canonicalResponse);
      const legacyValidation = InsightsResponseSchema.safeParse(legacyResponse);
      
      if (canonicalValidation.success && legacyValidation.success) {
        console.log('✅ Both responses comply with InsightsResponseSchema');
      } else {
        console.log('❌ Schema validation failed');
        if (!canonicalValidation.success) {
          console.log('Canonical validation errors:', canonicalValidation.error.errors);
        }
        if (!legacyValidation.success) {
          console.log('Legacy validation errors:', legacyValidation.error.errors);
        }
        throw new Error('Schema validation failed');
      }
    } catch (error) {
      console.log('❌ Schema validation error:', error.message);
      throw error;
    }
    
    // Test 6: Deprecation headers validation
    console.log('\n📋 Validating deprecation headers...');
    
    if (!canonicalHeaders.deprecation) {
      console.log('✅ Canonical route has no deprecation headers (correct)');
    } else {
      console.log('❌ Canonical route should not have deprecation headers');
      throw new Error('Canonical route has unexpected deprecation headers');
    }
    
    if (legacyHeaders.deprecation === 'true' && 
        legacyHeaders.sunset === '2026-01-01' && 
        legacyHeaders.link?.includes('/api/ai-insights/')) {
      console.log('✅ Legacy route has proper deprecation headers');
    } else {
      console.log('❌ Legacy route missing or incorrect deprecation headers');
      console.log('Expected deprecation: true, got:', legacyHeaders.deprecation);
      console.log('Expected sunset: 2026-01-01, got:', legacyHeaders.sunset);
      console.log('Expected link to contain /api/ai-insights/, got:', legacyHeaders.link);
      throw new Error('Legacy route deprecation headers are incorrect');
    }
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Canonical route /api/ai-insights/:clientId works correctly');
    console.log('✅ Legacy alias /api/insights/:clientId forwards correctly with deprecation headers');
    console.log('✅ Response payloads are identical');
    console.log('✅ Schema validation passes for both routes');
    console.log('✅ Deprecation headers are properly set');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests();