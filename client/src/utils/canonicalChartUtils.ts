/**
 * Canonical Chart Utilities
 * 
 * Simplified chart utilities that read from canonical metric envelopes.
 * Eliminates source-specific branching logic in chart components.
 */

import { type CanonicalMetricEnvelope } from "@shared/schema";
import { logger } from '@/utils/logger';

/**
 * Extract values from canonical metric envelope for chart rendering
 */
export function extractMetricValue(envelope: CanonicalMetricEnvelope): number {
  if (!envelope || !envelope.series || envelope.series.length === 0) {
    return 0;
  }

  // For single series metrics, return the value directly
  if (envelope.series.length === 1) {
    return envelope.series[0].value;
  }

  // For multi-series metrics, sum the values
  return envelope.series.reduce((sum, series) => sum + series.value, 0);
}

/**
 * Extract time series data from canonical envelope for line charts
 */
export function extractTimeSeriesData(envelope: CanonicalMetricEnvelope): Array<{ date: string; value: number }> {
  if (!envelope || !envelope.series) {
    return [];
  }

  return envelope.series.map(series => ({
    date: series.date,
    value: series.value
  }));
}

/**
 * Extract device distribution data from canonical envelope
 */
export function extractDeviceDistribution(envelope: CanonicalMetricEnvelope): Record<string, number> {
  if (!envelope || !envelope.series) {
    return {};
  }

  const distribution: Record<string, number> = {};
  
  envelope.series.forEach(series => {
    if (series.dimensions?.deviceCategory) {
      distribution[series.dimensions.deviceCategory] = series.value;
    }
  });

  return distribution;
}

/**
 * Extract traffic channel data from canonical envelope
 */
export function extractTrafficChannels(envelope: CanonicalMetricEnvelope): Array<{ channel: string; value: number; percentage?: number }> {
  if (!envelope || !envelope.series) {
    return [];
  }

  return envelope.series
    .filter(series => series.dimensions?.channel)
    .map(series => ({
      channel: series.dimensions!.channel!,
      value: series.value,
      percentage: envelope.meta.units === 'percentage' ? series.value : undefined
    }));
}

/**
 * Format metric value based on canonical envelope units
 */
export function formatCanonicalValue(envelope: CanonicalMetricEnvelope, value?: number): string {
  const actualValue = value ?? extractMetricValue(envelope);
  const roundedValue = Math.round(actualValue * 10) / 10;
  
  switch (envelope.meta.units) {
    case 'percentage':
      return `${roundedValue}%`;
    case 'minutes':
      return `${roundedValue} min`;
    case 'sessions':
      return `${roundedValue.toLocaleString()}`;
    case 'count':
      return `${roundedValue.toLocaleString()}`;
    case 'currency':
      return `$${roundedValue.toFixed(2)}`;
    case 'score':
      return `${roundedValue}/100`;
    case 'ranking':
      return `#${roundedValue}`;
    default:
      return `${roundedValue}`;
  }
}

/**
 * Check if metric has canonical envelope format
 */
export function hasCanonicalEnvelope(metric: any): metric is { canonicalEnvelope: CanonicalMetricEnvelope } {
  return (
    metric &&
    typeof metric === 'object' &&
    metric.canonicalEnvelope &&
    Array.isArray(metric.canonicalEnvelope.series) &&
    metric.canonicalEnvelope.meta &&
    typeof metric.canonicalEnvelope.meta.sourceType === 'string'
  );
}

/**
 * Extract metric data with dual-read capability (canonical preferred, legacy fallback)
 */
export function extractMetricData(metric: any): {
  value: number;
  formattedValue: string;
  units: string;
  sourceType: string;
  isCanonical: boolean;
} {
  // Prefer canonical envelope if available
  if (hasCanonicalEnvelope(metric)) {
    const envelope = metric.canonicalEnvelope;
    return {
      value: extractMetricValue(envelope),
      formattedValue: formatCanonicalValue(envelope),
      units: envelope.meta.units,
      sourceType: envelope.meta.sourceType,
      isCanonical: true
    };
  }

  // Fallback to legacy format with warning
  logger.warn('Using legacy metric format, consider migrating to canonical envelope', {
    metricName: metric.metricName,
    sourceType: metric.sourceType
  });

  // Legacy value extraction (simplified)
  let value = 0;
  if (typeof metric.value === 'number') {
    value = metric.value;
  } else if (typeof metric.value === 'string') {
    value = parseFloat(metric.value) || 0;
  }

  // Legacy unit determination
  let units = 'count';
  if (metric.metricName?.toLowerCase().includes('rate')) {
    units = 'percentage';
  } else if (metric.metricName?.toLowerCase().includes('duration')) {
    units = 'minutes';
  }

  return {
    value,
    formattedValue: formatLegacyValue(value, units),
    units,
    sourceType: metric.sourceType || 'Unknown',
    isCanonical: false
  };
}

/**
 * Legacy value formatter (for backward compatibility)
 */
function formatLegacyValue(value: number, units: string): string {
  const roundedValue = Math.round(value * 10) / 10;
  
  switch (units) {
    case 'percentage':
      return `${roundedValue}%`;
    case 'minutes':
      return `${roundedValue} min`;
    default:
      return `${roundedValue}`;
  }
}

/**
 * Compare metrics from different sources using canonical format
 */
export function compareCanonicalMetrics(metrics: Array<{ sourceType: string; envelope: CanonicalMetricEnvelope }>): {
  client?: number;
  competitor?: number;
  cdAvg?: number;
  industryAvg?: number;
} {
  const comparison: any = {};

  metrics.forEach(({ sourceType, envelope }) => {
    const value = extractMetricValue(envelope);
    
    switch (sourceType.toLowerCase()) {
      case 'client':
        comparison.client = value;
        break;
      case 'competitor':
        comparison.competitor = value;
        break;
      case 'cd_avg':
      case 'cd_portfolio':
        comparison.cdAvg = value;
        break;
      case 'industry_avg':
      case 'industry':
        comparison.industryAvg = value;
        break;
    }
  });

  return comparison;
}

/**
 * Get insight context from canonical metric envelopes
 */
export function getCanonicalInsightContext(
  metricName: string,
  clientEnvelope: CanonicalMetricEnvelope,
  benchmarkEnvelopes: Array<{ sourceType: string; envelope: CanonicalMetricEnvelope }>
): string {
  const clientValue = extractMetricValue(clientEnvelope);
  const clientFormatted = formatCanonicalValue(clientEnvelope, clientValue);
  
  const benchmarks = benchmarkEnvelopes.map(({ sourceType, envelope }) => ({
    sourceType,
    value: extractMetricValue(envelope),
    formatted: formatCanonicalValue(envelope)
  }));

  let context = `${metricName}: ${clientFormatted}`;
  
  benchmarks.forEach(({ sourceType, formatted }) => {
    context += `, ${sourceType}: ${formatted}`;
  });

  return context;
}