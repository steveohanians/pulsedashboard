/**
 * GA4 Data Management Package
 * 
 * This package provides a clean, organized interface for all GA4 data operations.
 * It consolidates authentication, fetching, processing, and storage logic.
 */

export { GA4DataManager } from './GA4DataManager';
export { GA4AuthenticationService } from './GA4AuthenticationService';
export { GA4APIService } from './GA4APIService';
export { GA4DataProcessor } from './GA4DataProcessor';
export { GA4StorageService } from './GA4StorageService';

// Types
export type {
  GA4MetricData,
  GA4PropertyAccess,
  GA4DailyMetric,
  FetchResult,
  DataPeriod,
  SmartFetchOptions
} from './types';

// Constants
export { GA4_ENDPOINTS, GA4_METRICS, GA4_DIMENSIONS, DATA_MANAGEMENT, METRIC_NAMES } from './constants';