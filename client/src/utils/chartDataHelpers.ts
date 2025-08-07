// Helper utilities for chart data processing
// This file contains supporting utilities for chart data manipulation

// Chart colors available from @/constants/chart-colors

/**
 * Helper function to safely parse JSON values
 */
export function safeParseJSON(value: string): unknown[] {
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