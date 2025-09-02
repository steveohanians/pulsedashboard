/**
 * Example demonstration of how the global chartDataProcessor utilities
 * make it trivial to add benchmark company support
 * 
 * This shows the power of extracting proven logic into reusable functions
 */

import { 
  processCompanyMetrics, 
  processDeviceDistribution
} from './chartDataProcessor';
import { 
  getDefaultMetricValue,
  shouldConvertToPercentage,
  shouldConvertToMinutes 
} from './chartUtils';
import { convertMetricValue } from './metricConversion';

/**
 * EXAMPLE: Adding benchmark support to any chart component
 * 
 * Before global utilities: Would need to duplicate 30+ lines of logic
 * After global utilities: Just 7 lines of code!
 */
export function generateBenchmarkChartData(
  benchmarkCompanies: any[], 
  metrics: any[], 
  metricName: string
) {
  // This is ALL the code needed to add benchmark support!
  return processCompanyMetrics(benchmarkCompanies, metrics, {
    metricName,
    displayMode: 'individual', // Show each benchmark company separately
    sourceType: 'Benchmark',
    fallbackValue: getDefaultMetricValue(metricName, 'Benchmark'),
    convertToPercentage: shouldConvertToPercentage(metricName),
    convertToMinutes: shouldConvertToMinutes(metricName)
  });
}

/**
 * EXAMPLE: Benchmark device distribution support
 * 
 * Before: Would need to duplicate device parsing, channel logic, percentage calculation
 * After: One simple function call!
 */
export function generateBenchmarkDeviceData(
  benchmarkCompanies: any[], 
  metrics: any[]
) {
  return processDeviceDistribution(benchmarkCompanies, metrics, 'Benchmark');
}

/**
 * EXAMPLE: How to add benchmark support to TimeSeriesChart in dashboard
 * 
 * Simply add this to the chart props:
 * 
 * benchmarks={generateBenchmarkChartData(
 *   benchmarkCompanies, 
 *   metrics, 
 *   metricName
 * )}
 */

/**
 * DEMONSTRATION: Before vs After comparison
 */

// BEFORE GLOBAL UTILITIES (30+ lines per chart):
const oldApproachExample = `
  benchmarks={benchmarkCompanies.map((bench: any) => {
    // Find metric for this benchmark company
    const benchmarkMetric = metrics.find((m: any) => 
      m.benchmarkCompanyId === bench.id && m.metricName === metricName
    );
    
    let value = 42.3; // Fallback
    if (benchmarkMetric) {
      // Apply centralized conversion to ensure consistency
      const converted = convertMetricValue({
        metricName,
        sourceType: 'Benchmark',
        rawValue: parseMetricValue(benchmarkMetric.value)
      });
      value = converted.value;
    }
    
    return {
      id: bench.id,
      label: bench.domain?.replace('https://', '').replace('http://', '') || 'Unknown',
      value
    };
  })}
`;

// AFTER GLOBAL UTILITIES (7 lines):
const newApproachExample = `
  benchmarks={processCompanyMetrics(benchmarkCompanies, metrics, {
    metricName,
    displayMode: 'individual',
    sourceType: 'Benchmark',
    fallbackValue: getDefaultMetricValue(metricName, 'Benchmark'),
    convertToPercentage: shouldConvertToPercentage(metricName),
    convertToMinutes: shouldConvertToMinutes(metricName)
  })}
`;

/**
 * KEY BENEFITS OF THE GLOBAL APPROACH:
 * 
 * 1. **DRY Principle**: No code duplication across components
 * 2. **Consistency**: Same parsing, conversion, and fallback logic everywhere
 * 3. **Maintainability**: Fix a bug once, it's fixed everywhere
 * 4. **Extensibility**: Adding new company types (Portfolio/Competitor/Benchmark) is trivial
 * 5. **Testing**: Test the logic once in utilities instead of in every component
 * 6. **Performance**: Shared logic reduces bundle size
 * 7. **Type Safety**: Centralized interfaces ensure consistency
 */

/**
 * READY FOR PRODUCTION:
 * 
 * When benchmark companies are ready, simply:
 * 1. Add benchmark_company_id to metrics table schema
 * 2. Create benchmark companies table and admin interface
 * 3. Add benchmark data fetching to dashboard API
 * 4. Add benchmark props to chart components
 * 5. Use generateBenchmarkChartData() and generateBenchmarkDeviceData()
 * 
 * That's it! The proven parsing, conversion, and fallback logic is already there.
 */