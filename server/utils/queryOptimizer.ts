import { storage } from '../storage';
import { generateTimePeriodsWithOffsets } from './timePeriodsGenerator';
import { parseMetricValue, parseMetricPercentage } from './metricParser';
import logger from './logger';

// Simple in-memory cache
const queryCache = new Map<string, { data: any; expires: number }>();

function getCachedData(key: string) {
  const cached = queryCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }
  queryCache.delete(key);
  return null;
}

function setCachedData(key: string, data: any, ttl: number) {
  queryCache.set(key, {
    data,
    expires: Date.now() + ttl
  });
}

// Cache cleanup
function clearExpiredCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  queryCache.forEach((value, key) => {
    if (now >= value.expires) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => queryCache.delete(key));
}

// Clean expired entries every 10 minutes
setInterval(clearExpiredCache, 10 * 60 * 1000);

// Export cache functions for use in routes
export { getCachedData, setCachedData };

export function clearCache() {
  queryCache.clear();
  logger.info('Query cache cleared');
}

export function debugCacheKeys() {
  return Array.from(queryCache.keys());
}

async function generateCdAvgDeviceDistribution(clientId: string, periodsToQuery: string[]) {
  try {
    const cdPortfolioCompanies = await storage.getCDPortfolioCompanies();
    
    if (cdPortfolioCompanies.length === 0) {
      logger.warn('No CD portfolio companies found for device distribution fallback');
      return [];
    }

    const deviceAverages = new Map<string, number[]>();
    
    for (const period of periodsToQuery) {
      for (const company of cdPortfolioCompanies) {
        const metrics = await storage.getMetricsByCompany(company.id, period);
        const deviceMetrics = metrics.filter(m => m.metricName === 'Device Distribution');
        
        deviceMetrics.forEach(metric => {
          const deviceType = metric.channel || metric.deviceType || 'Unknown';
          const parsedValue = parseMetricValue(metric.value);
          
          if (parsedValue !== null && deviceType !== 'Unknown') {
            if (!deviceAverages.has(deviceType)) {
              deviceAverages.set(deviceType, []);
            }
            deviceAverages.get(deviceType)!.push(parsedValue);
          }
        });
      }
    }

    const result: any[] = [];
    
    // Generate CD_Avg metrics for each device type and period
    periodsToQuery.forEach(period => {
      deviceAverages.forEach((values, deviceType) => {
        if (values.length > 0) {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          result.push({
            metricName: 'Device Distribution',
            value: average,
            sourceType: 'CD_Avg',
            timePeriod: period,
            channel: deviceType,
            competitorId: null
          });
        }
      });
    });

    logger.info('Generated authentic CD_Avg device distribution data', {
      clientId,
      periodsCount: periodsToQuery.length,
      deviceTypes: Array.from(deviceAverages.keys()),
      averageDesktop: deviceAverages.get('Desktop') ? 
        (deviceAverages.get('Desktop')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Desktop')!.length).toFixed(1) : 'N/A',
      averageMobile: deviceAverages.get('Mobile') ? 
        (deviceAverages.get('Mobile')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Mobile')!.length).toFixed(1) : 'N/A'
    });

    return result;
  } catch (error) {
    logger.error('Error generating CD_Avg device distribution data:', error);
    return [];
  }
}

// Optimized filters query with caching
export async function getFiltersOptimized() {
  const cacheKey = 'filters';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  const clients = await storage.getClients();
  const businessSizeOrder = ["Startup", "Small Business", "Medium Business", "Large Business", "Enterprise"];
  
  const availableBusinessSizes = [...new Set(clients.map(c => c.businessSize).filter(Boolean))];
  const availableIndustryVerticals = [...new Set(clients.map(c => c.industryVertical).filter(Boolean))];
  
  const sortedBusinessSizes = businessSizeOrder.filter(size => availableBusinessSizes.includes(size));
  const unknownBusinessSizes = availableBusinessSizes.filter(size => !businessSizeOrder.includes(size)).sort();
  
  const data = {
    businessSizes: ["All", ...sortedBusinessSizes, ...unknownBusinessSizes],
    industryVerticals: ["All", ...availableIndustryVerticals.sort()],
    timePeriods: ["Last Month", "Last Quarter", "Last Year", "Custom Date Range"]
  };
  
  setCachedData(cacheKey, data, 5 * 60 * 1000); // 5 minutes
  return data;
}

// Main optimized dashboard metrics query (alias for backward compatibility)
export async function getDashboardDataOptimized(clientId: string, filters: any) {
  return getDashboardMetricsOptimized(clientId, filters);
}

// Main optimized dashboard metrics query
export async function getDashboardMetricsOptimized(clientId: string, filters: any) {
  const cacheKey = `metrics-${clientId}-${JSON.stringify(filters)}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  const client = await storage.getClient(clientId);
  if (!client) throw new Error('Client not found');
  
  const periodsToQuery = generateTimePeriodsWithOffsets(filters.timePeriod, filters.customStartDate, filters.customEndDate);
  const shouldCreateTimeSeriesData = filters.timePeriod === 'Custom Date Range' || periodsToQuery.length > 1 || filters.timePeriod === 'Last Month';
  
  const competitors = await storage.getCompetitorsByClient(clientId);
  
  const allMetricsArrays = await Promise.all(
    periodsToQuery.map(period => storage.getMetricsByClient(clientId, period))
  );
  
  const allCompetitorMetricsArrays = await Promise.all(
    competitors.flatMap(competitor =>
      periodsToQuery.map(period => storage.getMetricsByCompetitor(competitor.id, period))
    )
  );
  
  const allFilteredIndustryMetricsArrays = await Promise.all(
    periodsToQuery.map(period => 
      storage.getIndustryAverageMetrics(client.industryVertical, period)
    )
  );
  
  const allFilteredCdAvgMetricsArrays = await Promise.all(
    periodsToQuery.map(period => storage.getCdAvgMetrics(period))
  );
  
  const processedData = processMetricsData(
    allMetricsArrays,
    allCompetitorMetricsArrays,
    allFilteredIndustryMetricsArrays,
    allFilteredCdAvgMetricsArrays
  );
  
  let timeSeriesData: any = null;

  // Handle time series data for multiple periods or Last Month
  if (shouldCreateTimeSeriesData) {
    try {
      // Check if we have daily data for "Last Month"
      if (filters.timePeriod === 'Last Month' && periodsToQuery.length === 1) {
        const lastMonthPeriod = periodsToQuery[0];
        const dailyMetrics = await storage.getMetricsByClient(clientId, `${lastMonthPeriod}-daily`);
        
        if (dailyMetrics.length > 0) {
          // Group daily data into weekly periods for better visualization
          const dailyByDate: Record<string, any[]> = {};
          
          dailyMetrics.forEach(metric => {
            const dateKey = `${lastMonthPeriod}-daily-${metric.date || 'unknown'}`;
            if (!dailyByDate[dateKey]) {
              dailyByDate[dateKey] = [];
            }
            dailyByDate[dateKey].push(metric);
          });
          
          const sortedDays = Object.keys(dailyByDate).sort();
          const groupedPeriods: Record<string, any[]> = {};
          const daysPerGroup = Math.max(1, Math.floor(sortedDays.length / 4));
          
          for (let i = 0; i < 4; i++) {
            const startIndex = i * daysPerGroup;
            const endIndex = i === 3 ? sortedDays.length : (i + 1) * daysPerGroup;
            const daysInGroup = sortedDays.slice(startIndex, endIndex);
            
            if (daysInGroup.length === 0) break;
            
            const periodKey = `${lastMonthPeriod}-group-${i + 1}`;
            groupedPeriods[periodKey] = [];
            
            // Collect all metrics from all days in this group
            const allMetricsInGroup: Record<string, number[]> = {};
            
            daysInGroup.forEach(dayKey => {
              dailyByDate[dayKey].forEach(metric => {
                const metricKey = `${metric.metricName}-Client`;
                if (!allMetricsInGroup[metricKey]) {
                  allMetricsInGroup[metricKey] = [];
                }
                const parsedValue = parseMetricValue(metric.value);
                if (parsedValue !== null) {
                  allMetricsInGroup[metricKey].push(parsedValue);
                }
              });
            });
            
            // Calculate averages for each metric in this group
            Object.keys(allMetricsInGroup).forEach(metricKey => {
              const [metricName] = metricKey.split('-');
              const values = allMetricsInGroup[metricKey];
              const average = values.reduce((sum, val) => sum + val, 0) / values.length;
              
              groupedPeriods[periodKey].push({
                metricName,
                value: average,
                sourceType: 'Client',
                timePeriod: periodKey,
                channel: null,
                competitorId: null
              });
            });
          }
          
          // Replace the single-period data with grouped periods
          if (Object.keys(groupedPeriods).length > 0) {
            const cdAvgMetrics = processedData.filter(m => m.sourceType === 'CD_Avg');
            
            // Add CD Average metrics to each grouped period so they appear as flat lines
            try {
              Object.keys(groupedPeriods).forEach(periodKey => {
                cdAvgMetrics.forEach(metric => {
                  let processedValue = metric.value;
                  if ((metric.metricName === 'Traffic Channels' || metric.metricName === 'Device Distribution') && metric.sourceType === 'CD_Avg') {
                    if (typeof metric.value === 'string' && metric.value.includes('{')) {
                      try {
                        const parsed = JSON.parse(metric.value);
                        processedValue = Number(parsed.percentage) || 0;
                      } catch (e) {
                        processedValue = 0;
                      }
                    } else if (typeof metric.value === 'object' && metric.value !== null && 'percentage' in metric.value) {
                      processedValue = Number(metric.value.percentage) || 0;
                    }
                  }
                  
                  groupedPeriods[periodKey].push({
                    metricName: metric.metricName,
                    value: processedValue,
                    sourceType: 'CD_Avg',
                    timePeriod: periodKey,
                    channel: metric.channel,
                    competitorId: null
                  });
                });
              });
            } catch (error) {
              logger.warn('Error processing grouped periods:', error);
            }
            
            timeSeriesData = groupedPeriods;
            periodsToQuery = Object.keys(groupedPeriods).sort();
          }
        }
      }
    } catch (error) {
      logger.warn('Could not include daily data in time series:', error);
    }
  }
  
  // Process device distribution metrics into frontend-expected structure
  const trafficChannelMetrics = processedData.filter(m => m.metricName === 'Traffic Channels');
  const deviceDistributionMetrics = processedData.filter(m => m.metricName === 'Device Distribution');
  
  const deviceDistribution = {
    client: {} as any,
    cdAvg: {} as any
  };
  
  // Group device metrics by source type
  deviceDistributionMetrics.forEach(metric => {
    const deviceType = metric.deviceType || metric.channel || metric.metricSubtype;
    
    let value = null;
    
    if (metric.sourceType === 'CD_Avg' && typeof metric.value === 'string' && metric.value.includes('{')) {
      try {
        const parsed = JSON.parse(metric.value);
        value = Number(parsed.percentage) || 0;
      } catch (error) {
        value = null;
      }
    } else if (metric.valuePreview !== undefined) {
      value = parseFloat(String(metric.valuePreview).replace('%', ''));
    } else if (metric.value !== undefined) {
      value = parseFloat(String(metric.value).replace('%', ''));
    }
    
    if (metric.sourceType === 'Client' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.client[deviceType] = value;
    } else if (metric.sourceType === 'CD_Avg' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.cdAvg[deviceType] = value;
    }
  });
  
  const result = {
    client,
    competitors,
    trafficChannelMetrics,
    deviceDistributionMetrics,
    deviceDistribution,
    // For multi-period queries OR "Last Month" (daily data), structure as time series
    ...(shouldCreateTimeSeriesData ? {
      isTimeSeries: true,
      periods: periodsToQuery,
      timeSeriesData,
      metrics: processedData
    } : {
      isTimeSeries: false,
      metrics: processedData
    })
  };
  
  setCachedData(cacheKey, result, 5 * 60 * 1000); // 5 minutes cache
  return result;
}

function processMetricsData(
  allMetricsArrays: any[],
  allCompetitorMetricsArrays: any[],
  allFilteredIndustryMetricsArrays: any[],
  allFilteredCdAvgMetricsArrays: any[]
): any[] {
  // Flatten and combine all metrics data efficiently
  const allMetrics = allMetricsArrays.flat();
  const allCompetitorMetrics = allCompetitorMetricsArrays.flat();
  const allFilteredIndustryMetrics = allFilteredIndustryMetricsArrays.flat();
  const allFilteredCdAvgMetrics = allFilteredCdAvgMetricsArrays.flat();
  
  // Helper function to process traffic channel data
  const processTrafficChannelData = (metrics: any[]): any[] => {
    const result: any[] = [];
    
    metrics.forEach(m => {
      if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && m.channel) {
        // Individual channel record format (authentic data)
        let finalValue;
        
        if (m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') {
          const percentageResult = parseMetricPercentage(m.value);
          finalValue = percentageResult ? percentageResult.percentage : 0;
        } else {
          finalValue = parseMetricValue(m.value);
        }
        
        result.push({
          metricName: m.metricName,
          value: finalValue,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId
        });
      } else if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && !m.channel) {
        // Parse GA4 JSON format
        const rawValue = m.value;
        
        if (typeof rawValue === 'string') {
          try {
            const channelData = JSON.parse(rawValue);
            if (Array.isArray(channelData)) {
              channelData.forEach((channel: any) => {
                const channelName = m.metricName === 'Device Distribution' 
                  ? (channel.device || channel.name || channel.channel)
                  : (channel.channel || channel.name);
                
                result.push({
                  metricName: m.metricName,
                  value: channel.percentage || 0,
                  sourceType: m.sourceType,
                  timePeriod: m.timePeriod,
                  channel: channelName,
                  competitorId: m.competitorId
                });
              });
            }
          } catch (e) {
            logger.warn('Failed to parse traffic channel JSON:', { error: e.message, rawValue });
            result.push({
              metricName: m.metricName,
              value: 0,
              sourceType: m.sourceType,
              timePeriod: m.timePeriod,
              channel: 'Unknown',
              competitorId: m.competitorId
            });
          }
        } else if (Array.isArray(rawValue)) {
          rawValue.forEach((channel: any) => {
            const channelName = m.metricName === 'Device Distribution' 
              ? (channel.device || channel.name || channel.channel)
              : (channel.channel || channel.name);
            
            result.push({
              metricName: m.metricName,
              value: channel.percentage || 0,
              sourceType: m.sourceType,
              timePeriod: m.timePeriod,
              channel: channelName,
              competitorId: m.competitorId
            });
          });
        } else {
          logger.warn('Unexpected traffic channel format:', { rawValue, metricName: m.metricName });
        }
      } else if (m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') {
        logger.warn('Unhandled traffic channel format:', {
          metricName: m.metricName,
          hasChannel: !!m.channel,
          valueType: typeof m.value
        });
        
        result.push({
          metricName: m.metricName,
          value: 0,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: 'Unknown',
          competitorId: m.competitorId
        });
      } else {
        // Regular metric
        let finalValue = parseMetricValue(m.value);
        
        result.push({
          metricName: m.metricName,
          value: finalValue,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId
        });
      }
    });
    
    return result;
  };
  
  // Process all metrics through the traffic channel handler
  const processedMetrics = processTrafficChannelData(allMetrics);
  const processedCompetitorMetrics = processTrafficChannelData(allCompetitorMetrics);
  const processedIndustryMetrics = processTrafficChannelData(allFilteredIndustryMetrics);
  const processedCdAvgMetrics = processTrafficChannelData(allFilteredCdAvgMetrics);
  
  // Combine all processed metrics
  return [
    ...processedMetrics,
    ...processedCompetitorMetrics,
    ...processedIndustryMetrics,
    ...processedCdAvgMetrics
  ];
}

// Helper function to group metrics by time period for time series charts
export function groupMetricsByTimePeriod(metrics: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  metrics.forEach(metric => {
    const period = metric.timePeriod;
    if (!grouped[period]) {
      grouped[period] = [];
    }
    grouped[period].push(metric);
  });
  
  return grouped;
}