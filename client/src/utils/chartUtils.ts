import { logger } from '@/utils/logger';

// Static fallback palette for when CSS variables are missing
const FALLBACK_PALETTE = {
  'hsl(var(--color-client))': '#3B82F6',        // Blue
  'hsl(var(--color-cd-avg))': '#10B981',        // Green 
  'hsl(var(--color-industry-avg))': '#6B7280',  // Grey
  'hsl(var(--color-competitor-1))': '#EF4444',  // Red
  'hsl(var(--color-competitor-2))': '#8B5CF6',  // Purple
  'hsl(var(--color-competitor-3))': '#EC4899',  // Pink
  'hsl(var(--color-device-desktop))': '#6366F1', // Indigo
  'hsl(var(--color-device-mobile))': '#06B6D4',  // Cyan
  'hsl(var(--color-device-tablet))': '#84CC16',  // Lime
  'hsl(var(--color-device-other))': '#64748B',   // Slate
  'hsl(var(--color-channel-direct))': '#3B82F6',
  'hsl(var(--color-channel-organic))': '#10B981',
  'hsl(var(--color-channel-social))': '#F59E0B',
  'hsl(var(--color-channel-paid))': '#EF4444',
  'hsl(var(--color-channel-email))': '#8B5CF6',
  'hsl(var(--color-channel-referral))': '#EC4899',
  'hsl(var(--color-channel-other))': '#64748B',
  'hsl(var(--color-default))': '#6B7280',
  'hsl(var(--chart-3))': '#FBBF24',
  'hsl(var(--chart-5))': '#A78BFA'
} as const;

// Track if CSS warning has been logged to avoid spam
let cssVariableWarningLogged = false;

/**
 * Validates CSS variable availability and provides fallback colors
 */
function validateAndGetColor(cssVarColor: string): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return FALLBACK_PALETTE[cssVarColor as keyof typeof FALLBACK_PALETTE] || '#6B7280';
  }

  // Test if CSS variable resolves to actual color
  const testElement = document.createElement('div');
  testElement.style.color = cssVarColor;
  document.body.appendChild(testElement);
  const computedColor = window.getComputedStyle(testElement).color;
  document.body.removeChild(testElement);

  // If CSS variable is missing, use fallback and log warning once
  if (!computedColor || computedColor === '' || computedColor === 'rgba(0, 0, 0, 0)') {
    if (!cssVariableWarningLogged) {
      logger.warn('Chart CSS variables missing, using fallback colors', { 
        missingVariable: cssVarColor,
        fallbackUsed: true 
      });
      cssVariableWarningLogged = true;
    }
    return FALLBACK_PALETTE[cssVarColor as keyof typeof FALLBACK_PALETTE] || '#6B7280';
  }

  return cssVarColor;
}

/**
 * Normalizes chart data to handle null, undefined, and sparse values
 */
export function normalizeChartData<T extends Record<string, any>>(
  data: T[], 
  options: {
    gapOnNull?: boolean;      // For line charts - allow gaps
    defaultValue?: number;    // For bar charts - default to 0 
    requiredKeys?: string[];  // Keys that must be present
  } = {}
): T[] {
  if (!Array.isArray(data) || data.length === 0) {
    logger.warn('Chart data normalization: empty or invalid data array');
    return [];
  }

  const { gapOnNull = false, defaultValue = 0, requiredKeys = [] } = options;

  return data
    .filter(item => item != null && typeof item === 'object')
    .map(item => {
      const normalizedItem = { ...item };
      
      // Handle required keys
      requiredKeys.forEach(key => {
        if (!(key in normalizedItem)) {
          (normalizedItem as any)[key] = defaultValue;
        }
      });

      // Handle null/undefined values in numeric fields
      Object.keys(normalizedItem).forEach(key => {
        const value = normalizedItem[key];
        
        if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
          (normalizedItem as any)[key] = gapOnNull ? null : defaultValue;
        } else if (value == null) {
          (normalizedItem as any)[key] = gapOnNull ? null : defaultValue;
        } else if (typeof value === 'string' && value.trim() === '') {
          (normalizedItem as any)[key] = gapOnNull ? null : defaultValue;
        }
      });

      return normalizedItem;
    })
    .filter(item => {
      // Remove completely empty data points unless gapOnNull is enabled
      if (gapOnNull) return true;
      
      const hasValidData = Object.values(item).some(value => 
        value != null && value !== '' && !isNaN(Number(value))
      );
      return hasValidData;
    });
}

/**
 * Safely extracts numeric values from chart data with fallback
 */
export function safeNumericValue(
  value: any, 
  fallback: number = 0,
  options: { allowNull?: boolean } = {}
): number | null {
  const { allowNull = false } = options;
  
  if (value == null) {
    return allowNull ? null : fallback;
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    return allowNull ? null : fallback;
  }
  
  return numValue;
}

/**
 * Guards tooltip rendering against empty data arrays
 */
export function safeTooltipProps(data: any[]): { active?: boolean } {
  if (!Array.isArray(data) || data.length === 0) {
    return { active: false };
  }
  return {};
}

/**
 * Guards brush component against empty data arrays
 */
