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

// Consolidated services from Phase 3 organization
export { GA4DataService } from './PulseDataService';
export { GA4DataProcessor as PulseDataProcessor } from './PulseDataProcessor';
export { ga4ServiceAccountManager } from './ServiceAccountManager';
export { smartGA4DataFetcher } from './SmartDataFetcher';
export { default as GA4IntegrationService } from './Integration';

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