/**
 * Quick test for configuration and services
 */
import { DATA_SOURCE_CONFIG, getMetricFallback, debugLog, shouldConvertToPercentage } from './dataSourceConfig';
import { periodService } from '../services/periodService';

console.log('🔧 === Configuration & Services Test ===');

// Test 1: Data source config
console.log('📊 Data Source Configuration:');
console.log('  GA4 Data Delay:', DATA_SOURCE_CONFIG.GA4.dataDelay, 'months');
console.log('  SEMrush Data Delay:', DATA_SOURCE_CONFIG.SEMRUSH.dataDelay, 'months');

// Test 2: Metric fallbacks
console.log('\n📈 Metric Fallback Values:');
console.log('  Bounce Rate (Client):', getMetricFallback('Bounce Rate', 'Client') + '%');
console.log('  Session Duration (CD_Avg):', getMetricFallback('Session Duration', 'CD_Avg'), 'seconds');

// Test 3: Metric conversion checks
console.log('\n🔄 Metric Conversion Checks:');
console.log('  Bounce Rate needs % conversion:', shouldConvertToPercentage('Bounce Rate'));
console.log('  Pages per Session needs % conversion:', shouldConvertToPercentage('Pages per Session'));

// Test 4: Period service
console.log('\n📅 Period Service:');
const currentMonth = periodService.getCurrentDataMonth();
const semrushMonth = periodService.getSEMrushAvailablePeriod(currentMonth);
console.log('  Current Data Month:', currentMonth);
console.log('  SEMrush Available Month:', semrushMonth);
console.log('  Display Format:', periodService.getDisplayPeriod(currentMonth));

// Test 5: Period metadata (alignment check)
const metadata = periodService.getPeriodMetadata('Last Month');
console.log('\n⚠️  Data Source Alignment:');
console.log('  GA4 Period:', metadata.ga4Period);
console.log('  SEMrush Period:', metadata.semrushPeriod);
console.log('  Aligned?:', metadata.isAligned ? '✅ Yes' : '❌ No');
if (metadata.warning) {
  console.log('  Warning:', metadata.warning);
}

// Test 6: Debug logging (respects environment)
debugLog('CONFIG_TEST', 'Debug logging works correctly');

console.log('\n✅ Configuration & Services tests complete!');

export {};