export function safeBrushProps(data: any[]): { 
  dataKey?: string; 
  startIndex?: number; 
  endIndex?: number;
} {
  if (!Array.isArray(data) || data.length === 0) {
    return {};
  }
  
  return {
    startIndex: 0,
    endIndex: Math.min(data.length - 1, 10) // Show last 10 points by default
  };
}

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
  Client: () => validateAndGetColor('hsl(var(--color-client))'),
  CD_Avg: () => validateAndGetColor('hsl(var(--color-cd-avg))'),
  Industry_Avg: () => validateAndGetColor('hsl(var(--color-industry-avg))'),
  Industry: () => validateAndGetColor('hsl(var(--color-industry-avg))'),
  Competitor: () => validateAndGetColor('hsl(var(--color-competitor-1))'),
  Desktop: () => validateAndGetColor('hsl(var(--color-device-desktop))'),
  Mobile: () => validateAndGetColor('hsl(var(--color-device-mobile))'),
  Tablet: () => validateAndGetColor('hsl(var(--color-device-tablet))'),
  Other: () => validateAndGetColor('hsl(var(--color-device-other))'),
  'Organic Search': () => validateAndGetColor('hsl(var(--color-competitor-1))'),
  'Direct': () => validateAndGetColor('hsl(var(--color-client))'), 
  'Social Media': () => validateAndGetColor('hsl(var(--color-competitor-1))'),
  'Paid Search': () => validateAndGetColor('hsl(var(--chart-3))'),
  'Email': () => validateAndGetColor('hsl(var(--chart-5))'),
  'Referral': () => '#E67E22', // Static color, no CSS var
  Default: () => validateAndGetColor('hsl(var(--color-default))')
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

// Base entity colors used across multiple charts with CSS variable validation
const BASE_ENTITY_COLORS = {
  client: () => validateAndGetColor('hsl(var(--color-client))'),
  cdAvg: () => validateAndGetColor('hsl(var(--color-cd-avg))'),
  industryAvg: () => validateAndGetColor('hsl(var(--color-industry-avg))'),
  competitor1: () => validateAndGetColor('hsl(var(--color-competitor-1))'),
  competitor2: () => validateAndGetColor('hsl(var(--color-competitor-2))'),
  competitor3: () => validateAndGetColor('hsl(var(--color-competitor-3))'),
} as const;

// Traffic channel specific colors for StackedBarChart with validation
const TRAFFIC_CHANNEL_COLORS = {
  'Direct': () => validateAndGetColor('hsl(var(--color-channel-direct))'),
  'Organic Search': () => validateAndGetColor('hsl(var(--color-channel-organic))'),
  'Social Media': () => validateAndGetColor('hsl(var(--color-channel-social))'),
  'Paid Search': () => validateAndGetColor('hsl(var(--color-channel-paid))'),
  'Email': () => validateAndGetColor('hsl(var(--color-channel-email))'),
  'Referral': () => validateAndGetColor('hsl(var(--color-channel-referral))'),
  'Other': () => validateAndGetColor('hsl(var(--color-channel-other))'),
} as const;

// Device specific colors for LollipopChart with validation
const DEVICE_COLORS = {
  'Desktop': () => validateAndGetColor('hsl(var(--color-device-desktop))'),
  'Mobile': () => validateAndGetColor('hsl(var(--color-device-mobile))'),
} as const;

/**
 * Get unified colors for time-series based charts (TimeSeriesChart, AreaChart, BarChart)
 */
export function getTimeSeriesColors(clientKey: string, competitors: any[], companyName?: string): Record<string, string> {
  const colors: Record<string, string> = {
    [clientKey]: BASE_ENTITY_COLORS.client(),
    'Industry Avg': BASE_ENTITY_COLORS.industryAvg(),
    'Clear Digital Clients Avg': BASE_ENTITY_COLORS.cdAvg(),
  };
  
  // Add company-specific CD average if company name provided
  if (companyName) {
    colors[`${companyName} Clients Avg`] = BASE_ENTITY_COLORS.cdAvg();
  }
  
  // Add competitor colors with validation
  const competitorColors = [
    BASE_ENTITY_COLORS.competitor1(),
    BASE_ENTITY_COLORS.competitor2(),
    BASE_ENTITY_COLORS.competitor3(),
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
  const result: Record<string, string> = {};
  for (const [key, getColor] of Object.entries(TRAFFIC_CHANNEL_COLORS)) {
    result[key] = getColor();
  }
  return result;
}

/**
 * Get colors for device distribution chart (LollipopChart)
 */
export function getDeviceColors(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, getColor] of Object.entries(DEVICE_COLORS)) {
    result[key] = getColor();
  }
  return result;
}

/**
 * Get colors for metrics chart (MetricsChart) - maintains existing CHART_COLORS behavior
 */
export function getMetricsColors(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, getColor] of Object.entries(CHART_COLORS)) {
    result[key] = getColor();
  }
  return result;
}

/**
 * Get competitor colors array for gradient definitions and similar uses
 */
export function getCompetitorColorsArray(): string[] {
  return [
    BASE_ENTITY_COLORS.competitor1(),
    BASE_ENTITY_COLORS.competitor2(),
    BASE_ENTITY_COLORS.competitor3(),
  ];
}

// Legacy function maintained for compatibility
export function generateChartColors(competitors: any[]): Record<string, string> {
  const colors = [
    BASE_ENTITY_COLORS.competitor1(),
    BASE_ENTITY_COLORS.competitor2(),
    BASE_ENTITY_COLORS.competitor3(),
  ];
  
  const result: Record<string, string> = {
    'Client': BASE_ENTITY_COLORS.client(),
    'CD_Avg': BASE_ENTITY_COLORS.cdAvg(),
    'Industry_Avg': BASE_ENTITY_COLORS.industryAvg(),
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