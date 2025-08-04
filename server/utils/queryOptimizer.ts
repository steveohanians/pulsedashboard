// Database query optimization utilities
import { storage } from "../storage";

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

// Optimized filters query with caching
export async function getFiltersOptimized() {
  const cacheKey = 'filters';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
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
  industryVertical: string
) {
  const cacheKey = `dashboard-${client.id}-${periodsToQuery.join(',')}-${businessSize}-${industryVertical}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Prepare filters for industry data
  const filters = { businessSize, industryVertical };
  
  // Run all database queries in parallel with timeout protection
  const dataPromise = Promise.all([
    // Fetch metrics for all periods in parallel
    Promise.all(periodsToQuery.map(p => storage.getMetricsByClient(client.id, p))),
    // Fetch competitors (single call)
    storage.getCompetitorsByClient(client.id),
    // Fetch competitor metrics for all periods in parallel
    Promise.all(periodsToQuery.map(p => storage.getMetricsByCompetitors(client.id, p))),
    // Fetch filtered industry metrics for all periods in parallel
    Promise.all(periodsToQuery.map(p => storage.getFilteredIndustryMetrics(p, filters))),
    // Fetch filtered CD avg metrics for all periods in parallel
    Promise.all(periodsToQuery.map(p => storage.getFilteredCdAvgMetrics(p, filters))),
  ]);
  
  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database query timeout')), 5000)
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
  
  const result = {
    client,
    competitors,
    insights: [], // Load insights asynchronously
    // For multi-period queries (Last Quarter, Last Year), structure as time series
    ...(periodsToQuery.length > 1 ? {
      isTimeSeries: true,
      periods: periodsToQuery,
      timeSeriesData: groupMetricsByPeriod(processedData),
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
  
  // Helper function to process traffic channel data
  const processTrafficChannelData = (metrics: any[]): any[] => {
    const result: any[] = [];
    
    metrics.forEach(m => {
      if (m.metricName === 'Traffic Channels' && !m.channel && typeof m.value === 'string') {
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
        // Regular metric - keep as-is
        result.push({
          metricName: m.metricName,
          value: m.value,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId
        });
      }
    });
    
    return result;
  };
  
  return [
    ...processTrafficChannelData(allMetrics.map(m => ({ ...m, sourceType: m.sourceType }))),
    ...processTrafficChannelData(allCompetitorMetrics.map(m => ({ ...m, sourceType: 'Competitor' }))),
    ...processTrafficChannelData(allFilteredIndustryMetrics.map(m => ({ ...m, sourceType: 'Industry_Avg' }))),
    ...processTrafficChannelData(allFilteredCdAvgMetrics.map(m => ({ ...m, sourceType: 'CD_Avg' })))
  ];
}

// Group metrics by time period for time series charts
function groupMetricsByPeriod(metrics: any[]): Record<string, any[]> {
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

// Separate function for heavy data (charts, metrics) - lazy loaded
export async function getDashboardMetricsOptimized(clientId: string, filters: any) {
  const cacheKey = `metrics-${clientId}-${JSON.stringify(filters)}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // This function needs to be implemented - placeholder for now
  const metrics: any[] = [];
  const benchmarks: any[] = [];
  
  const metricsData = { metrics, benchmarks };
  setCachedData(cacheKey, metricsData, 2 * 60 * 1000); // 2 minutes
  return metricsData;
}