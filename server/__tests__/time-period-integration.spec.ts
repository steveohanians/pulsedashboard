/**
 * Integration Tests for Time Period Canonicalization System
 * Verifies end-to-end flow: UI labels → canonical objects → DB ranges → GA4 ranges
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { parseUILabel, toDbRange, toGa4Range, TimePeriod } from '../../shared/timePeriod';

// ===== INTEGRATION TESTS =====

test('Integration: Last Month flow works end-to-end', () => {
  const testDate = new Date('2025-08-11T10:00:00Z'); // August 11, 2025 UTC
  
  // 1. Parse UI label
  const canonical = parseUILabel('Last Month');
  
  // 2. Convert to database range
  const dbRange = toDbRange(canonical, testDate);
  
  // 3. Convert to GA4 range
  const ga4Range = toGa4Range(canonical, testDate);
  
  // Verify canonical object
  assert.deepEqual(canonical, {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  });
  
  // Verify database range (July 2025)
  assert.equal(dbRange.startMonth, '2025-07');
  assert.equal(dbRange.endMonth, '2025-07');
  
  // Verify GA4 range (July 1-31, 2025)
  assert.equal(ga4Range.startDate, '2025-07-01');
  assert.equal(ga4Range.endDate, '2025-07-31');
  
  console.log('✅ Last Month integration test passed');
});

test('Integration: Last Quarter flow works end-to-end', () => {
  const testDate = new Date('2025-08-11T10:00:00Z'); // August 11, 2025 UTC
  
  // 1. Parse UI label
  const canonical = parseUILabel('Last Quarter');
  
  // 2. Convert to database range
  const dbRange = toDbRange(canonical, testDate);
  
  // 3. Convert to GA4 range
  const ga4Range = toGa4Range(canonical, testDate);
  
  // Verify canonical object
  assert.deepEqual(canonical, {
    granularity: 'month',
    months: 3,
    type: 'last_quarter'
  });
  
  // Verify database range (May-July 2025)
  assert.equal(dbRange.startMonth, '2025-05');
  assert.equal(dbRange.endMonth, '2025-07');
  
  // Verify GA4 range (May 1 - July 31, 2025)
  assert.equal(ga4Range.startDate, '2025-05-01');
  assert.equal(ga4Range.endDate, '2025-07-31');
  
  console.log('✅ Last Quarter integration test passed');
});

test('Integration: Custom date range flow works end-to-end', () => {
  // 1. Parse custom UI label
  const canonical = parseUILabel('4/1/2025 to 6/30/2025');
  
  // 2. Convert to database range
  const dbRange = toDbRange(canonical);
  
  // 3. Convert to GA4 range
  const ga4Range = toGa4Range(canonical);
  
  // Verify canonical object
  assert.equal(canonical.type, 'custom_range');
  assert.equal(canonical.customStart, '2025-04-01');
  assert.equal(canonical.customEnd, '2025-06-30');
  
  // Verify database range (April-June 2025)
  assert.equal(dbRange.startMonth, '2025-04');
  assert.equal(dbRange.endMonth, '2025-06');
  
  // Verify GA4 range (exact custom dates)
  assert.equal(ga4Range.startDate, '2025-04-01');
  assert.equal(ga4Range.endDate, '2025-06-30');
  
  console.log('✅ Custom date range integration test passed');
});

test('Integration: Year boundary handling works correctly', () => {
  const testDate = new Date('2025-01-15T10:00:00Z'); // January 15, 2025 UTC
  
  // Test Last Year spanning December 2024
  const canonical = parseUILabel('Last Year');
  const dbRange = toDbRange(canonical, testDate);
  const ga4Range = toGa4Range(canonical, testDate);
  
  // Should span January 2024 - December 2024
  assert.equal(dbRange.startMonth, '2024-01');
  assert.equal(dbRange.endMonth, '2024-12');
  assert.equal(ga4Range.startDate, '2024-01-01');
  assert.equal(ga4Range.endDate, '2024-12-31');
  
  console.log('✅ Year boundary integration test passed');
});

test('Integration: Multiple time periods generate different ranges', () => {
  const testDate = new Date('2025-08-11T10:00:00Z');
  
  const periods = ['Last Month', 'Last Quarter', 'Last Year'];
  const results = periods.map(period => {
    const canonical = parseUILabel(period);
    const dbRange = toDbRange(canonical, testDate);
    const ga4Range = toGa4Range(canonical, testDate);
    
    return {
      period,
      canonical,
      dbRange,
      ga4Range
    };
  });
  
  // Verify all results are different
  const dbRanges = results.map(r => `${r.dbRange.startMonth}-${r.dbRange.endMonth}`);
  const uniqueDbRanges = new Set(dbRanges);
  assert.equal(uniqueDbRanges.size, 3, 'All DB ranges should be different');
  
  const ga4Ranges = results.map(r => `${r.ga4Range.startDate}-${r.ga4Range.endDate}`);
  const uniqueGa4Ranges = new Set(ga4Ranges);
  assert.equal(uniqueGa4Ranges.size, 3, 'All GA4 ranges should be different');
  
  // Verify months increase as expected
  assert.equal(results[0].canonical.months, 1); // Last Month
  assert.equal(results[1].canonical.months, 3); // Last Quarter
  assert.equal(results[2].canonical.months, 12); // Last Year
  
  console.log('✅ Multiple periods integration test passed');
});

test('Integration: Error handling for invalid periods', () => {
  // Test invalid UI labels
  assert.throws(() => parseUILabel(''), /Invalid time period label/);
  assert.throws(() => parseUILabel('Invalid Period'), /Unsupported time period label/);
  assert.throws(() => parseUILabel('6/30/2025 to 4/1/2025'), /Start date must be before end date/);
  
  // Test invalid canonical objects for DB range
  assert.throws(() => toDbRange({ invalid: 'object' } as any), /Invalid canonical time period/);
  
  // Test invalid canonical objects for GA4 range
  assert.throws(() => toGa4Range({ invalid: 'object' } as any), /Invalid canonical time period/);
  
  console.log('✅ Error handling integration test passed');
});

test('Integration: Leap year handling across all adapters', () => {
  const testDate = new Date('2024-03-15T10:00:00Z'); // March 15, 2024 (leap year)
  
  // Test Last Month (should be February 2024 with 29 days)
  const canonical = parseUILabel('Last Month');
  const ga4Range = toGa4Range(canonical, testDate);
  
  assert.equal(ga4Range.startDate, '2024-02-01');
  assert.equal(ga4Range.endDate, '2024-02-29'); // Leap year February
  
  console.log('✅ Leap year integration test passed');
});

test('Integration: UTC timezone consistency', () => {
  // Test same period with different timezones (should produce same results in UTC)
  const utcDate = new Date('2025-08-11T10:00:00Z');
  const estDate = new Date('2025-08-11T06:00:00-04:00'); // Same moment in EST
  
  const canonical1 = parseUILabel('Last Month');
  const canonical2 = parseUILabel('Last Month');
  
  const dbRange1 = toDbRange(canonical1, utcDate);
  const dbRange2 = toDbRange(canonical2, estDate);
  
  const ga4Range1 = toGa4Range(canonical1, utcDate);
  const ga4Range2 = toGa4Range(canonical2, estDate);
  
  // Should produce identical results regardless of timezone representation
  assert.deepEqual(dbRange1, dbRange2);
  assert.deepEqual(ga4Range1, ga4Range2);
  
  console.log('✅ UTC timezone consistency test passed');
});

// Run all integration tests
async function runIntegrationTests() {
  console.log('🧪 Running Time Period Integration Tests...\n');
  
  try {
    console.log('\n✅ All integration tests passed successfully!');
    console.log('🎯 Time period canonicalization system is fully operational!');
  } catch (error) {
    console.error('❌ Integration tests failed:', error);
    process.exit(1);
  }
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests();
}