/**
 * Centralized Metric Conversion System
 * Handles all metric value conversions consistently across all chart components
 * Prevents double conversion and ensures future maintainability
 */

export interface MetricConversionOptions {
  metricName: string;
  sourceType: 'Client' | 'Competitor' | 'Industry_Avg' | 'CD_Avg' | string;
  rawValue: number | null | undefined;
}

export interface ConversionResult {
  value: number;
  unit: string;
  wasConverted: boolean;
  conversionReason?: string;
}

/**
 * Master conversion function - single source of truth for all metric conversions
 */
export function convertMetricValue({ 
  metricName, 
  sourceType, 
  rawValue 
}: MetricConversionOptions): ConversionResult {
  
  // Handle null/undefined values
  if (rawValue === null || rawValue === undefined || isNaN(rawValue)) {
    return { 
      value: 0, 
      unit: getMetricUnit(metricName), 
      wasConverted: false 
    };
  }

  const normalizedSourceType = normalizeSourceType(sourceType);
  
  // Bounce Rate Conversion Logic
  if (isBounceRateMetric(metricName)) {
    return convertBounceRate(rawValue, normalizedSourceType);
  }
  
  // Session Duration Conversion Logic  
  if (isSessionDurationMetric(metricName)) {
    return convertSessionDuration(rawValue, normalizedSourceType);
  }
  
  // Other metrics (Pages per Session, Sessions per User, etc.)
  return {
    value: rawValue,
    unit: getMetricUnit(metricName),
    wasConverted: false
  };
}

/**
 * Bounce Rate conversion with intelligent decimal detection
 */
function convertBounceRate(rawValue: number, sourceType: string): ConversionResult {
  // Smart detection: if value < 1, it's likely in decimal format (0.418)
  if (rawValue < 1) {
    return {
      value: rawValue * 100,
      unit: '%',
      wasConverted: true,
      conversionReason: `Converted decimal ${rawValue} to percentage for ${sourceType}`
    };
  }
  
  // Already in percentage format (41.8)
  return {
    value: rawValue,
    unit: '%',
    wasConverted: false,
    conversionReason: `Value ${rawValue} already in percentage format for ${sourceType}`
  };
}

/**
 * Session Duration conversion (seconds to minutes)
 */
function convertSessionDuration(rawValue: number, sourceType: string): ConversionResult {
  // If value > 60, assume it's in seconds and convert to minutes
  if (rawValue > 60) {
    return {
      value: rawValue / 60,
      unit: 'min',
      wasConverted: true,
      conversionReason: `Converted ${rawValue} seconds to minutes for ${sourceType}`
    };
  }
  
  // Already in minutes
  return {
    value: rawValue,
    unit: 'min',
    wasConverted: false,
    conversionReason: `Value ${rawValue} already in minutes for ${sourceType}`
  };
}

/**
 * Helper functions
 */
function isBounceRateMetric(metricName: string): boolean {
  return metricName === 'Bounce Rate' || metricName.toLowerCase().includes('bounce rate');
}

function isSessionDurationMetric(metricName: string): boolean {
  return metricName === 'Session Duration' || 
         metricName.toLowerCase().includes('session duration') ||
         metricName.toLowerCase().includes('avg session duration');
}

function getMetricUnit(metricName: string): string {
  const units: Record<string, string> = {
    'Bounce Rate': '%',
    'Session Duration': 'min',
    'Pages per Session': 'pages',
    'Sessions per User': 'sessions',
    'Traffic Channels': '%',
    'Device Distribution': '%'
  };
  
  // Check for partial matches
  if (metricName.toLowerCase().includes('rate')) return '%';
  if (metricName.toLowerCase().includes('duration')) return 'min';
  if (metricName.toLowerCase().includes('pages per')) return 'pages';
  if (metricName.toLowerCase().includes('sessions per')) return 'sessions';
  
  return units[metricName] || '';
}

function normalizeSourceType(sourceType: string): string {
  const normalized = sourceType.toLowerCase();
  if (normalized.includes('client')) return 'Client';
  if (normalized.includes('competitor')) return 'Competitor';
  if (normalized.includes('industry')) return 'Industry_Avg';
  if (normalized.includes('cd') || normalized.includes('clear digital')) return 'CD_Avg';
  return sourceType;
}

/**
 * Batch conversion for multiple values (useful for time series data)
 */
export function convertMultipleMetrics(
  values: Array<{ metricName: string; sourceType: string; rawValue: number | null }> 
): Array<ConversionResult & { originalIndex: number }> {
  return values.map((item, index) => ({
    ...convertMetricValue(item),
    originalIndex: index
  }));
}

/**
 * Format value with unit for display
 */
export function formatMetricDisplay(result: ConversionResult): string {
  const rounded = Math.round(result.value * 10) / 10;
  return `${rounded}${result.unit}`;
}

/**
 * Debug logging for conversion tracking
 */
export function logConversion(result: ConversionResult, metricName: string): void {
  if (result.wasConverted && typeof window !== 'undefined' && (window as any).__DEBUG_CONVERSIONS) {
    console.log(`[METRIC CONVERSION] ${metricName}: ${result.conversionReason}`);
  }
}