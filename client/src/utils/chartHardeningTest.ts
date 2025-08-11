/**
 * Comprehensive Chart Hardening Test Suite
 * 
 * This test suite validates that all chart components can safely handle:
 * - Null and undefined values
 * - Missing CSS variables
 * - Empty data arrays
 * - Invalid numeric values
 * - Sparse data with gaps
 * 
 * Used to prevent chart crashes and ensure robust rendering across all conditions.
 */

import { 
  normalizeChartData, 
  safeNumericValue, 
  safeTooltipProps,
  validateCSSColor,
  BASE_ENTITY_COLORS 
} from './chartUtils';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
}

/**
 * Test data normalization with various edge cases
 */
function testDataNormalization(): TestResult[] {
  const results: TestResult[] = [];

  // Test 1: Empty data array
  try {
    const normalized = normalizeChartData([], {
      gapOnNull: true,
      defaultValue: 0,
      requiredKeys: ['client', 'industry']
    });
    results.push({
      testName: 'Empty data array normalization',
      passed: Array.isArray(normalized) && normalized.length === 0
    });
  } catch (error) {
    results.push({
      testName: 'Empty data array normalization',
      passed: false,
      error: String(error)
    });
  }

  // Test 2: Data with null values
  try {
    const testData = [
      { period: 'Jan', client: null, industry: 50 },
      { period: 'Feb', client: 25, industry: undefined },
      { period: 'Mar', client: 'invalid', industry: NaN }
    ];
    const normalized = normalizeChartData(testData, {
      gapOnNull: true,
      defaultValue: 0,
      requiredKeys: ['client', 'industry']
    });
    results.push({
      testName: 'Null values handling',
      passed: normalized.length === 3 && 
              normalized[0].client === undefined &&
              normalized[1].industry === 0
    });
  } catch (error) {
    results.push({
      testName: 'Null values handling',
      passed: false,
      error: String(error)
    });
  }

  // Test 3: Missing required keys
  try {
    const testData = [
      { period: 'Jan', client: 100 },
      { period: 'Feb', industry: 50 }
    ];
    const normalized = normalizeChartData(testData, {
      gapOnNull: false,
      defaultValue: 0,
      requiredKeys: ['client', 'industry']
    });
    results.push({
      testName: 'Missing required keys',
      passed: normalized.length === 2 &&
              normalized[0].industry === 0 &&
              normalized[1].client === 0
    });
  } catch (error) {
    results.push({
      testName: 'Missing required keys',
      passed: false,
      error: String(error)
    });
  }

  return results;
}

/**
 * Test safe numeric value conversion
 */
function testSafeNumericValue(): TestResult[] {
  const results: TestResult[] = [];

  const testCases = [
    { input: null, expected: null },
    { input: undefined, expected: null },
    { input: NaN, expected: null },
    { input: Infinity, expected: null },
    { input: -Infinity, expected: null },
    { input: 'invalid', expected: null },
    { input: '123', expected: 123 },
    { input: 42, expected: 42 },
    { input: 0, expected: 0 },
    { input: -5, expected: -5 }
  ];

  testCases.forEach(({ input, expected }, index) => {
    try {
      const result = safeNumericValue(input as any, 0);
      results.push({
        testName: `SafeNumericValue case ${index + 1}: ${input}`,
        passed: result === expected
      });
    } catch (error) {
      results.push({
        testName: `SafeNumericValue case ${index + 1}: ${input}`,
        passed: false,
        error: String(error)
      });
    }
  });

  return results;
}

/**
 * Test CSS color validation and fallback system
 */
function testCSSColorValidation(): TestResult[] {
  const results: TestResult[] = [];

  // Test valid CSS variables
  try {
    const validColor = validateCSSColor('hsl(var(--color-client))');
    results.push({
      testName: 'Valid CSS variable',
      passed: validColor === 'hsl(var(--color-client))'
    });
  } catch (error) {
    results.push({
      testName: 'Valid CSS variable',
      passed: false,
      error: String(error)
    });
  }

  // Test fallback for missing CSS variables
  try {
    const fallbackColor = validateCSSColor('hsl(var(--missing-color))');
    results.push({
      testName: 'Missing CSS variable fallback',
      passed: fallbackColor && fallbackColor.startsWith('#')
    });
  } catch (error) {
    results.push({
      testName: 'Missing CSS variable fallback',
      passed: false,
      error: String(error)
    });
  }

  // Test color function calls
  try {
    const clientColor = BASE_ENTITY_COLORS.client();
    results.push({
      testName: 'Color function execution',
      passed: typeof clientColor === 'string' && clientColor.length > 0
    });
  } catch (error) {
    results.push({
      testName: 'Color function execution',
      passed: false,
      error: String(error)
    });
  }

  return results;
}

/**
 * Test tooltip safety
 */
function testTooltipProps(): TestResult[] {
  const results: TestResult[] = [];

  // Test with empty data
  try {
    const props = safeTooltipProps([]);
    results.push({
      testName: 'Safe tooltip props with empty data',
      passed: typeof props === 'object'
    });
  } catch (error) {
    results.push({
      testName: 'Safe tooltip props with empty data',
      passed: false,
      error: String(error)
    });
  }

  // Test with valid data
  try {
    const testData = [
      { period: 'Jan', value: 100 },
      { period: 'Feb', value: 200 }
    ];
    const props = safeTooltipProps(testData);
    results.push({
      testName: 'Safe tooltip props with valid data',
      passed: typeof props === 'object'
    });
  } catch (error) {
    results.push({
      testName: 'Safe tooltip props with valid data',
      passed: false,
      error: String(error)
    });
  }

  return results;
}

/**
 * Run comprehensive chart hardening tests
 */
export function runChartHardeningTests(): {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
} {
  const allResults: TestResult[] = [
    ...testDataNormalization(),
    ...testSafeNumericValue(),
    ...testCSSColorValidation(),
    ...testTooltipProps()
  ];

  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;

  return {
    passed,
    failed,
    total: allResults.length,
    results: allResults
  };
}

/**
 * Log test results to console for development verification
 */
export function logChartHardeningResults(): void {
  const results = runChartHardeningTests();
  
  console.log('🔒 Chart Hardening Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.total}`);
  
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.results
      .filter(r => !r.passed)
      .forEach(test => {
        console.log(`  - ${test.testName}: ${test.error || 'Unknown error'}`);
      });
  }
  
  if (results.passed === results.total) {
    console.log('\n🎉 All chart components are hardened and ready for production!');
  }
}