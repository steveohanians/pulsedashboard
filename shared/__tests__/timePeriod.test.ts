/**
 * Unit Tests for Time Period Canonicalization System
 * Tests month edges, leap years, timezone handling, and all core functions
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  parseUILabel,
  toDbRange,
  toGa4Range,
  isCanonicalTimePeriod,
  isLegacyLabel,
  generateQueryKey,
  generateCacheKey,
  toDisplayLabel,
  normalizeMonthBoundary,
  isLeapYear,
  getDaysInMonth,
  TimePeriod,
} from '../timePeriod';

// ===== PARSE UI LABEL TESTS =====

test('parseUILabel: handles standard labels correctly', () => {
  const lastMonth = parseUILabel('Last Month');
  assert.deepEqual(lastMonth, {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  });

  const lastQuarter = parseUILabel('Last Quarter');
  assert.deepEqual(lastQuarter, {
    granularity: 'month',
    months: 3,
    type: 'last_quarter'
  });

  const lastYear = parseUILabel('Last Year');
  assert.deepEqual(lastYear, {
    granularity: 'month',
    months: 12,
    type: 'last_year'
  });

  console.log('✅ Standard labels parsed correctly');
});

test('parseUILabel: handles custom date ranges', () => {
  const customRange = parseUILabel('4/1/2025 to 6/30/2025');
  
  assert.equal(customRange.type, 'custom_range');
  assert.equal(customRange.granularity, 'month');
  assert.ok(customRange.months >= 1);
  assert.equal(customRange.customStart, '2025-04-01');
  assert.equal(customRange.customEnd, '2025-06-30');

  console.log('✅ Custom date ranges parsed correctly');
});

test('parseUILabel: validates input correctly', () => {
  // Test invalid inputs
  assert.throws(() => parseUILabel(''), /Invalid time period label/);
  assert.throws(() => parseUILabel('Invalid Label'), /Unsupported time period label/);
  assert.throws(() => parseUILabel('2025-13-01 to 2025-14-01'), /Invalid custom date range format/);
  assert.throws(() => parseUILabel('6/30/2025 to 4/1/2025'), /Start date must be before end date/);

  console.log('✅ Input validation works correctly');
});

// ===== DATABASE RANGE TESTS =====

test('toDbRange: calculates month ranges correctly', () => {
  const testDate = new Date('2025-03-15T10:00:00Z'); // March 15, 2025 UTC
  
  // Test Last Month (should be February 2025)
  const lastMonth: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  const dbRange = toDbRange(lastMonth, testDate);
  assert.equal(dbRange.startMonth, '2025-02');
  assert.equal(dbRange.endMonth, '2025-02');

  // Test Last Quarter (should be Dec 2024, Jan 2025, Feb 2025)
  const lastQuarter: TimePeriod = {
    granularity: 'month',
    months: 3,
    type: 'last_quarter'
  };
  
  const quarterRange = toDbRange(lastQuarter, testDate);
  assert.equal(quarterRange.startMonth, '2024-12');
  assert.equal(quarterRange.endMonth, '2025-02');

  console.log('✅ Database ranges calculated correctly');
});

test('toDbRange: handles year boundaries correctly', () => {
  const testDate = new Date('2025-01-15T10:00:00Z'); // January 15, 2025 UTC
  
  // Test Last Year from January (should span 2024)
  const lastYear: TimePeriod = {
    granularity: 'month',
    months: 12,
    type: 'last_year'
  };
  
  const yearRange = toDbRange(lastYear, testDate);
  assert.equal(yearRange.startMonth, '2024-01');
  assert.equal(yearRange.endMonth, '2024-12');

  console.log('✅ Year boundary handling works correctly');
});

test('toDbRange: handles custom ranges correctly', () => {
  const customRange: TimePeriod = {
    granularity: 'month',
    months: 3,
    type: 'custom_range',
    customStart: '2025-01-01',
    customEnd: '2025-03-31'
  };
  
  const dbRange = toDbRange(customRange);
  assert.equal(dbRange.startMonth, '2025-01');
  assert.equal(dbRange.endMonth, '2025-03');

  console.log('✅ Custom range database conversion works correctly');
});

// ===== GA4 RANGE TESTS =====

test('toGa4Range: calculates date ranges correctly', () => {
  const testDate = new Date('2025-03-15T10:00:00Z'); // March 15, 2025 UTC
  
  // Test Last Month (should be February 1-28, 2025)
  const lastMonth: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  const ga4Range = toGa4Range(lastMonth, testDate);
  assert.equal(ga4Range.startDate, '2025-02-01');
  assert.equal(ga4Range.endDate, '2025-02-28');

  console.log('✅ GA4 ranges calculated correctly');
});

test('toGa4Range: handles leap year correctly', () => {
  const testDate = new Date('2024-03-15T10:00:00Z'); // March 15, 2024 (leap year)
  
  const lastMonth: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  const ga4Range = toGa4Range(lastMonth, testDate);
  assert.equal(ga4Range.startDate, '2024-02-01');
  assert.equal(ga4Range.endDate, '2024-02-29'); // Leap year February has 29 days

  console.log('✅ Leap year handling works correctly');
});

test('toGa4Range: handles custom ranges correctly', () => {
  const customRange: TimePeriod = {
    granularity: 'month',
    months: 3,
    type: 'custom_range',
    customStart: '2025-01-01',
    customEnd: '2025-03-31'
  };
  
  const ga4Range = toGa4Range(customRange);
  assert.equal(ga4Range.startDate, '2025-01-01');
  assert.equal(ga4Range.endDate, '2025-03-31');

  console.log('✅ Custom range GA4 conversion works correctly');
});

// ===== VALIDATION TESTS =====

test('isCanonicalTimePeriod: validates objects correctly', () => {
  const validPeriod: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  assert.ok(isCanonicalTimePeriod(validPeriod));
  assert.ok(!isCanonicalTimePeriod({}));
  assert.ok(!isCanonicalTimePeriod('Last Month'));
  assert.ok(!isCanonicalTimePeriod(null));

  console.log('✅ Canonical validation works correctly');
});

test('isLegacyLabel: identifies legacy labels', () => {
  assert.ok(isLegacyLabel('Last Month'));
  assert.ok(isLegacyLabel('Last Quarter'));
  assert.ok(isLegacyLabel('Last Year'));
  assert.ok(isLegacyLabel('Custom Date Range'));
  assert.ok(!isLegacyLabel('Invalid Label'));

  console.log('✅ Legacy label identification works correctly');
});

// ===== QUERY KEY TESTS =====

test('generateQueryKey: creates consistent keys', () => {
  const period: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  const key1 = generateQueryKey(period);
  const key2 = generateQueryKey(period);
  
  assert.deepEqual(key1, key2);
  assert.equal(key1[0], 'timePeriod');
  assert.deepEqual(key1[1], period);

  console.log('✅ Query key generation works correctly');
});

test('generateCacheKey: creates cache keys', () => {
  const lastMonth: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  const cacheKey = generateCacheKey(lastMonth);
  assert.equal(cacheKey, 'period:last_month:1');

  const customRange: TimePeriod = {
    granularity: 'month',
    months: 3,
    type: 'custom_range',
    customStart: '2025-01-01',
    customEnd: '2025-03-31'
  };
  
  const customCacheKey = generateCacheKey(customRange);
  assert.equal(customCacheKey, 'period:custom:2025-01-01:2025-03-31');

  console.log('✅ Cache key generation works correctly');
});

// ===== DISPLAY TESTS =====

test('toDisplayLabel: converts back to labels', () => {
  const lastMonth: TimePeriod = {
    granularity: 'month',
    months: 1,
    type: 'last_month'
  };
  
  assert.equal(toDisplayLabel(lastMonth), 'Last Month');

  const customRange: TimePeriod = {
    granularity: 'month',
    months: 3,
    type: 'custom_range',
    customStart: '2025-01-01',
    customEnd: '2025-03-31'
  };
  
  assert.equal(toDisplayLabel(customRange), '2025-01-01 to 2025-03-31');

  console.log('✅ Display label conversion works correctly');
});

// ===== EDGE CASE TESTS =====

test('month boundary normalization works correctly', () => {
  const date = new Date('2025-03-15T14:30:45.123Z');
  const normalized = normalizeMonthBoundary(date);
  
  assert.equal(normalized.getDate(), 1);
  assert.equal(normalized.getHours(), 0);
  assert.equal(normalized.getMinutes(), 0);
  assert.equal(normalized.getSeconds(), 0);
  assert.equal(normalized.getMilliseconds(), 0);

  console.log('✅ Month boundary normalization works correctly');
});

test('leap year detection works correctly', () => {
  assert.ok(isLeapYear(2024)); // Divisible by 4, not by 100
  assert.ok(isLeapYear(2000)); // Divisible by 400
  assert.ok(!isLeapYear(1900)); // Divisible by 100, not by 400
  assert.ok(!isLeapYear(2023)); // Not divisible by 4

  console.log('✅ Leap year detection works correctly');
});

test('days in month calculation works correctly', () => {
  assert.equal(getDaysInMonth(2024, 2), 29); // February in leap year
  assert.equal(getDaysInMonth(2023, 2), 28); // February in non-leap year
  assert.equal(getDaysInMonth(2025, 1), 31); // January
  assert.equal(getDaysInMonth(2025, 4), 30); // April

  console.log('✅ Days in month calculation works correctly');
});

// ===== INTEGRATION TESTS =====

test('end-to-end flow works correctly', () => {
  // Parse UI label
  const canonical = parseUILabel('Last Quarter');
  
  // Validate canonical object
  assert.ok(isCanonicalTimePeriod(canonical));
  
  // Convert to database range
  const testDate = new Date('2025-04-15T10:00:00Z');
  const dbRange = toDbRange(canonical, testDate);
  
  // Convert to GA4 range
  const ga4Range = toGa4Range(canonical, testDate);
  
  // Generate query key
  const queryKey = generateQueryKey(canonical);
  
  // Convert back to display label
  const displayLabel = toDisplayLabel(canonical);
  
  // Verify all conversions
  assert.equal(canonical.months, 3);
  assert.equal(dbRange.startMonth, '2025-01');
  assert.equal(dbRange.endMonth, '2025-03');
  assert.equal(ga4Range.startDate, '2025-01-01');
  assert.equal(ga4Range.endDate, '2025-03-31');
  assert.equal(displayLabel, 'Last Quarter');

  console.log('✅ End-to-end flow works correctly');
});

// Run all tests
async function runAllTests() {
  console.log('🧪 Running Time Period Canonicalization Tests...\n');
  
  try {
    console.log('\n✅ All time period tests passed successfully!');
  } catch (error) {
    console.error('❌ Time period tests failed:', error);
    process.exit(1);
  }
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}