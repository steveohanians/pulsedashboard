/**
 * Canonical Data Processor for View Data Modal
 * Uses the same processing pipeline as dashboard charts via UnifiedDataService
 * Ensures identical results between View Data modal and dashboard charts
 */

import { unifiedDataService } from '@/services/unifiedDataService';
import { parseMetricValue } from '@/utils/metricParser';

export interface CanonicalBusinessMetric {
  name: string;
  value: string;
  category: string;
  period?: string;
  description?: string;
}

export interface CanonicalCategoryData {
  name: string;
  displayName: string;
  metrics: CanonicalBusinessMetric[];
  description: string;
}

export interface CanonicalBusinessInsights {
  overview: {
    dataAvailability: string;
    lastUpdated: string;
    totalMetrics: number;
  };
  categories: {
    engagementMetrics: CanonicalCategoryData;
    trafficSources: CanonicalCategoryData;
    userBehavior: CanonicalCategoryData;
    engagement: CanonicalCategoryData;
    technical: CanonicalCategoryData;
  };
}

/**
 * Convert modal data format to dashboard data format
 * Modal format: { metrics: { [metricName]: { [timePeriod]: [...] } } }
 * Dashboard format: { metrics: [...array of DashboardMetric objects...] }
 */
function convertModalDataToDashboardFormat(modalData: any): any {
  console.log('[DEBUG] Converting modal data to dashboard format', {
    hasModalData: !!modalData,
    hasData: !!modalData?.data,
    modalDataKeys: modalData ? Object.keys(modalData) : [],
    dataKeys: modalData?.data ? Object.keys(modalData.data) : []
  });
  
  if (!modalData) {
    console.log('[DEBUG] No modal data found');
    return null;
  }

  // Handle both possible data structures:
  // 1. Direct structure: { company, metrics, totalMetrics }
  // 2. Nested structure: { data: { company, metrics } }
  const dataSource = modalData.data || modalData;
  const { company, metrics: groupedMetrics } = dataSource;
  
  if (!company || !groupedMetrics) {
    console.log('[DEBUG] Missing company or metrics in data source', {
      hasCompany: !!company,
      hasMetrics: !!groupedMetrics,
      dataSourceKeys: Object.keys(dataSource)
    });
    return null;
  }
  const dashboardMetrics: any[] = [];

  console.log('[DEBUG] Processing grouped metrics', {
    hasCompany: !!company,
    hasGroupedMetrics: !!groupedMetrics,
    groupedMetricsType: typeof groupedMetrics,
    groupedMetricsKeys: groupedMetrics ? Object.keys(groupedMetrics) : []
  });

  // Convert grouped metrics to flat array format expected by UnifiedDataService
  if (groupedMetrics && typeof groupedMetrics === 'object') {
    Object.entries(groupedMetrics).forEach(([metricName, timePeriods]: [string, any]) => {
      if (timePeriods && typeof timePeriods === 'object') {
        Object.entries(timePeriods).forEach(([timePeriod, metricEntries]: [string, any]) => {
          if (Array.isArray(metricEntries)) {
            metricEntries.forEach((metric: any) => {
              // Handle nested value structure: {value: {value: 0.5449, source: "semrush"}}
              let actualValue = metric.value;
              if (typeof metric.value === 'object' && metric.value !== null && 'value' in metric.value) {
                actualValue = metric.value.value;
              }
              
              dashboardMetrics.push({
                metricName,
                value: actualValue,
                sourceType: metric.sourceType,
                timePeriod,
                createdAt: metric.createdAt,
                updatedAt: metric.updatedAt,
                // Add optional properties if they exist
                channel: metric.channel || null,
                competitorId: metric.competitorId || null
              });
            });
          } else {
            console.warn('[DEBUG] Expected array for metric entries but got:', typeof metricEntries, metricEntries);
          }
        });
      } else {
        console.warn('[DEBUG] Expected object for time periods but got:', typeof timePeriods, timePeriods);
      }
    });
  } else {
    console.warn('[DEBUG] Expected object for grouped metrics but got:', typeof groupedMetrics, groupedMetrics);
  }

  const result = {
    company,
    metrics: dashboardMetrics,
    competitors: [], // Modal data doesn't include competitors
    client: company,
    averagedMetrics: {},
    trafficChannelMetrics: [],
    timeSeriesData: {}
  };

  console.log('[DEBUG] Conversion result', {
    hasCompany: !!result.company,
    metricsCount: result.metrics.length,
    metricsIsArray: Array.isArray(result.metrics),
    sampleMetrics: result.metrics.slice(0, 3)
  });

  return result;
}

