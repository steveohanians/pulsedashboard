/**
 * Type definitions for GA4 Data Management
 */

export interface GA4MetricData {
  bounceRate: number;
  sessionDuration: number;
  pagesPerSession: number;
  sessionsPerUser: number;
  totalSessions: number;
  totalUsers: number;
  trafficChannels: Array<{
    channel: string;
    sessions: number;
    percentage: number;
  }>;
  deviceDistribution: Array<{
    device: string;
    sessions: number;
    percentage: number;
  }>;
}

export interface GA4PropertyAccess {
  propertyId: string;
  serviceAccountId: string;
  accessToken: string;
}

export interface GA4DailyMetric {
  date: string;
  metrics: {
    bounceRate: number;
    sessionDuration: number;
    pagesPerSession: number;
    sessionsPerUser: number;
    totalSessions: number;
    totalUsers: number;
  };
}

export interface DataPeriod {
  year: number;
  month: number;
  period: string; // YYYY-MM format
  type: 'daily' | 'monthly';
  startDate: string;
  endDate: string;
}

export interface FetchResult {
  success: boolean;
  periodsProcessed: number;
  dailyDataPeriods: string[];
  monthlyDataPeriods: string[];
  errors: string[];
}

export interface SmartFetchOptions {
  clientId: string;
  periods?: number; // Default 15 months
  forceRefresh?: boolean;
  dailyDataThreshold?: number; // Months to keep daily data (default 3)
}

export interface ExistingDataStatus {
  period: string;
  metricName: string;
  dataType: 'daily' | 'monthly' | 'none';
  recordCount: number;
}

export interface TokenRefreshResult {
  access_token: string;
  expiry_date: number;
}