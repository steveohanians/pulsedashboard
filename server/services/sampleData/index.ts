/**
 * Sample Data Management Package
 * 
 * This package provides safe sample data generation that never overwrites
 * authentic GA4 data. It only generates data for clients without GA4 access.
 */

export { SampleDataManager } from './SampleDataManager';
export { SampleDataGenerator } from './SampleDataGenerator';
export { SampleDataValidator } from './SampleDataValidator';

// Types
export type {
  SampleDataOptions,
  GenerationResult,
  ClientSafetyCheck,
  SampleMetricData,
  TrendVariation
} from './types';

// Constants
export { SAMPLE_DATA_CONFIG, METRIC_RANGES, TREND_PATTERNS } from './constants';