/**
 * Transform company data using canonical processing pipeline
 */
export function transformCompanyDataCanonically(companyData: any): CanonicalBusinessInsights {
  try {
    console.log('[DEBUG] Starting canonical transformation', {
      hasCompanyData: !!companyData,
      companyDataType: typeof companyData,
      companyDataKeys: companyData ? Object.keys(companyData) : []
    });
    
    // Convert modal data format to dashboard format first
    const dashboardFormatData = convertModalDataToDashboardFormat(companyData);
  
  if (!dashboardFormatData) {
    console.log('[DEBUG] No dashboard format data, creating empty insights');
    return createEmptyBusinessInsights(companyData?.company?.name || 'Unknown Company');
  }

  console.log('[DEBUG] About to call UnifiedDataService.processDashboardData', {
    hasMetrics: !!dashboardFormatData.metrics,
    metricsIsArray: Array.isArray(dashboardFormatData.metrics),
    metricsLength: dashboardFormatData.metrics?.length || 0
  });

  // Validate that metrics is an array before passing to UnifiedDataService
  if (!Array.isArray(dashboardFormatData.metrics)) {
    console.error('[ERROR] dashboardFormatData.metrics is not an array:', {
      metricsType: typeof dashboardFormatData.metrics,
      metrics: dashboardFormatData.metrics
    });
    return createEmptyBusinessInsights(dashboardFormatData?.company?.name || 'Unknown Company');
  }

  // Use UnifiedDataService to process the data canonically 
  const processedData = unifiedDataService.processDashboardData(
    dashboardFormatData,
    "Last Month" // Use consistent time period
  );

  if (!processedData) {
    console.log('[DEBUG] No processed data from UnifiedDataService');
    return createEmptyBusinessInsights(dashboardFormatData?.company?.name || 'Unknown Company');
  }

  const insights = createEmptyBusinessInsights(dashboardFormatData?.company?.name || 'Unknown Company');
  
  // Process core metrics using canonical processing
  if (processedData.metrics) {
    insights.categories.engagementMetrics.metrics = extractEngagementMetrics(processedData.metrics, processedData.periods?.displayPeriod);
    insights.categories.technical.metrics = extractTechnicalMetrics(processedData.metrics, processedData.periods?.displayPeriod);
    insights.categories.engagement.metrics = extractEngagementActionMetrics(processedData.metrics, processedData.periods?.displayPeriod);
  }

  // Process traffic channels using canonical processing
  if (processedData.trafficChannels && processedData.trafficChannels.length > 0) {
    insights.categories.trafficSources.metrics = extractTrafficSourceMetrics(processedData.trafficChannels);
  }

  // Process device distribution using canonical processing  
  if (processedData.deviceDistribution && processedData.deviceDistribution.length > 0) {
    insights.categories.userBehavior.metrics = extractUserBehaviorMetrics(processedData.deviceDistribution);
  }

  // Update overview with actual counts
  const totalMetrics = Object.values(insights.categories).reduce((sum, category) => sum + category.metrics.length, 0);
  insights.overview.totalMetrics = totalMetrics;
  insights.overview.dataAvailability = totalMetrics > 0 ? 'Available' : 'No data available';
  insights.overview.lastUpdated = processedData.periods?.displayPeriod || 'Unknown';

  return insights;
  
  } catch (error) {
    console.error('[ERROR] Failed to transform company data canonically:', error);
    return createEmptyBusinessInsights(companyData?.company?.name || 'Unknown Company');
  }
}

/**
 * Extract engagement metrics (Pages per Session, Session Duration, Sessions per User, Bounce Rate)
 */
