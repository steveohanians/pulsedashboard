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
}

export interface BusinessInsights {
  overview: {
    dataAvailability: string;
    lastUpdated: string;
    totalMetrics: number;
  };
  websitePerformance: BusinessMetric[];
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
  
  if (name.includes('bounce') || name.includes('load') || name.includes('speed') || name.includes('performance')) {
    return 'websitePerformance';
  }
  
  if (name.includes('source') || name.includes('channel') || name.includes('organic') || 
      name.includes('direct') || name.includes('referral') || name.includes('social')) {
    return 'trafficSources';
  }
  
  if (name.includes('session') || name.includes('page') || name.includes('user') || 
      name.includes('visit') || name.includes('duration')) {
    return 'userBehavior';
  }
  
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
 * Gets the most recent value from a metric's time periods
 */
function getLatestMetricValue(timePeriods: Record<string, any[]>): { value: any; period: string } | null {
  // Sort periods to get the most recent
  const sortedPeriods = Object.keys(timePeriods).sort((a, b) => b.localeCompare(a));
  
  for (const period of sortedPeriods) {
    const metrics = timePeriods[period];
    if (metrics && metrics.length > 0) {
      // Get the most recent metric (could be multiple for different channels/devices)
      const latestMetric = metrics[metrics.length - 1];
      return {
        value: latestMetric.value,
        period
      };
    }
  }
  
  return null;
}

/**
 * Aggregates channel-based metrics (traffic channels, device distribution) into human-readable summaries
 */
function aggregateChannelMetrics(timePeriods: Record<string, any[]>, metricType: 'traffic' | 'device'): BusinessMetric[] {
  const results: BusinessMetric[] = [];
  
  // Get the most recent period with data
  const sortedPeriods = Object.keys(timePeriods).sort((a, b) => b.localeCompare(a));
  let latestPeriod = '';
  let channelData: Array<{ channel: string; percentage: number; sessions: number }> = [];
  
  for (const period of sortedPeriods) {
    const metrics = timePeriods[period];
    if (metrics && metrics.length > 0) {
      latestPeriod = period;
      // Extract channel data from metrics
      channelData = metrics.map(metric => ({
        channel: metric.channel || 'Unknown',
        percentage: typeof metric.value === 'object' ? (metric.value.percentage || 0) : 0,
        sessions: typeof metric.value === 'object' ? (metric.value.sessions || 0) : 0
      })).filter(item => item.percentage > 0);
      break;
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
      description: `${formatNumber(channel.sessions)} sessions from ${latestPeriod}`
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
        description: `${channelData.length - 3} additional sources from ${latestPeriod}`
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
 * Main transformation function that converts raw company data to business insights
 */
export function transformCompanyDataToBusinessInsights(rawData: any): BusinessInsights {
  const insights: BusinessInsights = {
    overview: {
      dataAvailability: 'No data available',
      lastUpdated: 'Never',
      totalMetrics: 0
    },
    websitePerformance: [],
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
  
  Object.values(rawData.metrics).forEach((timePeriods: any) => {
    Object.keys(timePeriods).forEach(period => {
      allPeriods.push(period);
    });
  });
  
  if (allPeriods.length > 0) {
    mostRecentDate = allPeriods.sort((a, b) => b.localeCompare(a))[0];
    insights.overview.lastUpdated = mostRecentDate;
  }
  
  // Process each metric
  Object.entries(rawData.metrics).forEach(([metricName, timePeriods]: [string, any]) => {
    // Handle Traffic Channels and Device Distribution specially as they need aggregation
    if (metricName === 'Traffic Channels') {
      const trafficMetrics = aggregateChannelMetrics(timePeriods, 'traffic');
      trafficMetrics.forEach(metric => {
        insights.trafficSources.push(metric);
      });
      return;
    }
    
    if (metricName === 'Device Distribution') {
      const deviceMetrics = aggregateChannelMetrics(timePeriods, 'device');
      deviceMetrics.forEach(metric => {
        insights.userBehavior.push(metric);
      });
      return;
    }
    
    // Handle regular individual metrics
    const latestData = getLatestMetricValue(timePeriods);
    
    if (!latestData) return;
    
    const category = categorizeMetric(metricName);
    const friendlyName = getFriendlyMetricName(metricName);
    const formattedValue = formatMetricValue(latestData.value, metricName);
    
    const businessMetric: BusinessMetric = {
      name: friendlyName,
      value: formattedValue,
      category,
      description: `Data from ${latestData.period}`
    };
    
    // Add to appropriate category
    switch (category) {
      case 'websitePerformance':
        insights.websitePerformance.push(businessMetric);
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
  
  return insights;
}

/**
 * Helper function to get category display name
 */
export function getCategoryDisplayName(category: keyof Omit<BusinessInsights, 'overview'>): string {
  const categoryNames = {
    websitePerformance: 'Website Performance',
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
export function getCategoryDescription(category: keyof Omit<BusinessInsights, 'overview'>): string {
  const descriptions = {
    websitePerformance: 'Key metrics affecting user experience and search rankings',
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
export function getCategoryIcon(category: keyof Omit<BusinessInsights, 'overview'>): string {
  const icons = {
    websitePerformance: 'gauge',
    trafficSources: 'users',
    userBehavior: 'mouse-pointer',
    engagement: 'target',
    technical: 'settings'
  };
  
  return icons[category] || 'bar-chart';
}