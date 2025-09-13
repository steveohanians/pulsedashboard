/**
 * Business-friendly data transformation utility for portfolio company data
 * Converts raw technical metrics into organized business insights
 */

export interface BusinessMetric {
  name: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
  description?: string;
  category: string;
  period?: string;
  isFromFallbackPeriod?: boolean;
}

export interface CategoryPeriodInfo {
  period: string;
  metricsCount: number;
  totalPossibleMetrics: number;
  completenessPercentage: number;
  isOptimal: boolean;
  fallbackReason?: string;
}

export interface CategoryCoverage {
  engagementMetrics: CategoryPeriodInfo;
  trafficSources: CategoryPeriodInfo;
  userBehavior: CategoryPeriodInfo;
  engagement: CategoryPeriodInfo;
  technical: CategoryPeriodInfo;
}

export interface DataCoverage {
  totalPeriods: number;
  periodsWithData: number;
  coveragePercentage: number;
  timeRange: {
    earliest: string;
    latest: string;
    spanMonths: number;
  };
  missingPeriods: string[];
  availablePeriods: string[];
  dataCompleteness: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
  gapAnalysis: {
    hasGaps: boolean;
    longestGap: number; // in months
    recentDataAvailable: boolean;
  };
  categoryAnalysis: CategoryCoverage;
  mixedPeriodWarning: {
    hasMixedPeriods: boolean;
    affectedCategories: string[];
    message?: string;
  };
}

export interface CategoryWithPeriod {
  name: string;
  displayName: string;
  period: string;
  periods: string[]; // List of all available periods for this category
  icon: string;
  metrics: BusinessMetric[];
}

export interface BusinessInsights {
  overview: {
    dataAvailability: string;
    lastUpdated: string;
    totalMetrics: number;
  };
  categories: {
    engagementMetrics: CategoryWithPeriod;
    trafficSources: CategoryWithPeriod;
    userBehavior: CategoryWithPeriod;
    engagement: CategoryWithPeriod;
    technical: CategoryWithPeriod;
  };
  // Simplified legacy support - no complex analysis
  engagementMetrics: BusinessMetric[];
  trafficSources: BusinessMetric[];
  userBehavior: BusinessMetric[];
  engagement: BusinessMetric[];
  technical: BusinessMetric[];
}

/**
 * Formats numeric values with appropriate units and decimal places
 */