function extractEngagementMetrics(metrics: any, period?: string): CanonicalBusinessMetric[] {
  const engagementMetricNames = [
    'Pages per Session',
    'Session Duration', 
    'Sessions per User',
    'Bounce Rate'
  ];

  const result: CanonicalBusinessMetric[] = [];

  engagementMetricNames.forEach(metricName => {
    if (metrics[metricName]) {
      const sourceTypes = Object.keys(metrics[metricName]);
      
      // Get the first available source type (Client preferred, then others)
      const preferredOrder = ['Client', 'CD_Avg', 'Industry_Avg', 'Competitor'];
      let sourceType = preferredOrder.find(type => sourceTypes.includes(type)) || sourceTypes[0];
      
      if (sourceType && typeof metrics[metricName][sourceType] === 'number') {
        const rawValue = metrics[metricName][sourceType];
        const formattedValue = formatMetricValueCanonically(rawValue, metricName);
        
        result.push({
          name: getFriendlyMetricName(metricName),
          value: formattedValue,
          category: 'engagementMetrics',
          period: period,
          description: getMetricDescription(metricName, sourceType, period)
        });
      }
    }
  });

  return result;
}

/**
 * Extract traffic source metrics from canonical processing
 */
function extractTrafficSourceMetrics(trafficChannels: any[]): CanonicalBusinessMetric[] {
  const result: CanonicalBusinessMetric[] = [];

  // Process each source (Client, CD_Avg, Industry_Avg, Competitors)
  trafficChannels.forEach(source => {
    if (source.channels && Array.isArray(source.channels)) {
      source.channels.forEach((channel: any) => {
        result.push({
          name: `${channel.name} (${source.label})`,
          value: `${channel.percentage}%`,
          category: 'trafficSources',
          description: `Traffic from ${channel.name.toLowerCase()} sources`
        });
      });
    }
  });

  return result;
}

/**
 * Extract device distribution metrics from canonical processing  
 */
function extractUserBehaviorMetrics(deviceDistribution: any[]): CanonicalBusinessMetric[] {
  const result: CanonicalBusinessMetric[] = [];

  // Process each source (Client, CD_Avg, Industry_Avg, Competitors)
  deviceDistribution.forEach(source => {
    if (source.devices && Array.isArray(source.devices)) {
      source.devices.forEach((device: any) => {
        result.push({
          name: `${device.name} (${source.label})`,
          value: `${device.percentage}%`,
          category: 'userBehavior',
          description: `${device.name} device usage`
        });
      });
    }
  });

  return result;
}

/**
 * Extract engagement action metrics (CTR, Conversions, etc.)
 */
function extractEngagementActionMetrics(metrics: any, period?: string): CanonicalBusinessMetric[] {
  const engagementActionMetricNames = [
    'Click Through Rate',
    'Conversion Rate',
    'Goal Completions',
    'Event Rate'
  ];

  const result: CanonicalBusinessMetric[] = [];

  engagementActionMetricNames.forEach(metricName => {
    if (metrics[metricName]) {
      const sourceTypes = Object.keys(metrics[metricName]);
      const preferredOrder = ['Client', 'CD_Avg', 'Industry_Avg', 'Competitor'];
      let sourceType = preferredOrder.find(type => sourceTypes.includes(type)) || sourceTypes[0];
      
      if (sourceType && typeof metrics[metricName][sourceType] === 'number') {
        const rawValue = metrics[metricName][sourceType];
        const formattedValue = formatMetricValueCanonically(rawValue, metricName);
        
        result.push({
          name: getFriendlyMetricName(metricName),
          value: formattedValue,
          category: 'engagement',
          period: period,
          description: getMetricDescription(metricName, sourceType, period)
        });
      }
    }
  });

  return result;
}

/**
 * Extract technical metrics (everything else)
 */
