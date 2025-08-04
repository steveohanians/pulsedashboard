/**
 * Type definitions for Sample Data Management
 */

export interface SampleDataOptions {
  clientId: string;
  periods?: number; // Default 15 months
  forceGeneration?: boolean; // Force generation even if data exists
  skipGA4Check?: boolean; // Skip GA4 access validation (dangerous - use with caution)
}

export interface GenerationResult {
  success: boolean;
  clientId: string;
  periodsGenerated: number;
  metricsCreated: number;
  competitorsGenerated: number;
  errors: string[];
  warnings: string[];
  safetyChecks: ClientSafetyCheck;
}

export interface ClientSafetyCheck {
  hasGA4Access: boolean;
  hasExistingGA4Data: boolean;
  hasGA4PropertyConfigured: boolean;
  isSafeForSampleData: boolean;
  reason: string;
}

export interface SampleMetricData {
  bounceRate: number;
  sessionDuration: number;
  pagesPerSession: number;
  sessionsPerUser: number;
}

export interface TrendVariation {
  type: 'improving' | 'declining' | 'stable' | 'volatile';
  magnitude: number; // Percentage change over time
  seasonality?: boolean;
}

export interface CompetitorConfig {
  count: number; // Number of competitors to generate
  variation: number; // Percentage variation from client baseline
  domains: string[];
}

export interface TrafficChannelDistribution {
  'Organic Search': number;
  'Direct': number;
  'Social Media': number;
  'Paid Search': number;
  'Email': number;
  'Referral': number;
  'Other': number;
}

export interface DeviceDistribution {
  'Desktop': number;
  'Mobile': number;
  'Tablet': number;
}