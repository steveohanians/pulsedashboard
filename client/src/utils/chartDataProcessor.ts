/**
 * Global utilities for processing chart data across portfolio, competitor, and benchmark companies
 * Consolidates proven fetching, parsing, fallback, and conversion logic
 */

import { parseMetricValue } from './metricParser';
import { convertMetricValue, getMetricFallback, shouldConvertToPercentage, shouldConvertToMinutes } from './chartUtils';
import { getCompanyId, formatCompanyLabel } from './sharedUtilities';

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
      return convertMetricValue(rawValue, { convertToPercentage, convertToMinutes });
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
        value = convertMetricValue(rawValue, { convertToPercentage, convertToMinutes });
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
      
      // Handle cases where we only have one device type
      if (desktop > 0 || mobile > 0) {
        // If we have both values, normalize to 100%
        if (desktop > 0 && mobile > 0) {
          const total = desktop + mobile;
          deviceDistribution.Desktop = (desktop / total) * 100;
          deviceDistribution.Mobile = (mobile / total) * 100;
        } 
        // If we only have desktop, mobile is the complement
        else if (desktop > 0 && mobile === 0) {
          // Assume desktop percentage is already out of 100%
          deviceDistribution.Desktop = Math.min(desktop, 100);
          deviceDistribution.Mobile = Math.max(100 - desktop, 0);
        }
        // If we only have mobile, desktop is the complement  
        else if (mobile > 0 && desktop === 0) {
          // Assume mobile percentage is already out of 100%
          deviceDistribution.Mobile = Math.min(mobile, 100);
          deviceDistribution.Desktop = Math.max(100 - mobile, 0);
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