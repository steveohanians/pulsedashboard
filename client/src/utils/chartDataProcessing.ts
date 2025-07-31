// Utility functions for processing chart data
// This file consolidates data processing logic for better maintainability

/**
 * Constants for chart colors and configurations
 */
export const CHART_COLORS = {
  TRAFFIC_CHANNELS: {
    'Organic Search': '#10b981',
    'Direct': '#3b82f6',
    'Social Media': '#8b5cf6',
    'Paid Search': '#f59e0b',
    'Email': '#ec4899',
    'Other': '#6b7280'
  },
  DEVICES: {
    'Desktop': '#3b82f6',
    'Mobile': '#10b981',
    'Tablet': '#8b5cf6',
    'Other': '#6b7280'
  }
} as const;

/**
 * Helper function to safely parse JSON values
 */
export function safeParseJSON(value: string): any[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
 * Format period display text for better UX
 */
export function formatPeriodDisplay(period: string): string {
  const periodMap: Record<string, string> = {
    "Last Month": "June 2025",
    "Last Quarter": "Q2 2025",
    "Last Year": "June 2024 - June 2025"
  };
  return periodMap[period] || period;
}

/**
 * Clean domain names for display (remove protocols and www)
 */
export function cleanDomainName(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
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

/**
 * Format metric values for display
 */
export function formatMetricValue(value: number, metricName: string): string {
  if (isPercentageMetric(metricName)) {
    return `${value.toFixed(1)}%`;
  }
  
  if (metricName === "Session Duration") {
    const minutes = Math.round((value / 60) * 10) / 10;
    return `${minutes} min`;
  }
  
  return value.toFixed(1);
}