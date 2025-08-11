/**
 * Metric Transformation Utilities
 * 
 * Transforms raw source payloads → canonical envelope format before write.
 * Ensures all metrics follow the standardized JSON structure.
 */

import { type CanonicalMetricEnvelope } from "@shared/schema";
import logger from "./logging/logger";

/**
 * Transform GA4 raw data to canonical envelope
 */
export function transformGA4ToCanonical(
  metricName: string,
  rawValue: any,
  timePeriod: string,
  dimensions?: { deviceCategory?: string; channel?: string }
): CanonicalMetricEnvelope {
  logger.debug(`Transforming GA4 metric to canonical: ${metricName}`, { rawValue, timePeriod, dimensions });

  // Convert time period (YYYY-MM) to date (first day of month)
  const date = `${timePeriod}-01`;
  
  // Determine value and units based on metric type
  let value: number;
  let units: string;
  
  if (typeof rawValue === 'number') {
    value = rawValue;
  } else if (typeof rawValue === 'object' && rawValue !== null) {
    // Handle complex objects (like distribution data)
    value = rawValue.value || rawValue.percentage || rawValue.sessions || 0;
  } else {
    value = parseFloat(String(rawValue)) || 0;
  }
  
  // Determine units based on metric name
  if (metricName.toLowerCase().includes('rate')) {
    units = 'percentage';
  } else if (metricName.toLowerCase().includes('duration')) {
    units = 'minutes';
  } else if (metricName.toLowerCase().includes('sessions')) {
    units = 'sessions';
  } else if (metricName.toLowerCase().includes('distribution')) {
    units = 'percentage';
  } else {
    units = 'count';
  }

  const envelope: CanonicalMetricEnvelope = {
    series: [{
      date,
      value,
      dimensions: dimensions || undefined
    }],
    meta: {
      sourceType: "GA4",
      units,
      notes: `Transformed from GA4 for ${metricName} in period ${timePeriod}`
    }
  };

  logger.debug(`Canonical envelope created for ${metricName}`, envelope);
  return envelope;
}

/**
 * Transform SEMrush raw data to canonical envelope
 */
export function transformSEMrushToCanonical(
  metricName: string,
  rawValue: any,
  timePeriod: string,
  dimensions?: { deviceCategory?: string; channel?: string }
): CanonicalMetricEnvelope {
  logger.debug(`Transforming SEMrush metric to canonical: ${metricName}`, { rawValue, timePeriod, dimensions });

  const date = `${timePeriod}-01`;
  
  let value: number;
  let units: string;
  
  if (typeof rawValue === 'number') {
    value = rawValue;
  } else if (typeof rawValue === 'object' && rawValue !== null) {
    value = rawValue.value || rawValue.organic_traffic || rawValue.paid_traffic || 0;
  } else {
    value = parseFloat(String(rawValue)) || 0;
  }
  
  // SEMrush-specific unit determination
  if (metricName.toLowerCase().includes('traffic')) {
    units = 'sessions';
  } else if (metricName.toLowerCase().includes('keywords')) {
    units = 'count';
  } else if (metricName.toLowerCase().includes('position')) {
    units = 'ranking';
  } else {
    units = 'count';
  }

  return {
    series: [{
      date,
      value,
      dimensions: dimensions || undefined
    }],
    meta: {
      sourceType: "SEMrush",
      units,
      notes: `Transformed from SEMrush for ${metricName} in period ${timePeriod}`
    }
  };
}

/**
 * Transform DataForSEO raw data to canonical envelope
 */
export function transformDataForSEOToCanonical(
  metricName: string,
  rawValue: any,
  timePeriod: string,
  dimensions?: { deviceCategory?: string; channel?: string }
): CanonicalMetricEnvelope {
  logger.debug(`Transforming DataForSEO metric to canonical: ${metricName}`, { rawValue, timePeriod, dimensions });

  const date = `${timePeriod}-01`;
  
  let value: number;
  let units: string;
  
  if (typeof rawValue === 'number') {
    value = rawValue;
  } else if (typeof rawValue === 'object' && rawValue !== null) {
    value = rawValue.value || rawValue.search_volume || rawValue.cpc || 0;
  } else {
    value = parseFloat(String(rawValue)) || 0;
  }
  
  // DataForSEO-specific unit determination
  if (metricName.toLowerCase().includes('volume')) {
    units = 'count';
  } else if (metricName.toLowerCase().includes('cpc')) {
    units = 'currency';
  } else if (metricName.toLowerCase().includes('difficulty')) {
    units = 'score';
  } else {
    units = 'count';
  }

  return {
    series: [{
      date,
      value,
      dimensions: dimensions || undefined
    }],
    meta: {
      sourceType: "DataForSEO",
      units,
      notes: `Transformed from DataForSEO for ${metricName} in period ${timePeriod}`
    }
  };
}

/**
 * Auto-detect source type and transform to canonical envelope
 */
export function transformToCanonical(
  metricName: string,
  rawValue: any,
  timePeriod: string,
  sourceType: string,
  dimensions?: { deviceCategory?: string; channel?: string }
): CanonicalMetricEnvelope {
  switch (sourceType.toLowerCase()) {
    case 'ga4':
    case 'google_analytics':
      return transformGA4ToCanonical(metricName, rawValue, timePeriod, dimensions);
    
    case 'semrush':
      return transformSEMrushToCanonical(metricName, rawValue, timePeriod, dimensions);
    
    case 'dataforseo':
    case 'data_for_seo':
      return transformDataForSEOToCanonical(metricName, rawValue, timePeriod, dimensions);
    
    default:
      logger.warn(`Unknown source type for transformation: ${sourceType}, defaulting to GA4`);
      return transformGA4ToCanonical(metricName, rawValue, timePeriod, dimensions);
  }
}

/**
 * Extract data from canonical envelope for legacy compatibility
 */
export function extractLegacyValue(envelope: CanonicalMetricEnvelope): any {
  if (envelope.series.length === 0) {
    return null;
  }
  
  // For single series, return the value directly
  if (envelope.series.length === 1) {
    const series = envelope.series[0];
    if (series.dimensions) {
      return {
        value: series.value,
        dimensions: series.dimensions
      };
    }
    return series.value;
  }
  
  // For multiple series, return array format
  return envelope.series.map(s => ({
    date: s.date,
    value: s.value,
    dimensions: s.dimensions
  }));
}

/**
 * Validate that a canonical envelope is properly formatted
 */
export function isValidCanonicalEnvelope(data: any): data is CanonicalMetricEnvelope {
  try {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.series) &&
      data.series.length > 0 &&
      data.meta &&
      typeof data.meta.sourceType === 'string' &&
      typeof data.meta.units === 'string'
    );
  } catch {
    return false;
  }
}