function formatMetricValue(value: any, metricName: string): string {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = typeof value === 'object' ? (value.value ?? value.source ?? 0) : Number(value);
  
  if (isNaN(numValue)) return String(value);
  
  // Handle percentage metrics with SEMrush-specific formatting
  if (metricName.toLowerCase().includes('rate') || 
      metricName.toLowerCase().includes('percentage') ||
      metricName.toLowerCase().includes('bounce')) {
    
    // Bounce Rate is always stored as decimal (0-1) from SEMrush, needs conversion
    if (metricName.toLowerCase().includes('bounce')) {
      return `${(numValue * 100).toFixed(1)}%`;
    }
    
    // Traffic Channels and Device Distribution percentages are already formatted
    // from SEMrush (e.g., 58.5, 72.1), just add % symbol
    if (metricName.toLowerCase().includes('traffic') || 
        metricName.toLowerCase().includes('device') ||
        metricName.toLowerCase().includes('channel')) {
      return `${numValue.toFixed(1)}%`;
    }
    
    // For other percentage metrics, use the original logic as fallback
    if (numValue > 1) {
      return `${numValue.toFixed(1)}%`;
    }
    return `${(numValue * 100).toFixed(1)}%`;
  }
  
  // Handle time-based metrics (session duration)
  if (metricName.toLowerCase().includes('duration') || 
      metricName.toLowerCase().includes('time')) {
    // Assume value is in seconds, convert to minutes:seconds
    const minutes = Math.floor(numValue / 60);
    const seconds = Math.floor(numValue % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Handle large numbers with K/M notation
  if (numValue >= 1000000) {
    return `${(numValue / 1000000).toFixed(1)}M`;
  } else if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(1)}K`;
  }
  
  // Default formatting with up to 2 decimal places
  return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2);
}

/**
 * Categorizes metrics into business-friendly groups
 */
function categorizeMetric(metricName: string): string {
  const name = metricName.toLowerCase();
  
  // Engagement performance metrics (bounce rate, speed, load times)
  if (name.includes('bounce') || name.includes('load') || name.includes('speed') || name.includes('performance')) {
    return 'engagementMetrics';
  }
  
  // Traffic source metrics
  if (name.includes('source') || name.includes('channel') || name.includes('organic') || 
      name.includes('direct') || name.includes('referral') || name.includes('social')) {
    return 'trafficSources';
  }
  
  // User behavior metrics (session patterns, pages, device usage)
  if (name.includes('pagespersession') || name.includes('pages per session') ||
      name.includes('sessionduration') || name.includes('session duration') ||
      name.includes('sessionsperuser') || name.includes('sessions per user') ||
      name.includes('device') || name.includes('visit')) {
    return 'userBehavior';
  }
  
  // General session/page/user metrics that don't fit above categories
  if (name.includes('session') || name.includes('page') || name.includes('user') || 
      name.includes('duration')) {
    return 'userBehavior';
  }
  
  // Conversion and engagement action metrics
  if (name.includes('conversion') || name.includes('click') || name.includes('ctr') || 
      name.includes('engagement') || name.includes('goal')) {
    return 'engagement';
  }
  
  return 'technical';
}

/**
 * Gets user-friendly metric name
 */
function getFriendlyMetricName(metricName: string): string {
  const nameMap: Record<string, string> = {
    'bounceRate': 'Bounce Rate',
    'sessionDuration': 'Average Session Duration',
    'pagesPerSession': 'Pages per Session',
    'sessionsPerUser': 'Sessions per User',
    'organicTraffic': 'Organic Search Traffic',
    'directTraffic': 'Direct Traffic',
    'referralTraffic': 'Referral Traffic',
    'socialTraffic': 'Social Media Traffic',
    'conversionRate': 'Conversion Rate',
    'clickThroughRate': 'Click-Through Rate',
    'pageLoadTime': 'Page Load Time',
    'coreWebVitals': 'Core Web Vitals Score'
  };
  
  return nameMap[metricName] || metricName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

/**
 * Gets value from a specific period, or the most recent if no period specified
 */
function getMetricValue(timePeriods: Record<string, any[]>, preferredPeriod?: string): { value: any; period: string; isFromFallback?: boolean } | null {
  // If preferred period is specified and has data, use it
  if (preferredPeriod && timePeriods[preferredPeriod] && timePeriods[preferredPeriod].length > 0) {
    const metrics = timePeriods[preferredPeriod];
    return {
      value: metrics[metrics.length - 1].value,
      period: preferredPeriod,
      isFromFallback: false
    };
  }
  
  // Otherwise, fall back to the most recent available period
  const sortedPeriods = Object.keys(timePeriods).sort((a, b) => b.localeCompare(a));
  
  for (const period of sortedPeriods) {
    const metrics = timePeriods[period];
    if (metrics && metrics.length > 0) {
      const latestMetric = metrics[metrics.length - 1];
      return {
        value: latestMetric.value,
        period,
        isFromFallback: preferredPeriod !== undefined && period !== preferredPeriod
      };
    }
  }
  
  return null;
}

/**
 * Legacy function maintained for backward compatibility
 */
function getLatestMetricValue(timePeriods: Record<string, any[]>): { value: any; period: string } | null {
  const result = getMetricValue(timePeriods);
  return result ? { value: result.value, period: result.period } : null;
}

/**
 * Generates contextual descriptions for individual metrics based on available data and metric type
 */
function generateMetricDescription(rawData: any, metricName: string, metricValue: any, period: string, category: string): string {
  // For engagement metrics, try to add context based on sessions data
  if (category === 'engagementMetrics') {
    const sessionsData = rawData?.metrics?.['Sessions']?.[period];
    if (sessionsData && sessionsData.length > 0) {
      const sessions = sessionsData[sessionsData.length - 1].value;
      const formattedSessions = formatNumber(typeof sessions === 'object' ? (sessions.value ?? sessions.source ?? 0) : Number(sessions));
      
      if (metricName.toLowerCase().includes('bounce')) {
        return `Across ${formattedSessions} sessions from ${period}`;
      } else if (metricName.toLowerCase().includes('duration')) {
        return `Average across ${formattedSessions} sessions from ${period}`;
      } else if (metricName.toLowerCase().includes('pages per session')) {
        return `Navigation depth across ${formattedSessions} sessions from ${period}`;
      } else if (metricName.toLowerCase().includes('sessions per user')) {
        return `User engagement pattern from ${period}`;
      }
    }
  }
  
  // For user behavior metrics, try to add context
  if (category === 'userBehavior') {
    const sessionsData = rawData?.metrics?.['Sessions']?.[period];
    if (sessionsData && sessionsData.length > 0) {
      const sessions = sessionsData[sessionsData.length - 1].value;
      const formattedSessions = formatNumber(typeof sessions === 'object' ? (sessions.value ?? sessions.source ?? 0) : Number(sessions));
      return `Based on ${formattedSessions} user sessions from ${period}`;
    }
  }
  
  // For engagement metrics (conversion-related), try to add context
  if (category === 'engagement') {
    const sessionsData = rawData?.metrics?.['Sessions']?.[period];
    if (sessionsData && sessionsData.length > 0) {
      const sessions = sessionsData[sessionsData.length - 1].value;
      const formattedSessions = formatNumber(typeof sessions === 'object' ? (sessions.value ?? sessions.source ?? 0) : Number(sessions));
      
      if (metricName.toLowerCase().includes('conversion')) {
        return `Conversion performance across ${formattedSessions} sessions from ${period}`;
      } else if (metricName.toLowerCase().includes('click')) {
        return `Click performance across ${formattedSessions} sessions from ${period}`;
      }
    }
  }
  
  // For technical metrics, provide general context
  if (category === 'technical') {
    return `Technical performance metric from ${period}`;
  }
  
  // Default fallback with just period info
  return `from ${period}`;
}

/**
 * Aggregates channel-based metrics (traffic channels, device distribution) into human-readable summaries
 */
function aggregateChannelMetrics(timePeriods: Record<string, any[]>, metricType: 'traffic' | 'device', preferredPeriod?: string): BusinessMetric[] {
  const results: BusinessMetric[] = [];
  
  let usedPeriod = '';
  let channelData: Array<{ channel: string; percentage: number; sessions: number }> = [];
  let isFromFallback = false;
  
  // Try preferred period first
  if (preferredPeriod && timePeriods[preferredPeriod] && timePeriods[preferredPeriod].length > 0) {
    usedPeriod = preferredPeriod;
    const metrics = timePeriods[preferredPeriod];
    channelData = metrics.map(metric => ({
      channel: metric.channel || 'Unknown',
      percentage: typeof metric.value === 'object' ? (metric.value.percentage || 0) : 0,
      sessions: typeof metric.value === 'object' ? (metric.value.sessions || 0) : 0
    })).filter(item => item.percentage > 0);
  } else {
    // Fall back to most recent period with data
    const sortedPeriods = Object.keys(timePeriods).sort((a, b) => b.localeCompare(a));
    isFromFallback = preferredPeriod !== undefined;
    
    for (const period of sortedPeriods) {
      const metrics = timePeriods[period];
      if (metrics && metrics.length > 0) {
        usedPeriod = period;
        channelData = metrics.map(metric => ({
          channel: metric.channel || 'Unknown',
          percentage: typeof metric.value === 'object' ? (metric.value.percentage || 0) : 0,
          sessions: typeof metric.value === 'object' ? (metric.value.sessions || 0) : 0
        })).filter(item => item.percentage > 0);
        break;
      }
    }
  }
  
  if (channelData.length === 0) {
    return results;
  }
  
  // Sort by percentage descending
  channelData.sort((a, b) => b.percentage - a.percentage);
  
  // Create summary metrics for top channels
  const topChannels = channelData.slice(0, 3); // Show top 3 channels
  const category = metricType === 'traffic' ? 'trafficSources' : 'userBehavior';
  
  topChannels.forEach((channel, index) => {
    const friendlyName = metricType === 'traffic' 
      ? `${channel.channel} Traffic`
      : `${channel.channel} Usage`;
    
    results.push({
      name: friendlyName,
      value: `${channel.percentage.toFixed(1)}%`,
      category,
      period: usedPeriod,
      isFromFallbackPeriod: isFromFallback,
      description: `${formatNumber(channel.sessions)} sessions from ${usedPeriod}`
    });
  });
  
  // Add a summary metric showing total channels
  if (channelData.length > 3) {
    const totalOther = channelData.slice(3).reduce((sum, channel) => sum + channel.percentage, 0);
    if (totalOther > 0) {
      results.push({
        name: metricType === 'traffic' ? 'Other Traffic Sources' : 'Other Devices',
        value: `${totalOther.toFixed(1)}%`,
        category,
        period: usedPeriod,
        isFromFallbackPeriod: isFromFallback,
        description: `${channelData.length - 3} additional sources from ${usedPeriod}`
      });
    }
  }
  
  return results;
}

/**
 * Format numbers with K/M notation
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return Math.round(num).toString();
}

/**
 * Analyzes metric completeness per period to understand data quality
 */
function analyzeMetricCompletenessPerPeriod(rawData: any): Record<string, Record<string, string[]>> {
  const periodAnalysis: Record<string, Record<string, string[]>> = {};
  
  if (!rawData?.metrics) {
    return periodAnalysis;
  }
  
  // Group metrics by period and category
  Object.entries(rawData.metrics).forEach(([metricName, timePeriods]: [string, any]) => {
    const category = categorizeMetric(metricName);
    
    if (timePeriods && typeof timePeriods === 'object') {
      Object.keys(timePeriods).forEach(period => {
        const periodData = timePeriods[period];
        if (periodData && periodData.length > 0) {
          if (!periodAnalysis[period]) {
            periodAnalysis[period] = {
              engagementMetrics: [],
              trafficSources: [],
              userBehavior: [],
              engagement: [],
              technical: []
            };
          }
          periodAnalysis[period][category].push(metricName);
        }
      });
    }
  });
  
  return periodAnalysis;
}

/**
 * Selects optimal period for each category based on completeness and recency
 */
function selectOptimalPeriodPerCategory(periodAnalysis: Record<string, Record<string, string[]>>, rawData: any): CategoryCoverage {
  const categories = ['engagementMetrics', 'trafficSources', 'userBehavior', 'engagement', 'technical'] as const;
  const result: CategoryCoverage = {} as CategoryCoverage;
  
  // Get sorted periods (most recent first)
  const sortedPeriods = Object.keys(periodAnalysis).sort((a, b) => b.localeCompare(a));
  
  categories.forEach(category => {
    let bestPeriod = '';
    let bestScore = -1;
    let bestMetricsCount = 0;
    let totalPossibleMetrics = 0;
    let fallbackReason: string | undefined;
    
    // Calculate total possible metrics for this category across all periods
    const allMetricsInCategory = new Set<string>();
    Object.values(periodAnalysis).forEach(periodData => {
      periodData[category].forEach(metric => allMetricsInCategory.add(metric));
    });
    totalPossibleMetrics = allMetricsInCategory.size;
    
    if (totalPossibleMetrics === 0) {
      // No metrics for this category at all
      result[category] = {
        period: 'No Data',
        metricsCount: 0,
        totalPossibleMetrics: 0,
        completenessPercentage: 0,
        isOptimal: false,
        fallbackReason: 'No metrics available for this category'
      };
      return;
    }
    
    // Score each period for this category
    sortedPeriods.forEach((period, index) => {
      const metricsInPeriod = periodAnalysis[period][category].length;
      const completeness = (metricsInPeriod / totalPossibleMetrics) * 100;
      
      // Score calculation: completeness is primary factor, recency is secondary
      // Recent periods get slight bonus, but completeness is more important
      const recencyBonus = (sortedPeriods.length - index) / sortedPeriods.length * 10;
      const score = completeness + recencyBonus;
      
      if (score > bestScore || (score === bestScore && index === 0)) {
        bestPeriod = period;
        bestScore = score;
        bestMetricsCount = metricsInPeriod;
        
        // Determine if this is optimal or a fallback
        const isOptimal = index === 0 && completeness >= 80;
        fallbackReason = undefined;
        
        if (!isOptimal) {
          if (completeness < 50) {
            fallbackReason = `Low data completeness (${completeness.toFixed(0)}%)`;
          } else if (index > 0) {
            fallbackReason = `Using older period due to incomplete recent data`;
          }
        }
      }
    });
    
    result[category] = {
      period: bestPeriod,
      metricsCount: bestMetricsCount,
      totalPossibleMetrics,
      completenessPercentage: Math.round((bestMetricsCount / totalPossibleMetrics) * 100),
      isOptimal: bestPeriod === sortedPeriods[0] && (bestMetricsCount / totalPossibleMetrics) >= 0.8,
      fallbackReason
    };
  });
  
  return result;
}

/**
 * Detects mixed-period warnings across categories
 */
function detectMixedPeriodWarnings(categoryAnalysis: CategoryCoverage): {
  hasMixedPeriods: boolean;
  affectedCategories: string[];
  message?: string;
} {
  const periods = new Set<string>();
  const categoriesWithData: string[] = [];
  const categoriesUsingOlderData: string[] = [];
  
  Object.entries(categoryAnalysis).forEach(([category, info]) => {
    if (info.metricsCount > 0 && info.period !== 'No Data') {
      periods.add(info.period);
      categoriesWithData.push(category);
      
      if (!info.isOptimal && info.fallbackReason?.includes('older')) {
        categoriesUsingOlderData.push(category);
      }
    }
  });
  
  const hasMixedPeriods = periods.size > 1;
  let message: string | undefined;
  
  if (hasMixedPeriods) {
    const periodList = Array.from(periods).sort((a, b) => b.localeCompare(a));
    message = `Data spans multiple periods (${periodList.join(', ')}) due to incomplete recent data for some metrics.`;
  }
  
  return {
    hasMixedPeriods,
    affectedCategories: categoriesUsingOlderData,
    message
  };
}

/**
 * Analyzes data coverage across all metrics to provide comprehensive coverage insights
 */
function analyzeDataCoverage(rawData: any): DataCoverage {
  // Analyze metric completeness per period first
  const periodAnalysis = analyzeMetricCompletenessPerPeriod(rawData);
  const categoryAnalysis = selectOptimalPeriodPerCategory(periodAnalysis, rawData);
  const mixedPeriodWarning = detectMixedPeriodWarnings(categoryAnalysis);
  
  // Default empty coverage
  const defaultCoverage: DataCoverage = {
    totalPeriods: 0,
    periodsWithData: 0,
    coveragePercentage: 0,
    timeRange: {
      earliest: '',
      latest: '',
      spanMonths: 0
    },
    missingPeriods: [],
    availablePeriods: [],
    dataCompleteness: 'none',
    gapAnalysis: {
      hasGaps: false,
      longestGap: 0,
      recentDataAvailable: false
    },
    categoryAnalysis,
    mixedPeriodWarning
  };

  if (!rawData?.metrics) {
    return defaultCoverage;
  }

  // Collect all unique periods across all metrics
  const allPeriodsSet = new Set<string>();
  const metricsWithData: Record<string, string[]> = {};

  Object.entries(rawData.metrics).forEach(([metricName, timePeriods]: [string, any]) => {
    if (timePeriods && typeof timePeriods === 'object') {
      const periodsForMetric = Object.keys(timePeriods).filter(period => {
        const periodData = timePeriods[period];
        return periodData && periodData.length > 0;
      });
      
      periodsForMetric.forEach(period => allPeriodsSet.add(period));
      if (periodsForMetric.length > 0) {
        metricsWithData[metricName] = periodsForMetric;
      }
    }
  });

  const allPeriods = Array.from(allPeriodsSet).sort();
  
  if (allPeriods.length === 0) {
    return defaultCoverage;
  }

  // Count periods with at least one metric having data
  const periodsWithData = allPeriods.filter(period => 
    Object.values(metricsWithData).some(metricPeriods => metricPeriods.includes(period))
  );

  // Generate expected periods between earliest and latest
  const earliestPeriod = allPeriods[0];
  const latestPeriod = allPeriods[allPeriods.length - 1];
  const expectedPeriods = generateExpectedPeriods(earliestPeriod, latestPeriod);
  
  // Find missing periods
  const missingPeriods = expectedPeriods.filter(period => !allPeriods.includes(period));

  // Calculate time span in months
  const spanMonths = calculateMonthSpan(earliestPeriod, latestPeriod);

  // Determine data completeness level
  const coveragePercentage = (periodsWithData.length / expectedPeriods.length) * 100;
  let dataCompleteness: DataCoverage['dataCompleteness'] = 'none';
  if (coveragePercentage >= 90) dataCompleteness = 'excellent';
  else if (coveragePercentage >= 75) dataCompleteness = 'good';
  else if (coveragePercentage >= 50) dataCompleteness = 'fair';
  else if (coveragePercentage > 0) dataCompleteness = 'poor';

  // Analyze gaps
  const longestGap = findLongestGap(expectedPeriods, allPeriods);
  const hasGaps = missingPeriods.length > 0;
  
  // Check if recent data is available (within last 3 months)
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recentDataAvailable = allPeriods.some(period => {
    const periodDate = parsePeriodToDate(period);
    return periodDate && periodDate >= threeMonthsAgo;
  });

  return {
    totalPeriods: expectedPeriods.length,
    periodsWithData: periodsWithData.length,
    coveragePercentage: Math.round(coveragePercentage),
    timeRange: {
      earliest: earliestPeriod,
      latest: latestPeriod,
      spanMonths
    },
    missingPeriods,
    availablePeriods: periodsWithData.sort(),
    dataCompleteness,
    gapAnalysis: {
      hasGaps,
      longestGap,
      recentDataAvailable
    },
    categoryAnalysis,
    mixedPeriodWarning
  };
}

/**
 * Helper function to generate expected periods between two dates
 */
function generateExpectedPeriods(earliest: string, latest: string): string[] {
  const periods: string[] = [];
  const start = parsePeriodToDate(earliest);
  const end = parsePeriodToDate(latest);
  
  if (!start || !end) return [earliest, latest];
  
  const current = new Date(start);
  while (current <= end) {
    periods.push(formatDateToPeriod(current));
    current.setMonth(current.getMonth() + 1);
  }
  
  return periods;
}

/**
 * Helper function to parse period string (YYYY-MM) to Date
 */
function parsePeriodToDate(period: string): Date | null {
  if (!period || !period.match(/^\d{4}-\d{2}$/)) return null;
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Helper function to format Date to period string (YYYY-MM)
 */
function formatDateToPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Helper function to calculate month span between two periods
 */
function calculateMonthSpan(earliest: string, latest: string): number {
  const start = parsePeriodToDate(earliest);
  const end = parsePeriodToDate(latest);
  
  if (!start || !end) return 0;
  
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  return yearDiff * 12 + monthDiff + 1; // +1 to include both start and end months
}

/**
 * Helper function to find the longest gap in data
 */
function findLongestGap(expectedPeriods: string[], availablePeriods: string[]): number {
  let longestGap = 0;
  let currentGap = 0;
  
  for (const period of expectedPeriods) {
    if (!availablePeriods.includes(period)) {
      currentGap++;
    } else {
      longestGap = Math.max(longestGap, currentGap);
      currentGap = 0;
    }
  }
  
  return Math.max(longestGap, currentGap);
}

/**
 * Main transformation function that converts raw company data to business insights
 */
export function transformCompanyDataToBusinessInsights(rawData: any): BusinessInsights {
  const insights: BusinessInsights = {
    overview: {
      dataAvailability: 'No data available',
      lastUpdated: 'Never',
      totalMetrics: 0
    },
    categories: {
      engagementMetrics: {
        name: 'engagementMetrics',
        displayName: getCategoryDisplayNameSimple('engagementMetrics'),
        period: 'No Data',
        periods: [],
        icon: getCategoryIcon('engagementMetrics'),
        metrics: []
      },
      trafficSources: {
        name: 'trafficSources',
        displayName: getCategoryDisplayNameSimple('trafficSources'),
        period: 'No Data',
        periods: [],
        icon: getCategoryIcon('trafficSources'),
        metrics: []
      },
      userBehavior: {
        name: 'userBehavior',
        displayName: getCategoryDisplayNameSimple('userBehavior'),
        period: 'No Data',
        periods: [],
        icon: getCategoryIcon('userBehavior'),
        metrics: []
      },
      engagement: {
        name: 'engagement',
        displayName: getCategoryDisplayNameSimple('engagement'),
        period: 'No Data',
        periods: [],
        icon: getCategoryIcon('engagement'),
        metrics: []
      },
      technical: {
        name: 'technical',
        displayName: getCategoryDisplayNameSimple('technical'),
        period: 'No Data',
        periods: [],
        icon: getCategoryIcon('technical'),
        metrics: []
      }
    },
    // Legacy support for backward compatibility
    engagementMetrics: [],
    trafficSources: [],
    userBehavior: [],
    engagement: [],
    technical: []
  };
  
  if (!rawData || !rawData.metrics) {
    return insights;
  }
  
  // Update overview
  insights.overview.totalMetrics = rawData.totalMetrics || 0;
  insights.overview.dataAvailability = insights.overview.totalMetrics > 0 ? 'Data available' : 'No data available';
  
  // Find the most recent data period across all metrics
  let mostRecentDate = '';
  const allPeriods: string[] = [];
  
  if (rawData.metrics && typeof rawData.metrics === 'object') {
    Object.values(rawData.metrics).forEach((timePeriods: any) => {
      if (timePeriods && typeof timePeriods === 'object') {
        Object.keys(timePeriods).forEach(period => {
          allPeriods.push(period);
        });
      }
    });
  }
  
  if (allPeriods.length > 0) {
    mostRecentDate = allPeriods.sort((a, b) => b.localeCompare(a))[0];
    insights.overview.lastUpdated = mostRecentDate;
  }
  
  // Get optimal periods for each category using simplified approach
  const categoryOptimalPeriods = {
    engagementMetrics: getCategoryOptimalPeriod(rawData, 'engagementMetrics'),
    trafficSources: getCategoryOptimalPeriod(rawData, 'trafficSources'),
    userBehavior: getCategoryOptimalPeriod(rawData, 'userBehavior'),
    engagement: getCategoryOptimalPeriod(rawData, 'engagement'),
    technical: getCategoryOptimalPeriod(rawData, 'technical')
  };
  
  // Get all available periods for each category and update category information
  Object.entries(categoryOptimalPeriods).forEach(([category, period]) => {
    const categoryKey = category as keyof typeof insights.categories;
    const allPeriodsForCategory = getCategoryAllPeriods(rawData, category);
    
    insights.categories[categoryKey].period = period;
    insights.categories[categoryKey].periods = allPeriodsForCategory;
    // Keep the simple display name without periods embedded
    insights.categories[categoryKey].displayName = getCategoryDisplayNameSimple(category);
  });
  
  // Process each metric using category-specific optimal periods
  if (rawData.metrics && typeof rawData.metrics === 'object') {
    Object.entries(rawData.metrics).forEach(([metricName, timePeriods]: [string, any]) => {
    const category = categorizeMetric(metricName);
    const optimalPeriod = categoryOptimalPeriods[category as keyof typeof categoryOptimalPeriods];
    
    // Handle Traffic Channels and Device Distribution specially as they need aggregation
    if (metricName === 'Traffic Channels') {
      const trafficMetrics = aggregateChannelMetrics(timePeriods, 'traffic', optimalPeriod !== 'No Data' ? optimalPeriod : undefined);
      trafficMetrics.forEach(metric => {
        insights.trafficSources.push(metric);
        insights.categories.trafficSources.metrics.push(metric);
      });
      return;
    }
    
    if (metricName === 'Device Distribution') {
      const deviceMetrics = aggregateChannelMetrics(timePeriods, 'device', optimalPeriod !== 'No Data' ? optimalPeriod : undefined);
      deviceMetrics.forEach(metric => {
        insights.userBehavior.push(metric);
        insights.categories.userBehavior.metrics.push(metric);
      });
      return;
    }
    
    // Handle regular individual metrics
    const metricData = getMetricValue(timePeriods, optimalPeriod !== 'No Data' ? optimalPeriod : undefined);
    
    if (!metricData) return;
    
    const friendlyName = getFriendlyMetricName(metricName);
    const formattedValue = formatMetricValue(metricData.value, metricName);
    
    // Generate contextual description for this metric
    const description = generateMetricDescription(rawData, friendlyName, metricData.value, metricData.period, category);
    
    const businessMetric: BusinessMetric = {
      name: friendlyName,
      value: formattedValue,
      category,
      period: metricData.period,
      isFromFallbackPeriod: metricData.isFromFallback,
      description: description
    };
    
    // Add to both legacy and new category structures
    const categoryKey = category as keyof typeof insights.categories;
    insights.categories[categoryKey].metrics.push(businessMetric);
    
    switch (category) {
      case 'engagementMetrics':
        insights.engagementMetrics.push(businessMetric);
        break;
      case 'trafficSources':
        insights.trafficSources.push(businessMetric);
        break;
      case 'userBehavior':
        insights.userBehavior.push(businessMetric);
        break;
      case 'engagement':
        insights.engagement.push(businessMetric);
        break;
      default:
        insights.technical.push(businessMetric);
        break;
    }
    });
  }
  
  return insights;
}

/**
 * Helper function to get human-readable period information for a category
 */
export function getCategoryPeriodInfo(categoryAnalysis: CategoryPeriodInfo): string {
  if (categoryAnalysis.period === 'No Data') {
    return 'No data available';
  }
  
  const periodDate = new Date(categoryAnalysis.period + '-01');
  const formattedPeriod = periodDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  
  let info = formattedPeriod;
  
  if (categoryAnalysis.fallbackReason) {
    info += ` (${categoryAnalysis.fallbackReason.toLowerCase()})`;
  } else if (categoryAnalysis.isOptimal) {
    info += ' (current)';
  }
  
  return info;
}

/**
 * Helper function to format period for display
 */
export function formatPeriodForDisplay(period: string): string {
  if (!period || period === 'No Data') {
    return 'No Data';
  }
  
  try {
    const date = new Date(period + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  } catch {
    return period;
  }
}

/**
 * Helper function to get category display name
 */
export function getCategoryDisplayName(category: keyof BusinessInsights['categories']): string {
  const categoryNames = {
    engagementMetrics: 'Engagement Metrics',
    trafficSources: 'Traffic Sources',
    userBehavior: 'User Behavior',
    engagement: 'Engagement Metrics',
    technical: 'Technical Metrics'
  };
  
  return categoryNames[category] || category;
}

/**
 * Helper function to get category description
 */
export function getCategoryDescription(category: keyof BusinessInsights['categories']): string {
  const descriptions = {
    engagementMetrics: 'Key metrics affecting user experience and search rankings',
    trafficSources: 'How visitors discover and reach your website',
    userBehavior: 'How users interact and engage with your content',
    engagement: 'Actions users take that indicate interest and intent',
    technical: 'Additional metrics and technical data points'
  };
  
  return descriptions[category] || '';
}

/**
 * Helper function to get category icon (for UI)
 */
export function getCategoryIcon(category: string): string {
  const icons = {
    engagementMetrics: 'gauge',
    trafficSources: 'users',
    userBehavior: 'mouse-pointer',
    engagement: 'target',
    technical: 'settings'
  };
  
  return icons[category as keyof typeof icons] || 'bar-chart';
}

/**
 * Helper function to get category emoji for period tags
 */
export function getCategoryEmoji(category: string): string {
  const emojis = {
    engagementMetrics: '📈',
    trafficSources: '🌐',
    userBehavior: '📱',
    engagement: '🎯',
    technical: '⚙️'
  };
  
  return emojis[category as keyof typeof emojis] || '📊';
}

/**
 * Creates a category display name with all available periods
 */
export function getCategoryDisplayNameWithAllPeriods(category: string, periods: string[]): string {
  const displayName = getCategoryDisplayName(category as any);
  const emoji = getCategoryEmoji(category);
  
  if (periods.length === 0) {
    return `${emoji} ${displayName} [No Data]`;
  }
  
  // Format periods for display
  const formattedPeriods = periods.map(period => {
    try {
      const date = new Date(period + '-01');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return { month, year, period };
    } catch {
      return { month: period, year: '', period };
    }
  });
  
  // Group by year and format
  const yearGroups: Record<string, string[]> = {};
  formattedPeriods.forEach(({ month, year, period }) => {
    const yearKey = year.toString();
    if (!yearGroups[yearKey]) {
      yearGroups[yearKey] = [];
    }
    yearGroups[yearKey].push(month);
  });
  
  // Create display string
  const yearDisplays = Object.entries(yearGroups).map(([year, months]) => {
    if (months.length === 1) {
      return `${months[0]} ${year}`;
    }
    return `${months.join(', ')} ${year}`;
  });
  
  const periodDisplay = yearDisplays.join('; ');
  return `${emoji} ${displayName} [${periodDisplay}]`;
}

/**
 * Creates a simplified category display with periods (no emojis or brackets)
 */
export function getCategoryDisplayNameWithAllPeriodsSimple(category: string, periods: string[]): { name: string; periods: string } {
  const displayName = getCategoryDisplayName(category as any);
  const periodsString = getCategoryPeriodsSimple(periods);
  
  return {
    name: displayName,
    periods: periodsString
  };
}

/**
 * Creates a category display name with period tag (for backward compatibility)
 */
export function getCategoryDisplayNameWithPeriod(category: string, period: string): string {
  const displayName = getCategoryDisplayName(category as any);
  const emoji = getCategoryEmoji(category);
  const formattedPeriod = formatPeriodForDisplay(period);
  
  if (period === 'No Data' || !period) {
    return `${emoji} ${displayName} [No Data]`;
  }
  
  return `${emoji} ${displayName} [${formattedPeriod}]`;
}

/**
 * Creates a simplified category display name (no emojis or brackets)
 */
export function getCategoryDisplayNameSimple(category: string): string {
  return getCategoryDisplayName(category as any);
}

/**
 * Gets periods formatted as a simple space-separated list
 */
export function getCategoryPeriodsSimple(periods: string[]): string {
  if (periods.length === 0) {
    return 'No Data';
  }
  
  // Sort periods descending (most recent first) and format as YYYY-MM
  const sortedPeriods = periods
    .filter(period => period && period !== 'No Data')
    .sort((a, b) => b.localeCompare(a));
    
  return sortedPeriods.join(', ');
}

/**
 * Gets periods formatted as "from [Month Year]" labels
 */
export function getCategoryPeriodsWithFromLabel(periods: string[]): string {
  if (periods.length === 0) {
    return 'No data available';
  }
  
  // Sort periods descending (most recent first) and format as human-readable dates
  const sortedPeriods = periods
    .filter(period => period && period !== 'No Data')
    .sort((a, b) => b.localeCompare(a));
  
  if (sortedPeriods.length === 0) {
    return 'No data available';
  }
  
  // Format the most recent period as "from [Month Year]"
  const mostRecentPeriod = sortedPeriods[0];
  const formattedPeriod = formatPeriodForDisplay(mostRecentPeriod);
  
  if (formattedPeriod === 'No Data') {
    return 'No data available';
  }
  
  return `from ${formattedPeriod}`;
}

/**
 * Gets ALL periods with data for a specific category from raw data
 */
export function getCategoryAllPeriods(rawData: any, category: string): string[] {
  if (!rawData?.metrics) {
    return [];
  }
  
  // Collect metrics for this category
  const categoryMetrics: Record<string, any> = {};
  
  Object.entries(rawData.metrics).forEach(([metricName, timePeriods]: [string, any]) => {
    if (categorizeMetric(metricName) === category) {
      categoryMetrics[metricName] = timePeriods;
    }
  });
  
  if (Object.keys(categoryMetrics).length === 0) {
    return [];
  }
  
  // Collect all periods with data for this category
  const allPeriods = new Set<string>();
  Object.values(categoryMetrics).forEach((timePeriods: any) => {
    if (timePeriods && typeof timePeriods === 'object') {
      Object.keys(timePeriods).forEach(period => {
        const periodData = timePeriods[period];
        if (periodData && periodData.length > 0) {
          allPeriods.add(period);
        }
      });
    }
  });
  
  // Return sorted periods (most recent first)
  return Array.from(allPeriods).sort((a, b) => b.localeCompare(a));
}

/**
 * Gets the optimal period for a specific category from raw data (for backward compatibility)
 */
export function getCategoryOptimalPeriod(rawData: any, category: string): string {
  const periods = getCategoryAllPeriods(rawData, category);
  return periods.length > 0 ? periods[0] : 'No Data';
}