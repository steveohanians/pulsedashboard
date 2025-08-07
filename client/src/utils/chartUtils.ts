// Consolidated chart utility functions
// Used across multiple chart components to reduce duplication

import { logger } from './logger';

/**
 * Common tooltip content style for consistent chart tooltips
 */
export const TOOLTIP_STYLES = {
  container: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
    padding: '8px 12px',
    fontSize: '12px'
  },
  label: {
    color: 'hsl(var(--foreground))',
    fontWeight: 'medium' as const,
    fontSize: '11px',
    marginBottom: '4px'
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px'
  },
  indicator: {
    width: '8px',
    height: '8px',
    marginRight: '6px',
    borderRadius: '50%'
  },
  text: {
    color: 'hsl(var(--foreground))',
    fontSize: '11px'
  }
};

/**
 * Format metric values for display in tooltips and charts
 * Supports percentage, duration, and numeric formatting
 */
export function formatMetricValue(value: number, metricName: string): string {
  const roundedValue = Math.round(value * 10) / 10;
  
  if (metricName.includes('Rate')) {
    return `${roundedValue}%`;
  } else if (metricName.includes('Session Duration') || metricName.includes('Duration')) {
    return `${roundedValue} min`;
  } else if (metricName.includes('Pages per Session') || metricName.includes('Sessions per User')) {
    return `${roundedValue}`;
  }
  
  return `${roundedValue}`;
}

/**
 * Convert raw metric values for processing (consolidates chartDataProcessor convertValue)
 * Handles percentage conversion and time unit conversion
 */
export function convertMetricValue(
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
 * Generate fallback values based on metric type (moved from chartDataProcessor.ts)
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
 * Determine if metric should be converted to percentage (moved from chartDataProcessor.ts)
 */
export function shouldConvertToPercentage(metricName: string): boolean {
  return metricName === 'Bounce Rate';
}

/**
 * Determine if metric should be converted to minutes (moved from chartDataProcessor.ts)
 */
export function shouldConvertToMinutes(metricName: string): boolean {
  return metricName === 'Session Duration';
}

/**
 * Generate deterministic seeded random number for consistent chart variations
 */
export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) / 2147483647; // Normalize to 0-1
}

/**
 * Generate temporal variation for chart data (authentic data only)
 */
export function generateTemporalVariationSync(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default'
): number[] {
  // Return empty array - authentic data only
  logger.warn(`No authentic temporal data available for ${metricName}`);
  return [];
}

/**
 * Calculate Y-axis domain for charts with proper scaling
 */
export function calculateYAxisDomain(data: any[], dataKey: string): [number, number] {
  if (!data || data.length === 0) return [0, 100];
  
  const values = data.map(item => item[dataKey]).filter(val => val != null && !isNaN(val));
  if (values.length === 0) return [0, 100];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1; // 10% padding
  
  return [Math.max(0, min - padding), max + padding];
}

/**
 * Generate chart colors for competitive analysis
 */
export function generateChartColors(competitors: any[]): Record<string, string> {
  const colors = [
    'hsl(var(--color-competitor-1))',
    'hsl(var(--color-competitor-2))', 
    'hsl(var(--color-competitor-3))',
    'hsl(var(--color-competitor-4))',
    'hsl(var(--color-competitor-5))'
  ];
  
  const result: Record<string, string> = {
    'Client': 'hsl(var(--color-client))',
    'CD_Avg': 'hsl(var(--color-cd-avg))',
    'Industry_Avg': 'hsl(var(--color-industry-avg))'
  };
  
  competitors.forEach((competitor, index) => {
    result[competitor.id] = colors[index % colors.length];
  });
  
  return result;
}

/**
 * Chart visibility state management
 * Consolidates visibility patterns from multiple chart components
 */
export function createChartVisibilityState(clientKey: string, companyName: string, competitors: any[]) {
  const initial: Record<string, boolean> = {
    [clientKey]: true,
    'Industry Avg': true,
    [`${companyName} Clients Avg`]: true,
  };
  
  competitors.forEach(comp => {
    initial[comp.label] = true;
  });
  
  return initial;
}

/**
 * Update chart visibility state when competitors change
 */
export function updateChartVisibilityForCompetitors(
  prevState: Record<string, boolean>, 
  competitors: any[]
): Record<string, boolean> {
  const updated = { ...prevState };
  competitors.forEach(comp => {
    if (!(comp.label in updated)) {
      updated[comp.label] = true; // Default new competitors to visible
    }
  });
  return updated;
}

/**
 * Chart data helper functions moved from chartDataHelpers.ts for consolidation
 */

/**
 * Deduplicate metrics by channel to avoid duplicate database entries
 */
export function deduplicateByChannel<T extends { channel?: string }>(
  metrics: T[]
): T[] {
  const channelMap = new Map<string, T>();
  metrics.forEach(metric => {
    const key = metric.channel || 'Other';
    if (!channelMap.has(key)) {
      channelMap.set(key, metric);
    }
  });
  return Array.from(channelMap.values());
}

/**
 * Format period display text for better UX (dynamic based on current date)
 */
export function formatPeriodDisplay(period: string): string {
  const now = new Date();
  
  if (period === "Last Month") {
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (period === "Last Quarter") {
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${currentQuarter} ${now.getFullYear()}`;
  } else if (period === "Last Year") {
    const yearEnd = new Date(now);
    yearEnd.setMonth(yearEnd.getMonth() - 1);
    const yearStart = new Date(yearEnd);
    yearStart.setFullYear(yearStart.getFullYear() - 1);
    return `${yearStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${yearEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }
  
  return period;
}

/**
 * Get default values for metrics when data is missing
 */
export function getDefaultMetricValue(metricName: string, sourceType: string): number {
  const defaults: Record<string, Record<string, number>> = {
    "Bounce Rate": {
      "Client": 38.2,
      "Industry_Avg": 45.8,
      "CD_Avg": 35.1
    },
    "Session Duration": {
      "Client": 245,
      "Industry_Avg": 180,
      "CD_Avg": 220
    },
    "Pages per Session": {
      "Client": 2.4,
      "Industry_Avg": 2.1,
      "CD_Avg": 2.3
    },
    "Sessions per User": {
      "Client": 1.8,
      "Industry_Avg": 1.5,
      "CD_Avg": 1.7
    }
  };
  
  return defaults[metricName]?.[sourceType] || 0;
}

/**
 * Check if a value represents a percentage
 */
export function isPercentageMetric(metricName: string): boolean {
  return metricName.toLowerCase().includes('rate') || 
         metricName.toLowerCase().includes('percentage');
}