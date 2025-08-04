// Database query optimization utilities
import { storage } from "../storage";
import { parseMetricValue } from "./metricParser";

// Cache for frequently accessed data
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function getCachedData(key: string): any | null {
  const cached = queryCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    queryCache.delete(key);
    return null;
  }
  
  return cached.data;
}

export function setCachedData(key: string, data: any, ttlMs: number = 60000): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    // Clear specific cache entries matching pattern
    const keysToDelete = [];
    for (const [key] of Array.from(queryCache.keys())) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => queryCache.delete(key));
    console.log(`Cache cleared: deleted ${keysToDelete.length} keys matching pattern "${pattern}"`);
  } else {
    // Clear all cache entries
    const totalKeys = queryCache.size;
    queryCache.clear();
    console.log(`Cache cleared: deleted all ${totalKeys} keys`);
  }
}

export function debugCacheKeys(): string[] {
  return Array.from(queryCache.keys());
}

// Optimized filters query with caching
export async function getFiltersOptimized() {
  const cacheKey = 'filters';
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  // Get benchmark companies data for filters
  const benchmarkCompanies = await storage.getBenchmarkCompanies();
  
  // Build filters from benchmark companies
  const businessSizeOrder = [
    "Small / Startup (25-100 employees)",
    "Mid-Market (100-500 employees)", 
    "Large (500-1,000 employees)",
    "Enterprise (1,000-5,000 employees)",
    "Global Enterprise (5,000+ employees)"
  ];
  
  const availableBusinessSizes = Array.from(new Set(benchmarkCompanies.map(c => c.businessSize).filter(Boolean)));
  const availableIndustryVerticals = Array.from(new Set(benchmarkCompanies.map(c => c.industryVertical).filter(Boolean)));
  
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

// Optimized dashboard query with parallel fetching and minimal data
export async function getDashboardDataOptimized(
  client: any,
  periodsToQuery: string[],
  businessSize: string,
  industryVertical: string,
  timePeriod?: string
) {
  const cacheKey = `dashboard-${client.id}-${periodsToQuery.join(',')}-${businessSize}-${industryVertical}`;
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  // Prepare filters for industry data
  const filters = { businessSize, industryVertical };
  
  // For "Last Month" period, also fetch daily GA4 data if available
  if (periodsToQuery.includes('2025-07') || periodsToQuery.includes('2025-06')) {
    const lastMonthPeriod = periodsToQuery.find(p => p === '2025-07' || p === '2025-06');
    if (lastMonthPeriod) {
      try {
        const dailyMetrics = await storage.getDailyClientMetrics(client.id, lastMonthPeriod);
        if (dailyMetrics.length > 0) {
          // Cache the daily data for charts to use
          setCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`, dailyMetrics, 5 * 60 * 1000);
        }
      } catch (error) {
        console.warn('Could not fetch daily metrics:', error);
      }
    }
  }

  // For large datasets (>10 periods), use sequential batches to avoid connection timeout
  // For smaller datasets, use parallel queries for performance
  let dataPromise;
  
  if (periodsToQuery.length > 10) {
    // Sequential processing for large historical datasets
    dataPromise = (async () => {
      const [competitors] = await Promise.all([
        storage.getCompetitorsByClient(client.id)
      ]);
      
      // Process periods in smaller batches to avoid connection timeout
      const batchSize = 8;
      const allMetricsArrays = [];
      const allCompetitorMetricsArrays = [];
      const allFilteredIndustryMetricsArrays = [];
      const allFilteredCdAvgMetricsArrays = [];
      
      for (let i = 0; i < periodsToQuery.length; i += batchSize) {
        const batch = periodsToQuery.slice(i, i + batchSize);
        const [batchMetrics, batchCompMetrics, batchIndMetrics, batchCdMetrics] = await Promise.all([
          Promise.all(batch.map(p => storage.getMetricsByClient(client.id, p))),
          Promise.all(batch.map(p => storage.getMetricsByCompetitors(client.id, p))),
          Promise.all(batch.map(p => storage.getFilteredIndustryMetrics(p, filters))),
          Promise.all(batch.map(p => storage.getFilteredCdAvgMetrics(p, filters))),
        ]);
        
        allMetricsArrays.push(...batchMetrics);
        allCompetitorMetricsArrays.push(...batchCompMetrics);
        allFilteredIndustryMetricsArrays.push(...batchIndMetrics);
        allFilteredCdAvgMetricsArrays.push(...batchCdMetrics);
      }
      
      return [allMetricsArrays, competitors, allCompetitorMetricsArrays, allFilteredIndustryMetricsArrays, allFilteredCdAvgMetricsArrays];
    })();
  } else {
    // Parallel processing for smaller datasets
    dataPromise = Promise.all([
      Promise.all(periodsToQuery.map(p => storage.getMetricsByClient(client.id, p))),
      storage.getCompetitorsByClient(client.id),
      Promise.all(periodsToQuery.map(p => storage.getMetricsByCompetitors(client.id, p))),
      Promise.all(periodsToQuery.map(p => storage.getFilteredIndustryMetrics(p, filters))),
      Promise.all(periodsToQuery.map(p => storage.getFilteredCdAvgMetrics(p, filters))),
    ]);
  }
  
  // Add timeout to prevent hanging - longer timeout for large historical datasets
  const timeoutMs = periodsToQuery.length > 10 ? 30000 : 15000;
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database query timeout')), timeoutMs)
  );
  
  const [
    allMetricsArrays,
    competitors,
    allCompetitorMetricsArrays,
    allFilteredIndustryMetricsArrays,
    allFilteredCdAvgMetricsArrays
  ] = await Promise.race([dataPromise, timeoutPromise]) as any;
  
  // Process and structure the data
  const processedData = processMetricsData(
    allMetricsArrays,
    allCompetitorMetricsArrays,
    allFilteredIndustryMetricsArrays,
    allFilteredCdAvgMetricsArrays,
    periodsToQuery
  );
  

  
  // Create timeSeriesData for multi-period queries OR "Last Month" (for daily data visualization)
  const shouldCreateTimeSeriesData = periodsToQuery.length > 1 || timePeriod === 'Last Month';
  let timeSeriesData = shouldCreateTimeSeriesData ? groupMetricsByPeriod(processedData) : undefined;
  
  // For "Last Month", also include daily data if available, but group into 6 periods (every 5-6 days)
  if (timePeriod === 'Last Month' && timeSeriesData) {
    try {
      const lastMonthPeriod = periodsToQuery[0]; // Should be 2025-07
      const cachedDailyData = getCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`);
      
      if (cachedDailyData && Array.isArray(cachedDailyData) && cachedDailyData.length > 0) {

        
        // Group daily data into 6 periods (every 5-6 days) with averaged values, matching session duration groupings
        const dailyByDate: Record<string, any[]> = {};
        
        // First, group by day
        cachedDailyData.forEach(metric => {
          const dayKey = metric.timePeriod; // Format: 2025-07-daily-20250701
          if (!dailyByDate[dayKey]) {
            dailyByDate[dayKey] = [];
          }
          dailyByDate[dayKey].push(metric);
        });
        
        // Sort days and group into 6 periods (every ~5 days)
        const sortedDays = Object.keys(dailyByDate).sort();
        const daysInMonth = sortedDays.length;
        const groupSize = Math.ceil(daysInMonth / 6); // ~5-6 days per group
        
        const groupedPeriods: Record<string, any[]> = {};
        
        for (let i = 0; i < 6; i++) {
          const startIdx = i * groupSize;
          const endIdx = Math.min(startIdx + groupSize, daysInMonth);
          const daysInGroup = sortedDays.slice(startIdx, endIdx);
          
          if (daysInGroup.length === 0) break;
          
          // Create a period label (e.g., "Jul 1-5", "Jul 26-31")
          const firstDay = daysInGroup[0].split('-daily-')[1]; // 20250701
          const lastDay = daysInGroup[daysInGroup.length - 1].split('-daily-')[1]; // 20250705
          
          const firstDate = new Date(parseInt(firstDay.substring(0, 4)), parseInt(firstDay.substring(4, 6)) - 1, parseInt(firstDay.substring(6, 8)));
          const lastDate = new Date(parseInt(lastDay.substring(0, 4)), parseInt(lastDay.substring(4, 6)) - 1, parseInt(lastDay.substring(6, 8)));
          
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
  
          timeSeriesData = groupedPeriods;
          periodsToQuery = Object.keys(groupedPeriods).sort();
        }
      }
    } catch (error) {
      console.warn('Could not include daily data in time series:', error);
    }
  }
  
  // Debug: Check what's actually in timeSeriesData for first period
  if (timeSeriesData && Object.keys(timeSeriesData).length > 0) {
    const firstPeriod = Object.keys(timeSeriesData)[0];
    const firstPeriodData = timeSeriesData[firstPeriod];
    const competitorCount = firstPeriodData.filter(m => m.sourceType === 'Competitor').length;

  }

  // Extract traffic channel and device distribution data separately for chart components
  const trafficChannelMetrics = processedData.filter(m => m.metricName === 'Traffic Channels');
  const deviceDistributionMetrics = processedData.filter(m => m.metricName === 'Device Distribution');
  

  
  // Debug logging disabled for performance

  // 🔍 DEBUG: Check final processedData for CD_Avg
  const cdAvgInProcessed = processedData.find(m => m.sourceType === 'CD_Avg' && m.metricName === 'Bounce Rate');
  if (cdAvgInProcessed) {
    console.log('🔍 Final CD_Avg Bounce Rate in processedData:', cdAvgInProcessed.value);
  }

  const result = {
    client,
    competitors,
    insights: [], // Load insights asynchronously
    trafficChannelMetrics, // Add separate traffic channel data for stacked bar chart
    deviceDistributionMetrics, // Add separate device distribution data for donut chart
    // For multi-period queries OR "Last Month" (daily data), structure as time series
    ...(shouldCreateTimeSeriesData ? {
      isTimeSeries: true,
      periods: periodsToQuery,
      timeSeriesData,
      metrics: processedData // Keep flat structure for backward compatibility
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
  allFilteredCdAvgMetricsArrays: any[],
  periodsToQuery: string[]
) {
  // Flatten and combine all metrics data efficiently
  const allMetrics = allMetricsArrays.flat();
  const allCompetitorMetrics = allCompetitorMetricsArrays.flat();
  const allFilteredIndustryMetrics = allFilteredIndustryMetricsArrays.flat();
  const allFilteredCdAvgMetrics = allFilteredCdAvgMetricsArrays.flat();
  
  // 🔍 DEBUG: Track CD_Avg data flow
  const cdAvgBounceRate = allFilteredCdAvgMetrics.find(m => m.metricName === 'Bounce Rate');
  if (cdAvgBounceRate) {
    console.log('🔍 CD_Avg Bounce Rate raw from DB:', cdAvgBounceRate.value);
    console.log('🔍 CD_Avg Bounce Rate parsed:', parseMetricValue(cdAvgBounceRate.value));
  }
  
  // Helper function to process traffic channel data
  const processTrafficChannelData = (metrics: any[]): any[] => {
    const result: any[] = [];
    
    metrics.forEach(m => {
      if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && m.channel) {
        // Individual channel record format (authentic data)
        result.push({
          metricName: m.metricName,
          value: parseMetricValue(m.value),
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId
        });
      } else if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && !m.channel && typeof m.value === 'string') {
        // Parse GA4 JSON format: [{"channel": "Direct", "sessions": 4439, "percentage": 64.87...}]
        try {
          const channelData = JSON.parse(m.value);
          if (Array.isArray(channelData)) {
            channelData.forEach((channel: any) => {
              result.push({
                metricName: m.metricName,
                value: channel.percentage || channel.value || channel.sessions,
                sourceType: m.sourceType,
                timePeriod: m.timePeriod,
                channel: channel.channel || channel.name,
                competitorId: m.competitorId
              });
            });
          }
        } catch (e) {
          // Fallback for invalid JSON - keep original
          result.push({
            metricName: m.metricName,
            value: m.value,
            sourceType: m.sourceType,
            timePeriod: m.timePeriod,
            channel: m.channel,
            competitorId: m.competitorId
          });
        }
      } else {
        // Regular metric - handle JSON-wrapped values from competitor data
        let finalValue = parseMetricValue(m.value);
        
        // 🔍 DEBUG: Track CD_Avg processing
        if (m.sourceType === 'CD_Avg' && m.metricName === 'Bounce Rate') {
          console.log('🔍 Processing CD_Avg Bounce Rate:', { 
            raw: m.value, 
            parsed: finalValue,
            sourceType: m.sourceType,
            timePeriod: m.timePeriod 
          });
        }
        
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
  

  
  const processedData = [
    ...processTrafficChannelData(allMetrics.map(m => ({ ...m, sourceType: m.sourceType }))),
    ...processTrafficChannelData(allCompetitorMetrics.map(m => ({ ...m, sourceType: 'Competitor' }))),
    ...processTrafficChannelData(allFilteredIndustryMetrics.map(m => ({ ...m, sourceType: 'Industry_Avg' }))),
    ...processTrafficChannelData(allFilteredCdAvgMetrics.map(m => ({ ...m, sourceType: 'CD_Avg' })))
  ];
  
  return processedData;
}

// Group metrics by time period for time series charts
function groupMetricsByPeriod(metrics: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  const competitorCount = metrics.filter(m => m.sourceType === 'Competitor').length;
  
  metrics.forEach(metric => {
    const period = metric.timePeriod;
    if (!grouped[period]) {
      grouped[period] = [];
    }
    grouped[period].push(metric);
  });
  
  return grouped;
}

// Separate function for heavy data (charts, metrics) - lazy loaded
export async function getDashboardMetricsOptimized(clientId: string, filters: any) {
  const cacheKey = `metrics-${clientId}-${JSON.stringify(filters)}`;
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  // This function needs to be implemented - placeholder for now
  const metrics: any[] = [];
  const benchmarks: any[] = [];
  
  const metricsData = { metrics, benchmarks };
  setCachedData(cacheKey, metricsData, 2 * 60 * 1000); // 2 minutes
  return metricsData;
}