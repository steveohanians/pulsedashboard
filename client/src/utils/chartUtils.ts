import { logger } from '@/utils/logger';

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

export const CHART_COLORS = {
  Client: 'hsl(var(--color-client))',
  CD_Avg: 'hsl(var(--color-cd-avg))',
  Industry_Avg: 'hsl(var(--color-industry-avg))',
  Industry: 'hsl(var(--color-industry-avg))',
  Competitor: 'hsl(var(--color-competitor-1))',
  Desktop: 'hsl(var(--color-device-desktop))',
  Mobile: 'hsl(var(--color-device-mobile))',
  Tablet: 'hsl(var(--color-device-tablet))',
  Other: 'hsl(var(--color-device-other))',
  'Organic Search': 'hsl(var(--color-competitor-1))',
  'Direct': 'hsl(var(--color-client))', 
  'Social Media': 'hsl(var(--color-competitor-1))',
  'Paid Search': 'hsl(var(--chart-3))',
  'Email': 'hsl(var(--chart-5))',
  'Referral': '#E67E22',
  Default: 'hsl(var(--color-default))'
};

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

export function convertMetricValue(
  rawValue: number, 
  options: { convertToPercentage?: boolean; convertToMinutes?: boolean }
): number {
  if (options.convertToPercentage) {
    return rawValue * 100;
  }
  if (options.convertToMinutes) {
    return rawValue / 60;
  }
  return rawValue;
}

export function shouldConvertToPercentage(metricName: string): boolean {
  return metricName === 'Bounce Rate';
}

export function shouldConvertToMinutes(metricName: string): boolean {
  return metricName === 'Session Duration';
}

export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

export function generateTemporalVariationSync(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default'
): number[] {
  logger.warn(`No authentic temporal data available for ${metricName}`);
  return [];
}

export function calculateYAxisDomain(data: any[], dataKey: string): [number, number] {
  if (!data || data.length === 0) return [0, 100];
  
  const values = data.map(item => item[dataKey]).filter(val => val != null && !isNaN(val));
  if (values.length === 0) return [0, 100];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1;
  
  return [Math.max(0, min - padding), max + padding];
}

/**
 * Unified Color Management System for Chart Components
 * 
 * Provides centralized color assignment for all chart types while allowing
 * each chart to maintain its own palette. Ensures consistent colors for
 * shared series across different chart implementations.
 */

// Base entity colors used across multiple charts
const BASE_ENTITY_COLORS = {
  client: 'hsl(var(--color-client))',
  cdAvg: 'hsl(var(--color-cd-avg))',
  industryAvg: 'hsl(var(--color-industry-avg))',
  competitor1: 'hsl(var(--color-competitor-1))',
  competitor2: 'hsl(var(--color-competitor-2))',
  competitor3: 'hsl(var(--color-competitor-3))',
} as const;

// Traffic channel specific colors for StackedBarChart
const TRAFFIC_CHANNEL_COLORS = {
  'Direct': 'hsl(var(--color-channel-direct))',
  'Organic Search': 'hsl(var(--color-channel-organic))',
  'Social Media': 'hsl(var(--color-channel-social))',
  'Paid Search': 'hsl(var(--color-channel-paid))',
  'Email': 'hsl(var(--color-channel-email))',
  'Referral': 'hsl(var(--color-channel-referral))',
  'Other': 'hsl(var(--color-channel-other))',
} as const;

// Device specific colors for LollipopChart
const DEVICE_COLORS = {
  'Desktop': 'hsl(var(--color-device-desktop))',
  'Mobile': 'hsl(var(--color-device-mobile))',
} as const;

/**
 * Get unified colors for time-series based charts (TimeSeriesChart, AreaChart, BarChart)
 */
export function getTimeSeriesColors(clientKey: string, competitors: any[], companyName?: string): Record<string, string> {
  const colors: Record<string, string> = {
    [clientKey]: BASE_ENTITY_COLORS.client,
    'Industry Avg': BASE_ENTITY_COLORS.industryAvg,
    'Clear Digital Clients Avg': BASE_ENTITY_COLORS.cdAvg,
  };
  
  // Add company-specific CD average if company name provided
  if (companyName) {
    colors[`${companyName} Clients Avg`] = BASE_ENTITY_COLORS.cdAvg;
  }
  
  // Add competitor colors
  const competitorColors = [
    BASE_ENTITY_COLORS.competitor1,
    BASE_ENTITY_COLORS.competitor2,
    BASE_ENTITY_COLORS.competitor3,
  ];
  
  competitors.forEach((competitor, index) => {
    colors[competitor.label] = competitorColors[index % competitorColors.length];
  });
  
  return colors;
}

/**
 * Get colors for traffic channel chart (StackedBarChart)
 */
export function getTrafficChannelColors(): Record<string, string> {
  return { ...TRAFFIC_CHANNEL_COLORS };
}

/**
 * Get colors for device distribution chart (LollipopChart)
 */
export function getDeviceColors(): Record<string, string> {
  return { ...DEVICE_COLORS };
}

/**
 * Get colors for metrics chart (MetricsChart) - maintains existing CHART_COLORS behavior
 */
export function getMetricsColors(): Record<string, string> {
  return { ...CHART_COLORS };
}

/**
 * Get competitor colors array for gradient definitions and similar uses
 */
export function getCompetitorColorsArray(): string[] {
  return [
    BASE_ENTITY_COLORS.competitor1,
    BASE_ENTITY_COLORS.competitor2,
    BASE_ENTITY_COLORS.competitor3,
  ];
}

// Legacy function maintained for compatibility
export function generateChartColors(competitors: any[]): Record<string, string> {
  const colors = [
    BASE_ENTITY_COLORS.competitor1,
    BASE_ENTITY_COLORS.competitor2,
    BASE_ENTITY_COLORS.competitor3,
  ];
  
  const result: Record<string, string> = {
    'Client': BASE_ENTITY_COLORS.client,
    'CD_Avg': BASE_ENTITY_COLORS.cdAvg,
    'Industry_Avg': BASE_ENTITY_COLORS.industryAvg,
  };
  
  competitors.forEach((competitor, index) => {
    result[competitor.id] = colors[index % colors.length];
  });
  
  return result;
}

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

export function updateChartVisibilityForCompetitors(
  prevState: Record<string, boolean>, 
  competitors: any[]
): Record<string, boolean> {
  const updated = { ...prevState };
  competitors.forEach(comp => {
    if (!(comp.label in updated)) {
      updated[comp.label] = true;
    }
  });
  return updated;
}

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

export function isPercentageMetric(metricName: string): boolean {
  return metricName.toLowerCase().includes('rate') || 
         metricName.toLowerCase().includes('percentage');
}