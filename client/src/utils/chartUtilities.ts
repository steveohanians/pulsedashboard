// Consolidated chart utilities to eliminate duplicate functions across chart components
// This eliminates seededRandom, generatePeriodLabel, and data generation patterns

import { seededRandom as sharedSeededRandom } from '@shared/seededRandom';
import { logger } from '@/utils/logger';

/**
 * Seeded random number generator for consistent chart data
 * Consolidates duplicate functions from bar-chart.tsx and area-chart.tsx
 */
export function seededRandom(seed: number): number {
  // Use the Math.sin approach for frontend compatibility (matches existing pattern)
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate period label from YYYY-MM format
 * Consolidates duplicate functions from bar-chart.tsx and time-series-chart.tsx
 */
export function generatePeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortYear = year.slice(-2);
  return `${monthNames[parseInt(month) - 1]} ${shortYear}`;
}

/**
 * Generate Pacific Time date periods for charts
 * Consolidates duplicate PT calculation logic from multiple chart components
 */
export function generatePacificTimePeriods(timePeriod: string) {
  const now = new Date();
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  });
  const ptParts = ptFormatter.formatToParts(now);
  const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed

  const dates: string[] = [];
  
  if (timePeriod === "Last Month") {
    // Show last month data points (dynamic based on PT current date - 1 month)
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 5)); // Every 5 days
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (timePeriod === "Last Quarter") {
    // Show current quarter months (dynamic PT)
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    const currentQuarter = Math.floor(targetMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    for (let i = 0; i < 3; i++) {
      const quarterMonth = quarterStartMonth + i;
      if (quarterMonth <= targetMonth.getMonth()) {
        const monthDate = new Date(targetMonth.getFullYear(), quarterMonth, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dates.push(`${monthNames[quarterMonth]} ${String(targetMonth.getFullYear()).slice(-2)}`);
      }
    }
  } else if (timePeriod === "Last Year") {
    // Show 12 months ending with PT target month (dynamic)
    const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(targetMonth);
      monthDate.setMonth(targetMonth.getMonth() - i);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dates.push(`${monthNames[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`);
    }
  }
  
  return dates;
}

/**
 * Fetch stored daily GA4 metrics for time series charts
 * Retrieves real daily data from the database
 */
export async function fetchStoredDailyMetrics(
  clientId: string,
  period: string,
  metricName: string
): Promise<number[]> {
  try {
    // Get the daily metrics from our stored cache
    const response = await fetch(`/api/metrics/daily/${clientId}/${period}/${encodeURIComponent(metricName)}`);
    
    if (!response.ok) {
      console.debug(`No stored daily data found for ${metricName}, falling back to synthetic`);
      return [];
    }
    
    const dailyMetrics = await response.json();
    if (dailyMetrics.data && dailyMetrics.data.length > 0) {
      return dailyMetrics.data.map((metric: any) => parseFloat(metric.value));
    }
    
    return [];
    
  } catch (error) {
    console.error('Error fetching stored daily metrics:', error);
    return [];
  }
}

/**
 * Generate temporal variation using real GA4 data when available
 * Falls back to synthetic data when real data is not available
 */
export async function generateTemporalVariation(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default',
  clientId?: string,
  period?: string
): Promise<number[]> {
  // Try to fetch real daily data if client info is provided
  if (clientId && period && metricName) {
    const realData = await fetchStoredDailyMetrics(clientId, period, metricName);
    if (realData.length > 0) {
      logger.debug(`Using real GA4 daily data for ${metricName}: ${realData.length} days`);
      // Ensure we have the right number of data points for our dates
      return realData.slice(0, dates.length);
    }
  }
  
  // Fallback to synthetic variation
  return generateTemporalVariationFallback(baseValue, dates, metricName, seed);
}

/**
 * Synchronous version for backwards compatibility
 */
