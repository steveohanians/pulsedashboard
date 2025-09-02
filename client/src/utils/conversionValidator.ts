/**
 * Validation Testing Suite for Metric Conversions
 * Tests all conversion scenarios to prevent future 4180% bugs
 */

import { convertMetricValue, formatMetricDisplay } from './metricConversion';

export interface ValidationTest {
  name: string;
  metricName: string;
  sourceType: string;
  input: number;
  expectedValue: number;
  expectedUnit: string;
  shouldConvert: boolean;
}

// Test cases covering all known scenarios
export const VALIDATION_TESTS: ValidationTest[] = [
  // Bounce Rate Tests
  {
    name: 'Client bounce rate (already percentage)',
    metricName: 'Bounce Rate',
    sourceType: 'Client',
    input: 41.8,
    expectedValue: 41.8,
    expectedUnit: '%',
    shouldConvert: false
  },
  {
    name: 'Competitor bounce rate (decimal format)',
    metricName: 'Bounce Rate',
    sourceType: 'Competitor',
    input: 0.418,
    expectedValue: 41.8,
    expectedUnit: '%',
    shouldConvert: true
  },
  {
    name: 'Industry_Avg bounce rate (decimal format)',
    metricName: 'Bounce Rate',
    sourceType: 'Industry_Avg',
    input: 0.458,
    expectedValue: 45.8,
    expectedUnit: '%',
    shouldConvert: true
  },
  {
    name: 'CD_Avg bounce rate (already percentage)',
    metricName: 'Bounce Rate',
    sourceType: 'CD_Avg',
    input: 35.1,
    expectedValue: 35.1,
    expectedUnit: '%',
    shouldConvert: false
  },
  
  // Session Duration Tests  
  {
    name: 'Client session duration (seconds)',
    metricName: 'Session Duration',
    sourceType: 'Client',
    input: 180,
    expectedValue: 3,
    expectedUnit: 'min',
    shouldConvert: true
  },
  {
    name: 'Client session duration (already minutes)',
    metricName: 'Session Duration',
    sourceType: 'Client',
    input: 3,
    expectedValue: 3,
    expectedUnit: 'min',
    shouldConvert: false
  },
  {
    name: 'Competitor session duration (seconds)',
    metricName: 'Session Duration',
    sourceType: 'Competitor',
    input: 240,
    expectedValue: 4,
    expectedUnit: 'min',
    shouldConvert: true
  },
  
  // Other Metrics Tests
  {
    name: 'Pages per Session (no conversion)',
    metricName: 'Pages per Session',
    sourceType: 'Client',
    input: 2.4,
    expectedValue: 2.4,
    expectedUnit: 'pages',
    shouldConvert: false
  },
  {
    name: 'Sessions per User (no conversion)',
    metricName: 'Sessions per User',
    sourceType: 'Client',
    input: 1.8,
    expectedValue: 1.8,
    expectedUnit: 'sessions',
    shouldConvert: false
  }
];

export interface ValidationResult {
  test: ValidationTest;
  passed: boolean;
  actualValue: number;
  actualUnit: string;
  actualShouldConvert: boolean;
  error?: string;
}

/**
 * Run all validation tests
 */
export function runValidationTests(): ValidationResult[] {
  return VALIDATION_TESTS.map(test => {
    try {
      const result = convertMetricValue({
        metricName: test.metricName,
        sourceType: test.sourceType,
        rawValue: test.input
      });
      
      const passed = 
        Math.abs(result.value - test.expectedValue) < 0.1 &&
        result.unit === test.expectedUnit &&
        result.wasConverted === test.shouldConvert;
        
      return {
        test,
        passed,
        actualValue: result.value,
        actualUnit: result.unit,
        actualShouldConvert: result.wasConverted,
        error: passed ? undefined : `Expected ${test.expectedValue}${test.expectedUnit}, got ${result.value}${result.unit}`
      };
    } catch (error) {
      return {
        test,
        passed: false,
        actualValue: 0,
        actualUnit: '',
        actualShouldConvert: false,
        error: `Test failed with error: ${error}`
      };
    }
  });
}

/**
 * Log validation results to console
 */
export function logValidationResults(): void {
  const results = runValidationTests();
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.group(`🧪 Metric Conversion Validation: ${passed}/${total} tests passed`);
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const message = result.passed 
      ? `${result.test.name}` 
      : `${result.test.name}: ${result.error}`;
    
    console.log(`${icon} ${message}`);
    
    if (!result.passed) {
      console.log(`   Input: ${result.test.input} | Expected: ${result.test.expectedValue}${result.test.expectedUnit} | Got: ${result.actualValue}${result.actualUnit}`);
    }
  });
  
  console.groupEnd();
  
  if (passed < total) {
    console.error(`🚨 ${total - passed} validation tests failed! Check conversion logic.`);
  } else {
    console.log('🎉 All conversion tests passed!');
  }
}

/**
 * Enable debug mode for conversion tracking
 */
export function enableConversionDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG_CONVERSIONS = true;
    console.log('🔍 Conversion debugging enabled. All conversions will be logged.');
  }
}

/**
 * Test specific scenarios that caused the 4180% bug
 */
export function testDoubleConversionScenarios(): void {
  console.group('🐛 Testing Double Conversion Prevention');
  
  // Simulate the original bug scenario
  const scenarios = [
    {
      name: 'Original Bug: Backend provides 41.8%, frontend multiplies by 100',
      backendValue: 41.8, // Already a percentage from backend
      expectBug: false // Should NOT convert again
    },
    {
      name: 'Competitor decimal: Backend provides 0.418, frontend converts',
      backendValue: 0.418, // Decimal that needs conversion
      expectBug: false // Should convert once to 41.8%
    }
  ];
  
  scenarios.forEach(scenario => {
    const result = convertMetricValue({
      metricName: 'Bounce Rate',
      sourceType: scenario.name.includes('Competitor') ? 'Competitor' : 'Client',
      rawValue: scenario.backendValue
    });
    
    const isBuggy = result.value > 100; // Anything over 100% suggests double conversion
    const status = isBuggy ? '❌ DOUBLE CONVERSION DETECTED' : '✅ Correct';
    
    console.log(`${status} ${scenario.name}`);
    console.log(`  Input: ${scenario.backendValue} → Output: ${result.value}${result.unit}`);
    
    if (isBuggy) {
      console.error(`  🚨 BUG: Value ${result.value}% suggests double conversion!`);
    }
  });
  
  console.groupEnd();
}

// Auto-run validation in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // Run tests after a short delay to avoid blocking initial render
  setTimeout(() => {
    logValidationResults();
    testDoubleConversionScenarios();
  }, 2000);
}