function extractTechnicalMetrics(metrics: any, period?: string): CanonicalBusinessMetric[] {
  const coreMetricNames = new Set([
    'Pages per Session', 'Session Duration', 'Sessions per User', 'Bounce Rate',
    'Click Through Rate', 'Conversion Rate', 'Goal Completions', 'Event Rate',
    'Traffic Channels', 'Device Distribution'
  ]);

  const result: CanonicalBusinessMetric[] = [];

  Object.keys(metrics).forEach(metricName => {
    // Skip core metrics that are handled in other categories
    if (coreMetricNames.has(metricName)) return;

    const sourceTypes = Object.keys(metrics[metricName]);
    const preferredOrder = ['Client', 'CD_Avg', 'Industry_Avg', 'Competitor'];
    let sourceType = preferredOrder.find(type => sourceTypes.includes(type)) || sourceTypes[0];
    
    if (sourceType && typeof metrics[metricName][sourceType] === 'number') {
      const rawValue = metrics[metricName][sourceType];
      const formattedValue = formatMetricValueCanonically(rawValue, metricName);
      
      result.push({
        name: getFriendlyMetricName(metricName),
        value: formattedValue,
        category: 'technical',
        period: period,
        description: getMetricDescription(metricName, sourceType, period)
      });
    }
  });

  return result;
}

/**
 * Format metric values using canonical logic
 */
function formatMetricValueCanonically(value: number, metricName: string): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';

  // Handle percentage metrics
  if (metricName.toLowerCase().includes('rate') || 
      metricName.toLowerCase().includes('percentage') ||
      metricName.toLowerCase().includes('bounce')) {
    return `${value.toFixed(1)}%`;
  }
  
  // Handle time-based metrics (session duration in minutes)
  if (metricName.toLowerCase().includes('duration') || 
      metricName.toLowerCase().includes('time')) {
    const minutes = Math.floor(value);
    const seconds = Math.floor((value - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Handle large numbers with K/M notation
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  
  // Default formatting
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

/**
 * Get user-friendly metric names
 */
function getFriendlyMetricName(metricName: string): string {
  const nameMap: Record<string, string> = {
    'Pages per Session': 'Pages per Session',
    'Session Duration': 'Average Session Duration',
    'Sessions per User': 'Sessions per User',
    'Bounce Rate': 'Bounce Rate',
    'Click Through Rate': 'Click-Through Rate',
    'Conversion Rate': 'Conversion Rate',
    'Goal Completions': 'Goal Completions',
    'Event Rate': 'Event Rate'
  };
  
  return nameMap[metricName] || metricName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

/**
 * Get metric descriptions
 */
function getMetricDescription(metricName: string, sourceType: string, period?: string): string {
  const sourceLabel = sourceType === 'CD_Avg' ? 'Clear Digital Average' : 
                     sourceType === 'Industry_Avg' ? 'Industry Average' :
                     sourceType === 'Client' ? 'Your Website' : 'Competitor';
                     
  const periodText = period ? ` for ${period}` : '';
  
  return `${sourceLabel} metric${periodText}`;
}

/**
 * Create empty business insights structure
 */
function createEmptyBusinessInsights(companyName: string): CanonicalBusinessInsights {
  return {
    overview: {
      dataAvailability: 'No data available',
      lastUpdated: 'Unknown',
      totalMetrics: 0
    },
    categories: {
      engagementMetrics: {
        name: 'engagementMetrics',
        displayName: 'Website Performance',
        metrics: [],
        description: 'User engagement and website interaction metrics'
      },
      trafficSources: {
        name: 'trafficSources', 
        displayName: 'Traffic Sources',
        metrics: [],
        description: 'Sources of website traffic and visitor acquisition'
      },
      userBehavior: {
        name: 'userBehavior',
        displayName: 'User Behavior',
        metrics: [],
        description: 'Device usage and user interaction patterns'
      },
      engagement: {
        name: 'engagement',
        displayName: 'Engagement Actions', 
        metrics: [],
        description: 'User actions and conversion metrics'
      },
      technical: {
        name: 'technical',
        displayName: 'Technical Metrics',
        metrics: [],
        description: 'Additional technical performance data'
      }
    }
  };
}

/**
 * Get category descriptions
 */
export function getCategoryDescriptionCanonical(category: string): string {
  const descriptions: Record<string, string> = {
    engagementMetrics: 'User engagement and website interaction metrics including pages viewed per session, time spent, and bounce rates',
    trafficSources: 'Sources of website traffic showing how visitors discover and reach your website',
    userBehavior: 'Device usage patterns and user interaction behavior on your website',
    engagement: 'User actions, conversions, and goal completions that measure website effectiveness',
    technical: 'Additional technical performance metrics and data points'
  };
  
  return descriptions[category] || 'Performance metrics and insights';
}