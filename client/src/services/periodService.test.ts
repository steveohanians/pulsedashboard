import { periodService } from './periodService';

// Quick test to verify the service works correctly
console.log('=== Testing PeriodService ===');

// Test 1: Current data month
const currentMonth = periodService.getCurrentDataMonth();
console.log('Current Data Month (Last Month):', currentMonth);

// Test 2: SEMrush period (should be 1 month behind)
const semrushPeriod = periodService.getSEMrushAvailablePeriod(currentMonth);
console.log('SEMrush Available Period:', semrushPeriod);

// Test 3: Period normalization
console.log('\nPeriod Normalization Tests:');
console.log('  "Last Month" =>', periodService.normalizePeriod('Last Month'));
console.log('  "2024-07" =>', periodService.normalizePeriod('2024-07'));
console.log('  "2024-07-daily-01" =>', periodService.normalizePeriod('2024-07-daily-01'));
console.log('  "2024-07-group-1" =>', periodService.normalizePeriod('2024-07-group-1'));

// Test 4: Period metadata (this is what we'll use in dashboard)
console.log('\nPeriod Metadata for "Last Month":');
const metadata = periodService.getPeriodMetadata('Last Month');
console.log('  GA4 Period:', metadata.ga4Period);
console.log('  SEMrush Period:', metadata.semrushPeriod);
console.log('  Display Period:', metadata.displayPeriod);
console.log('  Is Aligned?:', metadata.isAligned);
console.log('  Warning:', metadata.warning || 'None');

// Test 5: Display formatting
console.log('\nDisplay Formatting:');
console.log('  "2024-07" displays as:', periodService.getDisplayPeriod('2024-07'));
console.log('  "2024-06" displays as:', periodService.getDisplayPeriod('2024-06'));

console.log('\n✅ PeriodService tests complete!');

export {};