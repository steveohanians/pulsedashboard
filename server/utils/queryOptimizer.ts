// Database query optimization utilities
import { storage } from "../storage";
import { parseMetricValue, parseMetricPercentage } from "./metricParser";
import logger from "./logger";

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
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    // Clear specific cache entries matching pattern
    const keysToDelete = [];
    for (const key of Array.from(queryCache.keys())) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => queryCache.delete(key));
    // Cache entries cleared
  } else {
    // Clear all cache entries
    queryCache.clear();
  }
}

export function debugCacheKeys(): string[] {
  return Array.from(queryCache.keys());
}

/**
 * Generate authentic CD_Avg device distribution data from demo client data
 * This ensures authentic data integrity by using real client data rather than synthetic fallbacks
 */
async function generateCdAvgDeviceDistributionIfMissing(
): Promise<void> {
  try {
    // Check if CD_Avg device distribution data already exists
    const existingCdAvgDeviceData = processedData.filter(
      m => m.metricName === 'Device Distribution' && m.sourceType === 'CD_Avg'
    );
    
    if (existingCdAvgDeviceData.length > 0) {
      logger.debug('CD_Avg device distribution data already exists, skipping generation');
      return;
    }

    // Get all client device distribution data to calculate authentic averages
    const clientDeviceData = processedData.filter(
      m => m.metricName === 'Device Distribution' && m.sourceType === 'Client'
    );
    
    if (clientDeviceData.length === 0) {
      logger.debug('No client device distribution data available for CD_Avg generation');
      return;
    }

    // Calculate authentic averages by device type across all periods
    const deviceAverages = new Map<string, number[]>();
    
    clientDeviceData.forEach(metric => {
      if (metric.channel && typeof metric.value === 'number') {
        if (!deviceAverages.has(metric.channel)) {
          deviceAverages.set(metric.channel, []);
        }
        deviceAverages.get(metric.channel)!.push(metric.value);
      }

    // Generate CD_Avg metrics for each period using authentic calculated averages
    for (const period of periodsToQuery) {
      for (const [deviceName, values] of Array.from(deviceAverages.entries())) {
        if (values.length > 0) {
          const avgPercentage = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
          
          // Store authentic CD_Avg device distribution data in database
          await storage.createMetric({

          // Add to processed data for immediate use
          processedData.push({
        }
      }
    }

    logger.info('Generated authentic CD_Avg device distribution data', {
      clientId,
        (deviceAverages.get('Desktop')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Desktop')!.length).toFixed(1) : 'N/A',
        (deviceAverages.get('Mobile')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Mobile')!.length).toFixed(1) : 'N/A'

  } catch (error) {
    logger.error('Error generating CD_Avg device distribution data:', error);
  }
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
  };
  
  setCachedData(cacheKey, data, 5 * 60 * 1000); // 5 minutes
  return data;
}

// Optimized dashboard query with parallel fetching and minimal data
export async function getDashboardDataOptimized(
  timePeriod?: string
) {
  logger.info('🔴 DASHBOARD FUNCTION CALLED - CLIENT: ' + client.id);
  
  // TEMPORARY: Clear query cache to force fresh CD_Avg traffic channel processing
  clearCache();
  logger.info('🚛 QUERY CACHE CLEARED - Forcing fresh CD_Avg traffic channel processing');

  const cacheKey = `dashboard-${client.id}-${periodsToQuery.join(',')}-${businessSize}-${industryVertical}`;
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  // Prepare filters for industry data
  const filters = { businessSize, industryVertical };
  
  // For "Last Month" period, try daily data first, fallback to monthly data
  if (periodsToQuery.includes('2025-07') || periodsToQuery.includes('2025-06')) {
    const lastMonthPeriod = periodsToQuery.find(p => p === '2025-07' || p === '2025-06');
    if (lastMonthPeriod) {
      try {
        // First try to get daily metrics
        const dailyMetrics = await storage.getDailyClientMetrics(client.id, lastMonthPeriod);
        if (dailyMetrics.length > 0) {
          // Cache the daily data for charts to use
          setCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`, dailyMetrics, 5 * 60 * 1000);
        } else {
          // Fallback: Get monthly metrics for the period
          console.log(`No daily metrics found for ${lastMonthPeriod}, falling back to monthly metrics`);
          const monthlyMetrics = await storage.getMetricsByClient(client.id, lastMonthPeriod);
          if (monthlyMetrics.length > 0) {
            // Cache monthly data as fallback
            setCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`, monthlyMetrics, 5 * 60 * 1000);
          }
        }
      } catch (error) {
        console.warn('Could not fetch daily or monthly metrics:', error);
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
      Promise.all(periodsToQuery.map(async p => {
        console.error(`🚨 CALLING getMetricsByCompetitors for period: ${p}`);
        const result = await storage.getMetricsByCompetitors(client.id, p);
        console.error(`🚨 getMetricsByCompetitors returned: ${result.length} metrics for period ${p}`);
        return result;
      })),
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
        
        // Debug Session Duration in cached data
        const sessionDurationMetrics = cachedDailyData.filter(m => m.metricName === 'Session Duration');
        
        // Group daily data into 6 periods (every 5-6 days) with averaged values, matching session duration groupings
        const dailyByDate: Record<string, any[]> = {};
        
        // First, group by day
        cachedDailyData.forEach(metric => {
          const dayKey = metric.timePeriod; // Format: 2025-07-daily-20250701
          if (!dailyByDate[dayKey]) {
            dailyByDate[dayKey] = [];
          }
          dailyByDate[dayKey].push(metric);
        
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
                // Debug Session Duration specifically
                if (metric.metricName === 'Session Duration') {
                }
              }
          
          // Calculate averages for each metric in this group
          Object.keys(allMetricsInGroup).forEach(metricKey => {
            const [metricName] = metricKey.split('-');
            const values = allMetricsInGroup[metricKey];
            const average = values.reduce((sum, val) => sum + val, 0) / values.length;
            
            groupedPeriods[periodKey].push({
              metricName,
            
            // Debug Session Duration grouping
            if (metricName === 'Session Duration') {
            }
        }
        
        // Replace the single-period data with grouped periods
        if (Object.keys(groupedPeriods).length > 0) {
          // For "Last Month" with daily data, we need to populate CD Average for all grouped periods
          // Get ONLY authentic CD_Avg data - do not use CD_Portfolio data as fallback
          const cdAvgMetrics = processedData.filter(m => m.sourceType === 'CD_Avg');
          
          // Add CD Average metrics to each grouped period so they appear as flat lines
          Object.keys(groupedPeriods).forEach(periodKey => {
            cdAvgMetrics.forEach(metric => {
              // Extract percentage from CD_Avg traffic channels for grouped periods
              let processedValue = metric.value;
              if ((metric.metricName === 'Traffic Channels' || metric.metricName === 'Device Distribution') && metric.sourceType === 'CD_Avg') {
                // Handle both string JSON and already parsed objects
                if (typeof metric.value === 'string' && metric.value.includes('{')) {
                  try {
                    const parsed = JSON.parse(metric.value);
                    processedValue = Number(parsed.percentage) || 0;
                    // Successfully parsed traffic/device data
                  } catch (e) {
                    // Failed to parse JSON data
                    processedValue = 0;
                  }
                } else if (typeof metric.value === 'object' && metric.value !== null && 'percentage' in metric.value) {
                  // Data already parsed by parseMetricPercentage()
                  processedValue = Number(metric.value.percentage) || 0;
                }
              }
              
              groupedPeriods[periodKey].push({
  
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

  // CD_Avg device distribution should come from authentic CD Portfolio company data only
  // Removed fallback logic to maintain data integrity

  // Extract traffic channel and device distribution data separately for chart components
  const trafficChannelMetrics = processedData.filter(m => m.metricName === 'Traffic Channels');
  const deviceDistributionMetrics = processedData.filter(m => m.metricName === 'Device Distribution');
  

  
  // Debug logging disabled for performance



  // Process device distribution metrics into frontend-expected structure
  const deviceDistribution = {
  };

  // Group device metrics by source type
  deviceDistributionMetrics.forEach(metric => {
    // Try multiple field names for device type
    const deviceType = metric.deviceType || metric.channel || metric.metricSubtype;
    
    // Handle different value formats - JSON for CD_Avg, simple numbers for Client
    let value = null;
    
    if (metric.sourceType === 'CD_Avg' && typeof metric.value === 'string' && metric.value.includes('{')) {
      // CD_Avg device data is stored as JSON - parse like traffic channels
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
    
    // Process device distribution data
    
    if (metric.sourceType === 'Client' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.client[deviceType] = value;
    } else if (metric.sourceType === 'CD_Avg' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.cdAvg[deviceType] = value;
    }

  // Device distribution processing complete

  const result = {
    client,
    competitors,
    trafficChannelMetrics, // Add separate traffic channel data for stacked bar chart
    deviceDistributionMetrics, // Add separate device distribution data for donut chart
    deviceDistribution, // Add processed device distribution for frontend charts
    // For multi-period queries OR "Last Month" (daily data), structure as time series
    ...(shouldCreateTimeSeriesData ? {
      timeSeriesData,
    } : {
    })
  };
  
  setCachedData(cacheKey, result, 5 * 60 * 1000); // 5 minutes cache
  return result;
}

function processMetricsData(
) {
  // Flatten and combine all metrics data efficiently
  const allMetrics = allMetricsArrays.flat();
  const allCompetitorMetrics = allCompetitorMetricsArrays.flat();
  const allFilteredIndustryMetrics = allFilteredIndustryMetricsArrays.flat();
  const allFilteredCdAvgMetrics = allFilteredCdAvgMetricsArrays.flat();
  

  

  
  // Helper function to process traffic channel data
  const processTrafficChannelData = (metrics: any[]): any[] => {

    
    const result: any[] = [];
    
    // Traffic channel data processing initialized
    
    metrics.forEach(m => {

      
      if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && m.channel) {
        // Individual channel record format (authentic data)
        let finalValue;
        
        // Use correct parser: parseMetricPercentage for both Traffic Channels and ALL Device Distribution data
        if (m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') {
          const percentageResult = parseMetricPercentage(m.value);
          finalValue = percentageResult ? percentageResult.percentage : 0;
        } else {
          finalValue = parseMetricValue(m.value);
        }
        
        result.push({
      } else if ((m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') && !m.channel) {
        // Parse GA4 JSON format: [{"channel": "Direct", "sessions": 4439, "percentage": 64.87...}]
        // DON'T use parseMetricValue for traffic channels - it returns null for JSON!
        const rawValue = m.value;
        
        if (typeof rawValue === 'string') {
          try {
            const channelData = JSON.parse(rawValue);
            if (Array.isArray(channelData)) {
              // GA4 JSON data parsed successfully
              
              channelData.forEach((channel: any) => {
                // Handle different property names for traffic channels vs device distribution
                const channelName = m.metricName === 'Device Distribution' 
                  ? (channel.device || channel.name || channel.channel)
                  : (channel.channel || channel.name);
                
                result.push({
            }
          } catch (e) {
            logger.warn('🚛 QUERY OPTIMIZER - Failed to parse traffic channel JSON:', {
            // Fallback for invalid JSON - keep original
            result.push({
          }
        } else if (Array.isArray(rawValue)) {
          // Already parsed JSON array
          // Pre-parsed channel data processed
          
          rawValue.forEach((channel: any) => {
            // Handle different property names for traffic channels vs device distribution
            const channelName = m.metricName === 'Device Distribution' 
              ? (channel.device || channel.name || channel.channel)
              : (channel.channel || channel.name);
            
            result.push({
        } else {
          logger.warn('🚛 QUERY OPTIMIZER - Unexpected traffic channel format:', {
        }
      } else if (m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') {
        // Traffic channel metric that doesn't match above patterns
        logger.warn('🚛 QUERY OPTIMIZER - Unhandled traffic channel format:', {
        
        // Still try to add it as a regular metric
        result.push({
      } else {
        // Regular metric - handle JSON-wrapped values from competitor data
        let finalValue = parseMetricValue(m.value);
        
        // Debug competitor metrics specifically
        if (m.sourceType === 'Competitor') {
        }
        
        result.push({
      }
    
    return result;
  };
  

  
  // Debug input data to processTrafficChannelData
  // Metrics processing summary logged

  // AGGRESSIVE DEBUGGING: Check CD_Avg raw data before processing
  const cdAvgRaw = allFilteredCdAvgMetrics.filter(m => m.metricName === 'Traffic Channels');
  logger.debug('CD_AVG RAW BEFORE PROCESSING:', {
    }))

  // Debug competitor metrics before processing
  console.error('🚨 COMPETITOR METRICS PIPELINE DEBUG:', {
    }))
  
  const processedData = [
    ...processTrafficChannelData(allMetrics.map(m => ({ ...m, sourceType: m.sourceType }))),
    ...processTrafficChannelData(allCompetitorMetrics.map(m => ({ ...m, sourceType: 'Competitor' }))),
    ...processTrafficChannelData(allFilteredIndustryMetrics.map(m => ({ ...m, sourceType: 'Industry_Avg' }))),
    ...processTrafficChannelData(allFilteredCdAvgMetrics.map(m => ({ ...m, sourceType: 'CD_Avg' })))
  ];
  
  // Debug competitor metrics after processing
  // Processed competitor metrics for analysis
  const processedCompetitorMetrics = processedData.filter(m => m.sourceType === 'Competitor');
  
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