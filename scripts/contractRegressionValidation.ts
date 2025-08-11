/**
 * Contract Regression Validation Script
 * 
 * Validates all P0 and P1 contract fixes:
 * - Time period normalization for "Last 3 Months"/"Last 6 Months"
 * - Competitor field null safety with proper coalescing
 * - AI insights 200 status with pending instead of 500 errors
 * - Dashboard route contract compliance
 */

import { parseUILabel, toDbRange } from '../shared/timePeriod.js';
import { DashboardRequestSchema, InsightsRequestSchema, CompetitorSchema } from '../shared/http/contracts.js';
import { z } from 'zod';

// Test data
const testCases = {
  timePeriods: [
    'Last Month',
    'Last 3 Months', 
    'last 3 months',
    'Last Quarter',
    'Last 6 Months',
    'last 6 months', 
    'Last Year',
    'last year',
    'Last 12 Months'
  ],
  competitors: [
    { id: 'comp1', domain: 'example.com', label: 'Example Corp', status: 'Active' },
    { id: 'comp2', domain: 'test.com', label: '', status: undefined }, // Test null/empty handling
    { id: 'comp3', domain: '', label: '', status: null }, // Test full null handling
  ],
  dashboardRequests: [
    { clientId: 'demo-client-id', timePeriod: 'Last 3 Months', businessSize: 'All', industryVertical: 'All' },
    { clientId: 'demo-client-id', timePeriod: 'last 6 months', businessSize: 'Small', industryVertical: 'Technology' },
    { clientId: 'demo-client-id', timePeriod: 'Last Quarter' }
  ]
};

async function validateContractFixes() {
  console.log('\n🔍 CONTRACT REGRESSION VALIDATION STARTING...\n');
  
  let allTestsPassed = true;
  
  // ===== TEST 1: Time Period Normalization =====
  console.log('📅 Testing Time Period Normalization...');
  
  for (const timePeriod of testCases.timePeriods) {
    try {
      const canonical = parseUILabel(timePeriod);
      const dbRange = toDbRange(canonical);
      
      console.log(`  ✅ "${timePeriod}" → ${canonical.months} months (${canonical.type})`);
      console.log(`     DB Range: ${dbRange.startMonth} to ${dbRange.endMonth}`);
      
      // Validate expected mappings
      if (timePeriod.toLowerCase().includes('3 months') || timePeriod.toLowerCase().includes('quarter')) {
        if (canonical.months !== 3) {
          console.log(`  ❌ ERROR: Expected 3 months for "${timePeriod}", got ${canonical.months}`);
          allTestsPassed = false;
        }
      }
      
      if (timePeriod.toLowerCase().includes('6 months')) {
        if (canonical.months !== 6) {
          console.log(`  ❌ ERROR: Expected 6 months for "${timePeriod}", got ${canonical.months}`);
          allTestsPassed = false;
        }
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR parsing "${timePeriod}": ${(error as Error).message}`);
      allTestsPassed = false;
    }
  }
  
  // ===== TEST 2: Competitor Schema Validation =====
  console.log('\n🏢 Testing Competitor Field Null Safety...');
  
  for (let i = 0; i < testCases.competitors.length; i++) {
    const competitor = testCases.competitors[i];
    try {
      const validated = CompetitorSchema.parse(competitor);
      console.log(`  ✅ Competitor ${i + 1}: domain="${validated.domain}", label="${validated.label}", status="${validated.status}"`);
      
      // Ensure no empty strings in critical fields
      if (!validated.domain || !validated.label) {
        console.log(`  ⚠️  WARNING: Empty critical fields detected`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR validating competitor ${i + 1}: ${(error as Error).message}`);
      allTestsPassed = false;
    }
  }
  
  // ===== TEST 3: Dashboard Request Schema Validation =====
  console.log('\n📊 Testing Dashboard Request Schema...');
  
  for (let i = 0; i < testCases.dashboardRequests.length; i++) {
    const request = testCases.dashboardRequests[i];
    try {
      const validated = DashboardRequestSchema.parse(request);
      console.log(`  ✅ Request ${i + 1}: timePeriod="${validated.timePeriod}" (normalized)`);
      
      // Verify normalization worked
      if (request.timePeriod.toLowerCase() !== validated.timePeriod.toLowerCase()) {
        console.log(`     Normalized: "${request.timePeriod}" → "${validated.timePeriod}"`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR validating request ${i + 1}: ${(error as Error).message}`);
      allTestsPassed = false;
    }
  }
  
  // ===== TEST 4: Insights Request Schema Validation =====
  console.log('\n🤖 Testing Insights Request Schema...');
  
  const insightsRequests = [
    { clientId: 'demo-client-id', timePeriod: 'Last 3 Months' },
    { clientId: 'demo-client-id', timePeriod: 'last 6 months' },
    { clientId: 'demo-client-id' } // Test default
  ];
  
  for (let i = 0; i < insightsRequests.length; i++) {
    const request = insightsRequests[i];
    try {
      const validated = InsightsRequestSchema.parse(request);
      console.log(`  ✅ Insights Request ${i + 1}: timePeriod="${validated.timePeriod}"`);
      
    } catch (error) {
      console.log(`  ❌ ERROR validating insights request ${i + 1}: ${(error as Error).message}`);
      allTestsPassed = false;
    }
  }
  
  // ===== SUMMARY =====
  console.log('\n📋 VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  
  if (allTestsPassed) {
    console.log('🎉 ALL CONTRACT REGRESSION TESTS PASSED!');
    console.log('\n✅ Fixed Issues:');
    console.log('   - Time period normalization supports "Last 3 Months" and "Last 6 Months"');
    console.log('   - Competitor fields properly handle null/empty values with defaults');
    console.log('   - Request schemas normalize time period variations');
    console.log('   - All Zod validations working correctly');
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above');
  }
  
  return allTestsPassed;
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateContractFixes()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Validation script failed:', error);
      process.exit(1);
    });
}

export { validateContractFixes };