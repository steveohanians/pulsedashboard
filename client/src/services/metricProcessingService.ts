/**
 * Metric Processing Service
 * Handles all metric data aggregation and transformation
 */

import { parseMetricValue } from '@/utils/metricParser';
import { debugLog } from '@/config/dataSourceConfig';

interface DashboardMetric {
  metricName: string;
  value: string | number;
  sourceType: string;
  channel?: string;
  competitorId?: string;
  timePeriod?: string;
}

interface ProcessedMetrics {
  [metricName: string]: {
    [sourceType: string]: number;
  };
}

export class MetricProcessingService {
  private static instance: MetricProcessingService;

  static getInstance(): MetricProcessingService {
    if (!this.instance) {
      this.instance = new MetricProcessingService();
    }
    return this.instance;
  }

  /**
   * Process raw metrics into grouped format for charts
   * Extracted from dashboard.tsx groupedMetrics useMemo
   */
  processMetricsForPeriod(
    metrics: DashboardMetric[],
    averagedMetrics: Record<string, Record<string, number>> | undefined,
    options: {
      targetPeriod?: string;
      isTimeSeries?: boolean;
    } = {}
  ): ProcessedMetrics {
    const { targetPeriod, isTimeSeries } = options;
    
    // Quick return for empty states
    if (!metrics || metrics.length === 0) {
      return averagedMetrics || {};
    }

    const result: ProcessedMetrics = {};
    const counts: Record<string, Record<string, number>> = {};

    // For single-period queries (like "Last Month"), filter to only the target period
    // For time series queries, process all metrics
    const singlePeriodTarget = targetPeriod === "Last Month" ? "2025-07" : null;
    const metricsToProcess = singlePeriodTarget && !isTimeSeries 
      ? metrics.filter(m => m.timePeriod === singlePeriodTarget)
      : metrics;

    debugLog('METRICS', `Processing ${metricsToProcess.length} metrics`, {
      targetPeriod,
      isTimeSeries,
      singlePeriodTarget
    });

    // Process raw metrics
    for (const metric of metricsToProcess) {
      // Normalize sourceType to handle different casings from backend
      let normalizedSourceType = this.normalizeSourceType(metric.sourceType);

      if (!result[metric.metricName]) {
        result[metric.metricName] = {};
        counts[metric.metricName] = {};
      }
      if (!result[metric.metricName][normalizedSourceType]) {
        result[metric.metricName][normalizedSourceType] = 0;
        counts[metric.metricName][normalizedSourceType] = 0;
      }

      let value = parseMetricValue(metric.value);

      // Convert Session Duration from seconds to minutes for all source types
      if (metric.metricName === "Session Duration" && value > 60) {
        value = value / 60;
      }

      result[metric.metricName][normalizedSourceType] += value;
      counts[metric.metricName][normalizedSourceType] += 1;
    }

    // Calculate averages from counts
    for (const metricName in result) {
      for (const sourceType in result[metricName]) {
        if (counts[metricName][sourceType] > 0) {
          result[metricName][sourceType] =
            result[metricName][sourceType] / counts[metricName][sourceType];
        }
      }
    }

    // If we have averagedMetrics, merge them in (but don't replace our calculated CD_Avg)
    if (isTimeSeries && averagedMetrics && typeof averagedMetrics === 'object') {
      for (const metricName in averagedMetrics) {
        if (!result[metricName]) {
          result[metricName] = {};
        }
        for (const sourceType in averagedMetrics[metricName]) {
          // Only use averagedMetrics if we don't already have this value
          // This preserves our calculated CD_Avg values
          if (!result[metricName][sourceType]) {
            result[metricName][sourceType] = averagedMetrics[metricName][sourceType];
          }
        }
      }
    }

    debugLog('METRICS', 'Processed metrics result', {
      metricCount: Object.keys(result).length,
      metrics: Object.keys(result)
    });

    return result;
  }

  /**
   * Normalize source type to handle different casings
   */
  private normalizeSourceType(sourceType: string): string {
    // Handle CD_Avg vs cd_avg casing inconsistency
    if (sourceType.toLowerCase() === "cd_avg") {
      return "CD_Avg";
    }
    
    // Handle other common variations
    const normalizations: Record<string, string> = {
      'industry_avg': 'Industry_Avg',
      'industry': 'Industry_Avg',
      'client': 'Client',
      'competitor': 'Competitor'
    };

    const lower = sourceType.toLowerCase();
    return normalizations[lower] || sourceType;
  }

  /**
   * Get metric value with proper conversion
   */
  getMetricValue(
    metricData: Record<string, number>,
    sourceType: string,
    metricName: string
  ): number | undefined {
    const normalizedSource = this.normalizeSourceType(sourceType);
    const value = metricData[normalizedSource];
    
    if (value === undefined) {
      return undefined;
    }

    // Apply any necessary conversions
    if (metricName === "Session Duration" && value > 60) {
      return value / 60; // Convert to minutes
    }

    return value;
  }

  /**
   * Format metric value for display
   */
  formatMetricValue(value: number, metricName: string): string {
    const roundedValue = Math.round(value * 10) / 10;
    
    if (metricName.includes('Rate')) {
      return `${roundedValue}%`;
    } else if (metricName.includes('Session Duration') || metricName.includes('Duration')) {
      return `${roundedValue} min`;
    } else if (metricName.includes('Pages per Session')) {
      return `${roundedValue} pages`;
    } else if (metricName.includes('Sessions per User')) {
      return `${roundedValue} sessions`;
    }
    
    return `${roundedValue}`;
  }
}

// Export singleton instance
export const metricProcessingService = MetricProcessingService.getInstance();