/**
 * Global utilities for processing chart data across portfolio, competitor, and benchmark companies
 * Consolidates proven fetching, parsing, fallback, and conversion logic
 */

import { parseMetricValue } from './metricParser';

export interface CompanyMetricData {
  id: string;
  label: string;
  value: number;
  sourceType: 'Portfolio' | 'Competitor' | 'Benchmark';
}

export interface MetricProcessingOptions {
  metricName: string;
  displayMode: 'average' | 'individual'; // average for portfolio/benchmarks, individual for competitors
  sourceType: 'Portfolio' | 'Competitor' | 'Benchmark';
  fallbackValue?: number;
  convertToPercentage?: boolean;
  convertToMinutes?: boolean; // for session duration
}

/**
 * Extract and process company metrics for chart display
 * Handles both individual companies and averages based on displayMode
 */
export function processCompanyMetrics(
  companies: any[],
  metrics: any[],
  options: MetricProcessingOptions
): CompanyMetricData[] {
  const {
    metricName,
    displayMode,
    sourceType,
    fallbackValue = 0,
    convertToPercentage = false,
    convertToMinutes = false
  } = options;

  if (displayMode === 'average') {
    // Portfolio mode: Calculate average across all companies
    const companyMetrics = companies.map(company => {
      const companyMetric = metrics.find((m: any) => 
        getCompanyId(m, sourceType) === company.id && m.metricName === metricName
      );
      
      if (!companyMetric) return null;
      
      const rawValue = parseMetricValue(companyMetric.value);
      return convertValue(rawValue, { convertToPercentage, convertToMinutes });
    }).filter(value => value !== null && !isNaN(value)) as number[];

    if (companyMetrics.length === 0) {
      return [{
        id: 'average',
        label: `${sourceType} Average`,
        value: fallbackValue,
        sourceType
      }];
    }

    const average = companyMetrics.reduce((sum, val) => sum + val, 0) / companyMetrics.length;
    return [{
      id: 'average',
      label: `${sourceType} Average`,
      value: average,
      sourceType
    }];
  } else {
    // Individual mode: Show each company separately
    return companies.map(company => {
      const companyMetric = metrics.find((m: any) => 
        getCompanyId(m, sourceType) === company.id && m.metricName === metricName
      );
      
      let value = fallbackValue;
      if (companyMetric) {
        const rawValue = parseMetricValue(companyMetric.value);
        value = convertValue(rawValue, { convertToPercentage, convertToMinutes });
      }

      return {
        id: company.id,
        label: formatCompanyLabel(company, sourceType),
        value,
        sourceType
      };
    });
  }
}

/**
 * Process device distribution data for companies
 * Handles the 2-device model (Desktop + Mobile) with proper percentage calculation
 */
export function processDeviceDistribution(
  companies: any[],
  metrics: any[],
  sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'
): Array<{
  id: string;
  label: string;
  value: { Desktop: number; Mobile: number };
  sourceType: string;
}> {
  return companies.map(company => {
    const deviceMetrics = metrics.filter((m: any) => 
      getCompanyId(m, sourceType) === company.id && 
      m.metricName === 'Device Distribution'
    );
    
    const deviceDistribution = { Desktop: 50, Mobile: 50 }; // Default fallback
    
    if (deviceMetrics.length > 0) {
      let desktop = 0;
      let mobile = 0;
      
      deviceMetrics.forEach(metric => {
        if (metric.channel === 'Desktop') {
          desktop = parseMetricValue(metric.value);
        } else if (metric.channel === 'Mobile') {
          mobile = parseMetricValue(metric.value);
        }
      });
      
      // Use parsed data if available and normalize to 100%
      if (desktop > 0 || mobile > 0) {
        const total = desktop + mobile;
        if (total > 0) {
          deviceDistribution.Desktop = (desktop / total) * 100;
          deviceDistribution.Mobile = (mobile / total) * 100;
        }
      }
    }
    
    return {
      id: company.id,
      label: formatCompanyLabel(company, sourceType),
      value: deviceDistribution,
      sourceType
    };
  });
}

/**
 * Get the appropriate company ID field based on source type
 */
function getCompanyId(metric: any, sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'): string | null {
  switch (sourceType) {
    case 'Portfolio':
      return metric.cd_portfolio_company_id || metric.cdPortfolioCompanyId;
    case 'Competitor':
      return metric.competitor_id || metric.competitorId;
    case 'Benchmark':
      return metric.benchmark_company_id || metric.benchmarkCompanyId;
    default:
      return null;
  }
}

/**
 * Format company label based on type and domain
 */
function formatCompanyLabel(company: any, sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'): string {
  if (sourceType === 'Portfolio') {
    return company.name || company.domain?.replace('https://', '').replace('http://', '') || 'Unknown';
  } else {
    return company.domain?.replace('https://', '').replace('http://', '') || company.name || 'Unknown';
  }
}

/**
 * Convert raw values for display (percentages, minutes, etc.)
 */
function convertValue(
  rawValue: number, 
  options: { convertToPercentage?: boolean; convertToMinutes?: boolean }
): number {
  if (options.convertToPercentage) {
    // For bounce rate: 0.5635 -> 56.35
    return rawValue * 100;
  }
  if (options.convertToMinutes) {
    // For session duration: 580 seconds -> 9.67 minutes
    return rawValue / 60;
  }
  return rawValue;
}

/**
 * Generate fallback values based on metric type
 */
export function getMetricFallback(metricName: string): number {
  const fallbacks: Record<string, number> = {
    'Bounce Rate': 42.3,
    'Session Duration': 3.2,
    'Pages per Session': 2.8,
    'Sessions per User': 1.6
  };
  return fallbacks[metricName] || 0;
}

/**
 * Determine if metric should be converted to percentage
 */
export function shouldConvertToPercentage(metricName: string): boolean {
  return metricName === 'Bounce Rate';
}

/**
 * Determine if metric should be converted to minutes
 */
export function shouldConvertToMinutes(metricName: string): boolean {
  return metricName === 'Session Duration';
}