export function generateTemporalVariationSync(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default'
): number[] {
  return generateTemporalVariationFallback(baseValue, dates, metricName, seed);
}

/**
 * Fallback temporal variation generator (when GA4 data unavailable)
 * Simplified version of the original synthetic generator
 */
function generateTemporalVariationFallback(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default'
): number[] {
  const variations: number[] = [];
  let seededRandom = createSeededRandom(seed);
  
  const variationRange = 0.10; // 10% variation as fallback
  
  dates.forEach((date, index) => {
    const randomFactor = (seededRandom() - 0.5) * 2;
    let dailyVariation = baseValue * (1 + randomFactor * variationRange);
    
    dailyVariation = Math.max(dailyVariation, baseValue * 0.8);
    dailyVariation = Math.min(dailyVariation, baseValue * 1.2);
    
    variations.push(Math.round(dailyVariation * 100) / 100);
  });
  
  return variations;
}

/**
 * Create seeded random number generator for deterministic variations
 */
function createSeededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return function() {
    hash = ((hash * 1664525) + 1013904223) % Math.pow(2, 32);
    return Math.abs(hash) / Math.pow(2, 32);
  };
}

/**
 * Chart visibility state management hook pattern
 * Consolidates the visibleLines/visibleBars pattern from time-series-chart.tsx and bar-chart.tsx
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
 * Consolidates the useEffect pattern from multiple chart components
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
 * Generate chart colors for competitors
 * Consolidates color assignment patterns from chart components
 */
export function generateChartColors(clientKey: string, competitors: any[]) {
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(318, 97%, 50%)', // Primary pink color
    'Industry Avg': '#9ca3af', // Light grey
    'Clear Digital Clients Avg': '#4b5563', // Dark grey
  };
  
  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red
  
  competitors.forEach((comp, index) => {
    colors[comp.label] = competitorColors[index % competitorColors.length];
  });
  
  return colors;
}

/**
 * Calculate optimized Y-axis domain for charts
 * Consolidates Y-axis calculation logic from chart components
 */
export function calculateYAxisDomain(data: any[], clientKey: string, competitors: any[], companyName: string = 'Clear Digital'): [number, number] {
  const allValues: number[] = [];
  
  data.forEach(point => {
    allValues.push(point[clientKey], point['Industry Avg'], point[`${companyName} Clients Avg`]);
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(point[comp.label]);
      }
    });
  });
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  
  // Always start from 0 for better visual context and comparison
  const padding = maxValue * 0.1; // 10% padding from top
  return [0, Math.ceil(maxValue + padding)];
}

/**
 * Channel data aggregation helper
 * Consolidates channel aggregation logic from dashboard.tsx and time-series-chart.tsx
 */
export function aggregateChannelData(sourceMetrics: any[]): Map<string, number> {
  const channelMap = new Map();
  
  sourceMetrics.forEach(metric => {
    // Handle both individual channel records and legacy JSON format
    if (metric.channel) {
      // Individual channel record (new format)
      const channelName = metric.channel;
      const value = parseFloat(metric.value);
      
      if (channelMap.has(channelName)) {
        channelMap.set(channelName, channelMap.get(channelName) + value);
      } else {
        channelMap.set(channelName, value);
      }
    } else if (metric.value && typeof metric.value === 'string') {
      // Legacy JSON format
      try {
        const channelsData = JSON.parse(metric.value);
        if (Array.isArray(channelsData)) {
          channelsData.forEach(channel => {
            if (channel.name && channel.value !== undefined) {
              const channelName = channel.name;
              const value = parseFloat(channel.value);
              
              if (channelMap.has(channelName)) {
                channelMap.set(channelName, channelMap.get(channelName) + value);
              } else {
                channelMap.set(channelName, value);
              }
            }
          });
        }
      } catch (e) {
        // Fallback for invalid JSON - skip this metric
        logger.warn('Invalid JSON in metric value:', metric.value);
      }
    }
  });
  
  return channelMap;
}