import { seededRandom, seededRandomRange, seededVariance } from '@shared/seededRandom';
import { logger } from '@/utils/logger';

export { seededRandom, seededRandomRange, seededVariance };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function generatePeriodLabel(period: string): string {
  // Handle grouped period format: YYYY-MM-group-N
  if (period.includes('-group-')) {
    const groupParts = period.split('-group-');
    if (groupParts.length === 2) {
      const [monthPart, groupNum] = groupParts;
      const [year, month] = monthPart.split('-');
      if (year && month) {
        const groupNumber = parseInt(groupNum);
        const groupSize = 5;
        const startDay = (groupNumber - 1) * groupSize + 1;
        const endDay = Math.min(groupNumber * groupSize, 31);
        
        if (startDay === endDay) {
          return `${MONTH_NAMES[parseInt(month) - 1]} ${startDay}`;
        } else {
          return `${MONTH_NAMES[parseInt(month) - 1]} ${startDay}-${endDay}`;
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
  
  const [year, month] = period.split('-');
  if (year && month) {
    const shortYear = year.slice(-2);
    return `${MONTH_NAMES[parseInt(month) - 1]} ${shortYear}`;
  }
  
  return period; // fallback
}

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
    const targetMonth = new Date(ptYear, ptMonth - 1, 1);
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 5));
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (timePeriod === "Last Quarter") {
    const targetMonth = new Date(ptYear, ptMonth - 1, 1);
    const currentQuarter = Math.floor(targetMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    for (let i = 0; i < 3; i++) {
      const quarterMonth = quarterStartMonth + i;
      if (quarterMonth <= targetMonth.getMonth()) {
        const monthDate = new Date(targetMonth.getFullYear(), quarterMonth, 1);
        dates.push(`${MONTH_NAMES[quarterMonth]} ${String(targetMonth.getFullYear()).slice(-2)}`);
      }
    }
  } else if (timePeriod === "Last Year") {
    const targetMonth = new Date(ptYear, ptMonth - 1, 1);
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(targetMonth);
      monthDate.setMonth(targetMonth.getMonth() - i);
      dates.push(`${MONTH_NAMES[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`);
    }
  }
  
  return dates;
}

export async function fetchStoredDailyMetrics(
  clientId: string,
  period: string,
  metricName: string
): Promise<number[]> {
  try {
    const response = await fetch(`/api/metrics/daily/${clientId}/${period}/${encodeURIComponent(metricName)}`);
    
    if (!response.ok) {
      logger.debug(`No stored daily data found for ${metricName}`);
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

export async function generateTemporalVariation(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default',
  clientId?: string,
  period?: string
): Promise<number[]> {
  if (clientId && period && metricName) {
    const realData = await fetchStoredDailyMetrics(clientId, period, metricName);
    if (realData.length > 0) {
      logger.debug(`Using real GA4 daily data for ${metricName}: ${realData.length} days`);
      return realData.slice(0, dates.length);
    }
  }
  
  logger.warn(`No authentic data found for ${metricName}, returning empty array`);
  return [];
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
      updated[comp.label] = true; // Default new competitors to visible
    }
  });
  return updated;
}

export function generateChartColors(clientKey: string, competitors: any[]) {
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(329, 86%, 54%)',
    'Industry Avg': '#9ca3af',
    'Clear Digital Clients Avg': '#4b5563',
  };
  
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444'];
  
  competitors.forEach((comp, index) => {
    colors[comp.label] = competitorColors[index % competitorColors.length];
  });
  
  return colors;
}

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
  const padding = maxValue * 0.1;
  return [0, Math.ceil(maxValue + padding)];
}

export function aggregateChannelData(sourceMetrics: any[]): Map<string, number> {
  const channelSums = new Map();
  const channelCounts = new Map();
  
  sourceMetrics.forEach((metric, index) => {
    if (metric.channel) {
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
      metric.value.forEach((channelData: any) => {
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
      try {
        const channelsData = JSON.parse(metric.value);
        if (Array.isArray(channelsData)) {
          channelsData.forEach((channelData: any) => {
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
        logger.warn('Invalid JSON in metric value:', metric.value);
      }
    }
  });
  
  const channelMap = new Map();
  Array.from(channelSums.entries()).forEach(([channelName, sum]) => {
    const count = channelCounts.get(channelName) || 1;
    channelMap.set(channelName, sum / count);
  });
  
  return channelMap;
}

export function sortChannelsByLegendOrder(channelMap: Map<string, number>): Array<{name: string; value: number; percentage: number}> {
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
  
  channelOrder.forEach(channelName => {
    if (channelMap.has(channelName)) {
      const value = channelMap.get(channelName)!;
      sortedChannels.push({
        name: channelName,
        value: value,
        percentage: value
      });
    }
  });
  
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