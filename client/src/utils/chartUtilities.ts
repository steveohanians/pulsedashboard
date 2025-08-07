// Consolidated chart utilities to eliminate duplicate functions across chart components
// This eliminates seededRandom, generatePeriodLabel, and data generation patterns

import { seededRandom, seededRandomRange, seededVariance } from '@shared/seededRandom';
import { logger } from '@/utils/logger';

// Re-export shared seeded random functions for chart utilities
export { seededRandom, seededRandomRange, seededVariance };

/**
 * Generate period label from YYYY-MM format
 * Consolidates duplicate functions from bar-chart.tsx and time-series-chart.tsx
 */
export function generatePeriodLabel(period: string): string {
  // Handle grouped period format: YYYY-MM-group-N
  if (period.includes('-group-')) {
    const groupParts = period.split('-group-');
    if (groupParts.length === 2) {
      const [monthPart, groupNum] = groupParts;
      const [year, month] = monthPart.split('-');
      if (year && month) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const groupNumber = parseInt(groupNum);
        
        // Calculate approximate date range for the group (each group ~5-6 days)
        const groupSize = 5; // Average group size
        const startDay = (groupNumber - 1) * groupSize + 1;
        const endDay = Math.min(groupNumber * groupSize, 31);
        
        if (startDay === endDay) {
          return `${monthNames[parseInt(month) - 1]} ${startDay}`;
        } else {
          return `${monthNames[parseInt(month) - 1]} ${startDay}-${endDay}`;
        }
      }
    }
  }
  
  // Handle daily format: YYYY-MM-daily-YYYYMMDD
  if (period.includes('-daily-')) {
    const dailyDatePart = period.split('-daily-')[1]; // Get YYYYMMDD
    if (dailyDatePart && dailyDatePart.length === 8) {
      const year = dailyDatePart.substring(0, 4);
      const month = dailyDatePart.substring(4, 6);
      const day = dailyDatePart.substring(6, 8);
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
  
  // Handle YYYY-MM format (monthly data)
  const [year, month] = period.split('-');
  if (year && month) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const shortYear = year.slice(-2);
    return `${monthNames[parseInt(month) - 1]} ${shortYear}`;
  }
  
  return period; // fallback
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
      logger.debug(`No stored daily data found for ${metricName}, falling back to synthetic`);
      return [];
    }
    
    const dailyMetrics = await response.json();
    if (dailyMetrics.data && dailyMetrics.data.length > 0) {
      return dailyMetrics.data.map((metric: any) => parseFloat(metric.value));
    }
    
    return [];
    
  } catch (error) {
    logger.error('Error fetching stored daily metrics:', error);
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
  
  // REMOVED: No fallback to synthetic data - maintain data authenticity
  logger.warn(`No authentic data found for ${metricName}, returning empty array`);
  return [];
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
  // REMOVED: No synthetic data generation - return empty array for authentic data only
  logger.warn(`No authentic temporal data available for ${metricName}`);
  return [];
}

// REMOVED: All fallback data generators eliminated to maintain data authenticity
// System now shows empty states instead of synthetic data when authentic data unavailable

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
    [clientKey]: 'hsl(329, 86%, 54%)', // Primary brand color
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
  const channelSums = new Map();
  const channelCounts = new Map();
  
  sourceMetrics.forEach((metric, index) => {
    // Handle both individual channel records and legacy JSON format
    if (metric.channel) {
      // Individual channel record (new format)
      const channelName = metric.channel;
      const value = parseFloat(metric.value);
      
      if (channelSums.has(channelName)) {
        channelSums.set(channelName, channelSums.get(channelName) + value);
        channelCounts.set(channelName, channelCounts.get(channelName) + 1);
      } else {
        channelSums.set(channelName, value);
        channelCounts.set(channelName, 1);
      }
    } else if (metric.value && Array.isArray(metric.value)) {
      // GA4 data as direct array (new format)
      metric.value.forEach((channelData: any) => {
        // GA4 data structure: { channel: "Direct", percentage: 64.7, sessions: 4439 }
        if (channelData.channel && channelData.percentage !== undefined) {
          const channelName = channelData.channel;
          const value = parseFloat(channelData.percentage);
          
          if (channelSums.has(channelName)) {
            channelSums.set(channelName, channelSums.get(channelName) + value);
            channelCounts.set(channelName, channelCounts.get(channelName) + 1);
          } else {
            channelSums.set(channelName, value);
            channelCounts.set(channelName, 1);
          }
        }
      });
    } else if (metric.value && typeof metric.value === 'string') {
      // GA4 JSON format (legacy) - use correct field names
      try {
        const channelsData = JSON.parse(metric.value);
        if (Array.isArray(channelsData)) {
          channelsData.forEach((channelData: any) => {
            // GA4 data structure: { channel: "Direct", percentage: 64.7, sessions: 4439 }
            if (channelData.channel && channelData.percentage !== undefined) {
              const channelName = channelData.channel;
              const value = parseFloat(channelData.percentage);
              
              if (channelSums.has(channelName)) {
                channelSums.set(channelName, channelSums.get(channelName) + value);
                channelCounts.set(channelName, channelCounts.get(channelName) + 1);
              } else {
                channelSums.set(channelName, value);
                channelCounts.set(channelName, 1);
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
  
  // Calculate averages
  const channelMap = new Map();
  Array.from(channelSums.entries()).forEach(([channelName, sum]) => {
    const count = channelCounts.get(channelName) || 1;
    channelMap.set(channelName, sum / count);
  });
  
  return channelMap;
}

/**
 * Sort traffic channels by legend order for consistent display
 */
export function sortChannelsByLegendOrder(channelMap: Map<string, number>): Array<{name: string; value: number; percentage: number}> {
  // Define the preferred order to match legend display (left to right)
  const channelOrder = [
    'Organic Search',
    'Direct', 
    'Social Media',
    'Paid Search',
    'Email',
    'Referral',
    'Other'
  ];
  
  const sortedChannels: Array<{name: string; value: number; percentage: number}> = [];
  
  // Add channels in the preferred order
  channelOrder.forEach(channelName => {
    if (channelMap.has(channelName)) {
      const value = channelMap.get(channelName)!;
      sortedChannels.push({
        name: channelName,
        value: value,
        percentage: value // For traffic channels, value is already the percentage
      });
    }
  });
  
  // Add any channels that weren't in our predefined order (shouldn't happen with GA4 data)
  channelMap.forEach((value, channelName) => {
    if (!channelOrder.includes(channelName)) {
      sortedChannels.push({
        name: channelName,
        value: value,
        percentage: value
      });
    }
  });
  
  return sortedChannels;
}