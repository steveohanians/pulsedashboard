import { storage } from "../../storage";
import { parseMetricValue, parseMetricPercentage } from "../metricParser";
import logger from "../logging/logger";

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
    const keysToDelete = [];
    for (const key of Array.from(queryCache.keys())) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => queryCache.delete(key));
    console.log(`Cache cleared: deleted ${keysToDelete.length} keys matching pattern "${pattern}"`);
  } else {
    const totalKeys = queryCache.size;
    queryCache.clear();
    console.log(`Cache cleared: deleted all ${totalKeys} keys`);
  }
}

export function debugCacheKeys(): string[] {
  return Array.from(queryCache.keys());
}

/**
 * Layer B: Daily → Monthly Coalescing Functions
 * Aggregates daily metrics into monthly rollups when monthly data is missing
 */

interface DailyMetric {
  metricName: string;
  value: any;
  sourceType: string;
  timePeriod: string;
  sessions?: number;
  users?: number;
  channel?: string;
  competitorId?: string;
}

interface AggregatedMetric {
  metricName: string;
  value: number;
  sourceType: string;
  timePeriod: string;
  channel?: string;
  competitorId?: string;
}

/**
 * Safely parses numeric values from various formats
 */
function safeParseNumeric(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle quoted strings like "162.94"
    const cleaned = value.replace(/['"]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Aggregates Bounce Rate from daily metrics using weighted average by sessions
 */
function aggregateBounceRate(dailyMetrics: DailyMetric[]): number {
  let totalWeightedBounceRate = 0;
  let totalSessions = 0;
  
  for (const metric of dailyMetrics) {
    const bounceRate = safeParseNumeric(metric.value);
    const sessions = safeParseNumeric(metric.sessions) || 1; // Fallback to 1 if sessions not available
    
    totalWeightedBounceRate += bounceRate * sessions;
    totalSessions += sessions;
  }
  
  return totalSessions > 0 ? totalWeightedBounceRate / totalSessions : 0;
}

/**
 * Aggregates Session Duration from daily metrics using weighted average by sessions  
 */
function aggregateSessionDuration(dailyMetrics: DailyMetric[]): number {
  let totalWeightedDuration = 0;
  let totalSessions = 0;
  
  for (const metric of dailyMetrics) {
    const duration = safeParseNumeric(metric.value);
    const sessions = safeParseNumeric(metric.sessions) || 1; // Fallback to 1 if sessions not available
    
    totalWeightedDuration += duration * sessions;
    totalSessions += sessions;
  }
  
  return totalSessions > 0 ? totalWeightedDuration / totalSessions : 0;
}

/**
 * Aggregates Pages per Session from daily metrics using weighted average by sessions
 */
function aggregatePagesPerSession(dailyMetrics: DailyMetric[]): number {
  let totalWeightedPages = 0;
  let totalSessions = 0;
  
  for (const metric of dailyMetrics) {
    const pagesPerSession = safeParseNumeric(metric.value);
    const sessions = safeParseNumeric(metric.sessions) || 1; // Fallback to 1 if sessions not available
    
    totalWeightedPages += pagesPerSession * sessions;
    totalSessions += sessions;
  }
  
  return totalSessions > 0 ? totalWeightedPages / totalSessions : 0;
}

/**
 * Aggregates Sessions per User from daily metrics: sum(sessions) / sum(users)
 */
function aggregateSessionsPerUser(dailyMetrics: DailyMetric[]): number {
  let totalSessions = 0;
  let totalUsers = 0;
  
  for (const metric of dailyMetrics) {
    const sessions = safeParseNumeric(metric.sessions) || safeParseNumeric(metric.value);
    const users = safeParseNumeric(metric.users) || 1; // Fallback to 1 if users not available
    
    totalSessions += sessions;
    totalUsers += users;
  }
  
  return totalUsers > 0 ? totalSessions / totalUsers : 0;
}

/**
 * Main coalescing function: converts daily metrics to monthly rollups
 */
function coalesceDailyToMonthly(dailyMetrics: DailyMetric[], targetMonth: string): AggregatedMetric[] {
  const monthlyMetrics: AggregatedMetric[] = [];
  
  // Group daily metrics by metricName and sourceType
  const groupedMetrics = new Map<string, DailyMetric[]>();
  
  for (const metric of dailyMetrics) {
    const key = `${metric.metricName}-${metric.sourceType}`;
    if (!groupedMetrics.has(key)) {
      groupedMetrics.set(key, []);
    }
    groupedMetrics.get(key)!.push(metric);
  }
  
  // Aggregate each group into monthly metrics
  for (const [key, metrics] of groupedMetrics) {
    const [metricName, sourceType] = key.split('-');
    let aggregatedValue = 0;
    
    // Apply appropriate aggregation function based on metric name
    switch (metricName) {
      case 'Bounce Rate':
        aggregatedValue = aggregateBounceRate(metrics);
        break;
      case 'Session Duration':
        aggregatedValue = aggregateSessionDuration(metrics);
        break;
      case 'Pages per Session':
        aggregatedValue = aggregatePagesPerSession(metrics);
        break;
      case 'Sessions per User':
        aggregatedValue = aggregateSessionsPerUser(metrics);
        break;
      default:
        // For other metrics, use simple average
        aggregatedValue = metrics.reduce((sum, m) => sum + safeParseNumeric(m.value), 0) / metrics.length;
    }
    
    // Create aggregated metric
    const aggregated: AggregatedMetric = {
      metricName,
      value: aggregatedValue,
      sourceType,
      timePeriod: targetMonth,
      // Include channel/competitorId if present in source metrics
      channel: metrics[0].channel,
      competitorId: metrics[0].competitorId
    };
    
    monthlyMetrics.push(aggregated);
  }
  
  logger.info(`📊 Coalesced ${dailyMetrics.length} daily metrics into ${monthlyMetrics.length} monthly metrics for ${targetMonth}`, {
    targetMonth,
    dailyCount: dailyMetrics.length,
    monthlyCount: monthlyMetrics.length,
    metricsCoalesced: Array.from(groupedMetrics.keys())
  });
  
  return monthlyMetrics;
}

async function generateCdAvgDeviceDistributionIfMissing(
  clientId: string, 
  periodsToQuery: string[], 
  processedData: any[]
): Promise<void> {
  try {
    const existingCdAvgDeviceData = processedData.filter(
      m => m.metricName === 'Device Distribution' && m.sourceType === 'CD_Avg'
    );
    
    if (existingCdAvgDeviceData.length > 0) {
      logger.debug('CD_Avg device distribution data already exists, skipping generation');
      return;
    }

    const clientDeviceData = processedData.filter(
      m => m.metricName === 'Device Distribution' && m.sourceType === 'Client'
    );
    
    if (clientDeviceData.length === 0) {
      logger.debug('No client device distribution data available for CD_Avg generation');
      return;
    }

    const deviceAverages = new Map<string, number[]>();
    
    clientDeviceData.forEach(metric => {
      if (metric.channel && typeof metric.value === 'number') {
        if (!deviceAverages.has(metric.channel)) {
          deviceAverages.set(metric.channel, []);
        }
        deviceAverages.get(metric.channel)!.push(metric.value);
      }
    });

    for (const period of periodsToQuery) {
      for (const [deviceName, values] of Array.from(deviceAverages.entries())) {
        if (values.length > 0) {
          const avgPercentage = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
          
          await storage.createMetric({
            clientId: null,
            metricName: 'Device Distribution',
            value: avgPercentage,
            sourceType: 'CD_Avg',
            timePeriod: period,
            channel: deviceName
          });

          processedData.push({
            metricName: 'Device Distribution',
            value: avgPercentage,
            sourceType: 'CD_Avg',
            timePeriod: period,
            channel: deviceName,
            competitorId: null
          });
        }
      }
    }

    logger.info('Generated authentic CD_Avg device distribution data', {
      clientId,
      periodsCount: periodsToQuery.length,
      deviceTypes: Array.from(deviceAverages.keys()),
      averageDesktop: deviceAverages.get('Desktop') ? 
        (deviceAverages.get('Desktop')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Desktop')!.length).toFixed(1) : 'N/A',
      averageMobile: deviceAverages.get('Mobile') ? 
        (deviceAverages.get('Mobile')!.reduce((a, b) => a + b, 0) / deviceAverages.get('Mobile')!.length).toFixed(1) : 'N/A'
    });

  } catch (error) {
    logger.error('Error generating CD_Avg device distribution data:', error);
  }
}

export async function getFiltersOptimized() {
  const cacheKey = 'filters';
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  const benchmarkCompanies = await storage.getBenchmarkCompanies();
  
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
  
  setCachedData(cacheKey, data, 5 * 60 * 1000);
  return data;
}

export async function getDashboardDataOptimized(
  client: any,
  periodsToQuery: string[],
  businessSize: string,
  industryVertical: string,
  timePeriod?: string
) {
  console.log('🎯 getDashboardDataOptimized CALLED with periods:', periodsToQuery, 'timePeriod:', timePeriod);
  logger.info('🔴 DASHBOARD FUNCTION CALLED - CLIENT: ' + client.id);
  
  clearCache();
  logger.info('🚛 QUERY CACHE CLEARED - Forcing fresh CD_Avg traffic channel processing');

  const cacheKey = `dashboard-${client.id}-${periodsToQuery.join(',')}-${businessSize}-${industryVertical}`;
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  const filters = { businessSize, industryVertical };
  
  // Check for both canonical and raw "Last Month" formats - moved up for early use
  const isLastMonth = timePeriod === 'Last Month' || timePeriod === 'LAST_MONTH' || timePeriod === 'last_month';
  
  if (periodsToQuery.includes('2025-07') || periodsToQuery.includes('2025-06')) {
    const lastMonthPeriod = periodsToQuery.find(p => p === '2025-07' || p === '2025-06');
    if (lastMonthPeriod) {
      try {
        const dailyMetrics = await storage.getDailyClientMetrics(client.id, lastMonthPeriod);
        if (dailyMetrics.length > 0) {
          setCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`, dailyMetrics, 5 * 60 * 1000);
        } else {
          console.log(`No daily metrics found for ${lastMonthPeriod}, falling back to monthly metrics`);
          const monthlyMetrics = await storage.getMetricsByClient(client.id, lastMonthPeriod);
          if (monthlyMetrics.length > 0) {
            setCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`, monthlyMetrics, 5 * 60 * 1000);
          }
        }
      } catch (error) {
        console.warn('Could not fetch daily or monthly metrics:', error);
      }
    }
  }

  let dataPromise;
  
  if (periodsToQuery.length > 10) {
    dataPromise = (async () => {
      const [competitors] = await Promise.all([
        storage.getCompetitorsByClient(client.id)
      ]);
      
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
      Promise.all(periodsToQuery.map(p => {
        console.log(`🔍 OPTIMIZER: About to call getFilteredCdAvgMetrics with period: ${p}, filters: ${JSON.stringify(filters)}`);
        return storage.getFilteredCdAvgMetrics(p, filters);
      })),
    ]);
  }
  
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
  
  let processedData = processMetricsData(
    allMetricsArrays,
    allCompetitorMetricsArrays,
    allFilteredIndustryMetricsArrays,
    allFilteredCdAvgMetricsArrays,
    periodsToQuery
  );

  // Layer B: Apply daily → monthly coalescing when monthly data is missing but daily exists  
  if (isLastMonth && periodsToQuery.length === 1) {
    const targetMonth = periodsToQuery[0]; // Should be 2025-07
    
    // Check if monthly data exists for simple metrics
    const simpleMetrics = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
    const existingMonthlyMetrics = processedData.filter(m => 
      simpleMetrics.includes(m.metricName) && 
      m.sourceType === 'Client' && 
      m.timePeriod === targetMonth
    );
    
    if (existingMonthlyMetrics.length === 0) {
      logger.info(`🔧 No monthly data found for ${targetMonth}, attempting daily → monthly coalescing`);
      
      // Fetch daily metrics for the target month
      try {
        const dailyPattern = `${targetMonth}-daily-%`;
        const dailyMetrics = await storage.getMetricsForTimePeriodPattern(client.id, dailyPattern);
        
        if (dailyMetrics.length > 0) {
          logger.info(`📊 Found ${dailyMetrics.length} daily metrics for coalescing to ${targetMonth}`);
          
          // Filter to only simple metrics for coalescing
          const dailySimpleMetrics = dailyMetrics.filter(m => simpleMetrics.includes(m.metricName));
          
          if (dailySimpleMetrics.length > 0) {
            // Apply coalescing
            const coalescedMetrics = coalesceDailyToMonthly(dailySimpleMetrics, targetMonth);
            
            // Add coalesced metrics to processedData
            processedData.push(...coalescedMetrics);
            
            logger.info(`✅ Successfully coalesced ${coalescedMetrics.length} monthly metrics from ${dailySimpleMetrics.length} daily records`);
          } else {
            logger.warn(`⚠️ No daily simple metrics found for coalescing in ${targetMonth}`);
          }
        } else {
          logger.warn(`⚠️ No daily metrics found for pattern ${dailyPattern}`);
        }
      } catch (error) {
        logger.error(`❌ Daily → monthly coalescing failed for ${targetMonth}`, error);
      }
    } else {
      logger.info(`✓ Monthly data already exists for ${targetMonth}, skipping coalescing`);
    }
  }
  

  
  const shouldCreateTimeSeriesData = periodsToQuery.length > 1 || isLastMonth;
  let timeSeriesData = shouldCreateTimeSeriesData ? groupMetricsByPeriod(processedData) : undefined;
  
  logger.info(`🔍 TIME SERIES LOGIC: timePeriod="${timePeriod}", isLastMonth=${isLastMonth}, shouldCreateTimeSeriesData=${shouldCreateTimeSeriesData}, periodsCount=${periodsToQuery.length}`);
  
  if (isLastMonth && shouldCreateTimeSeriesData) {
    try {
      const lastMonthPeriod = periodsToQuery[0]; // Should be 2025-07
      
      // FIRST: Try to actively fetch daily GA4 data for Last Month grouping
      logger.info(`🔍 LAST MONTH LOGIC: Actively fetching daily GA4 data for ${lastMonthPeriod}`);
      
      let dailyDataForGrouping = null;
      try {
        const dailyPattern = `${lastMonthPeriod}-daily-%`;
        const freshDailyMetrics = await storage.getMetricsForTimePeriodPattern(client.id, dailyPattern);
        
        if (freshDailyMetrics.length > 0) {
          logger.info(`📊 DAILY GA4 FETCH SUCCESS: Found ${freshDailyMetrics.length} daily metrics for grouping`);
          dailyDataForGrouping = freshDailyMetrics;
        } else {
          logger.warn(`⚠️ DAILY GA4 FETCH: No daily metrics found for pattern ${dailyPattern}`);
        }
      } catch (error) {
        logger.error(`❌ DAILY GA4 FETCH ERROR: ${error}`);
      }
      
      // FALLBACK: Check cached daily data if fresh fetch failed
      if (!dailyDataForGrouping) {
        const cachedDailyData = getCachedData(`daily-metrics-${client.id}-${lastMonthPeriod}`);
        if (cachedDailyData && Array.isArray(cachedDailyData) && cachedDailyData.length > 0) {
          logger.info(`📦 FALLBACK: Using ${cachedDailyData.length} cached daily metrics for grouping`);
          dailyDataForGrouping = cachedDailyData;
        }
      }
      
      if (dailyDataForGrouping && Array.isArray(dailyDataForGrouping) && dailyDataForGrouping.length > 0) {
        // Log daily data details for debugging
        const simpleMetrics = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
        const dailySimpleMetrics = dailyDataForGrouping.filter(m => simpleMetrics.includes(m.metricName));
        
        logger.info(`📊 DAILY DATA BREAKDOWN: Total: ${dailyDataForGrouping.length}, Simple metrics: ${dailySimpleMetrics.length}`);
        
        simpleMetrics.forEach(metricName => {
          const count = dailySimpleMetrics.filter(m => m.metricName === metricName).length;
          logger.info(`  - ${metricName}: ${count} daily records`);
        });
        
        const dailyByDate: Record<string, any[]> = {};
        dailyDataForGrouping.forEach(metric => {
          const dayKey = metric.timePeriod; // Format: 2025-07-daily-20250701
          if (!dailyByDate[dayKey]) {
            dailyByDate[dayKey] = [];
          }
          dailyByDate[dayKey].push(metric);
        });
        
        const sortedDays = Object.keys(dailyByDate).sort();
        const daysInMonth = sortedDays.length;
        const groupSize = Math.ceil(daysInMonth / 5); // Target 5 groups as per requirements
        
        logger.info(`📅 GROUPING STRATEGY: ${daysInMonth} days → 5 groups of ~${groupSize} days each`);
        
        const groupedPeriods: Record<string, any[]> = {};
        
        for (let i = 0; i < 5; i++) {
          const startIdx = i * groupSize;
          const endIdx = Math.min(startIdx + groupSize, daysInMonth);
          const daysInGroup = sortedDays.slice(startIdx, endIdx);
          
          if (daysInGroup.length === 0) break;
          
          const firstDay = daysInGroup[0].split('-daily-')[1];
          const lastDay = daysInGroup[daysInGroup.length - 1].split('-daily-')[1];
          
          // Convert YYYYMMDD to readable dates for logging
          const firstDate = `${firstDay.substring(0, 4)}-${firstDay.substring(4, 6)}-${firstDay.substring(6, 8)}`;
          const lastDate = `${lastDay.substring(0, 4)}-${lastDay.substring(4, 6)}-${lastDay.substring(6, 8)}`;
          
          const periodKey = `${lastMonthPeriod}-group-${i + 1}`;
          groupedPeriods[periodKey] = [];
          
          logger.info(`📊 GROUP ${i + 1}: ${firstDate} to ${lastDate} (${daysInGroup.length} days)`);
          
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
                if (metric.metricName === 'Session Duration') {
                  logger.debug(`Session Duration daily value added: ${parsedValue} from ${dayKey}`);
                }
              }
            });
          });
          
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
            
            // Log each simple metric grouping
            if (simpleMetrics.includes(metricName)) {
              logger.info(`  → ${metricName}: ${average.toFixed(2)} (avg of ${values.length} daily values)`);
            }
          });
        }
        
        if (Object.keys(groupedPeriods).length > 0) {
          logger.info(`✅ CREATED ${Object.keys(groupedPeriods).length} grouped periods for Last Month time series`);
          
          // Add competitor and CD_Avg metrics as single monthly points across all groups
          const competitorMetrics = processedData.filter(m => m.sourceType === 'Competitor');
          const cdAvgMetrics = processedData.filter(m => m.sourceType === 'CD_Avg');
          
          logger.info(`📈 ADDING MONTHLY DATA: ${competitorMetrics.length} competitor metrics, ${cdAvgMetrics.length} CD_Avg metrics`);
          
          Object.keys(groupedPeriods).forEach(periodKey => {
            // Add both CD_Avg and Competitor metrics to each grouped period
            [...cdAvgMetrics, ...competitorMetrics].forEach(metric => {
              let processedValue = metric.value;
              if ((metric.metricName === 'Traffic Channels' || metric.metricName === 'Device Distribution') && metric.sourceType === 'CD_Avg') {
                if (typeof metric.value === 'string' && metric.value.includes('{')) {
                  try {
                    const parsed = JSON.parse(metric.value);
                    processedValue = Number(parsed.percentage) || 0;
                    console.log('🔍 GROUPED PERIODS JSON PARSE SUCCESS:', {
                      metricName: metric.metricName,
                      sourceType: metric.sourceType,
                      periodKey: periodKey,
                      parsedPercentage: processedValue,
                      channel: metric.channel
                    });
                  } catch (e) {
                    console.log('🔍 GROUPED PERIODS JSON PARSE ERROR:', e, 'Metric:', metric.metricName, 'Value:', metric.value);
                    processedValue = 0;
                  }
                } else if (typeof metric.value === 'object' && metric.value !== null && 'percentage' in metric.value) {
                  processedValue = Number(metric.value.percentage) || 0;
                }
              }
              
              groupedPeriods[periodKey].push({
                metricName: metric.metricName,
                value: processedValue,
                sourceType: metric.sourceType, // Keep original sourceType (CD_Avg or Competitor)
                timePeriod: periodKey,
                channel: metric.channel,
                competitorId: metric.competitorId || null
              });
            });
          });
  
          timeSeriesData = groupedPeriods;
          periodsToQuery = Object.keys(groupedPeriods).sort();
          
          // Log final payload structure 
          logger.info(`🎯 FINAL TIME SERIES PAYLOAD: ${periodsToQuery.length} periods`);
          periodsToQuery.forEach(period => {
            const periodData = groupedPeriods[period];
            const clientCount = periodData.filter(m => m.sourceType === 'Client').length;
            const competitorCount = periodData.filter(m => m.sourceType === 'Competitor').length;
            const cdAvgCount = periodData.filter(m => m.sourceType === 'CD_Avg').length;
            logger.info(`  ${period}: Client=${clientCount}, Competitor=${competitorCount}, CD_Avg=${cdAvgCount}`);
          });
        }
      } else {
        logger.warn(`❌ NO DAILY DATA: Cannot create grouped time series for Last Month - falling back to single monthly points`);
      }
    } catch (error) {
      logger.error('Could not create daily grouped time series:', error);
    }
  }
  
  if (timeSeriesData && Object.keys(timeSeriesData).length > 0) {
    const firstPeriod = Object.keys(timeSeriesData)[0];
    const firstPeriodData = timeSeriesData[firstPeriod];
    const competitorCount = firstPeriodData.filter(m => m.sourceType === 'Competitor').length;
  }

  const trafficChannelMetrics = processedData.filter(m => m.metricName === 'Traffic Channels');
  const deviceDistributionMetrics = processedData.filter(m => m.metricName === 'Device Distribution');
  

  
  // Debug logging disabled for performance



  // Process device distribution metrics into frontend-expected structure
  const deviceDistribution = {
    client: {} as any,
    cdAvg: {} as any
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
        console.log('🔍 DEVICE JSON PARSE ERROR:', error, 'Raw value:', metric.value);
        value = null;
      }
    } else if (metric.valuePreview !== undefined) {
      value = parseFloat(String(metric.valuePreview).replace('%', ''));
    } else if (metric.value !== undefined) {
      value = parseFloat(String(metric.value).replace('%', ''));
    }
    
    // Debug each metric to understand the structure
    console.log('Device metric debug:', {
      sourceType: metric.sourceType,
      deviceType: deviceType,
      valuePreview: metric.valuePreview,
      rawValue: metric.value,
      valueType: typeof metric.value,
      timePeriod: metric.timePeriod,
      parsedValue: value,
      hasValueProperty: 'value' in metric,
      allMetricKeys: Object.keys(metric),
      isJSON: metric.sourceType === 'CD_Avg' && typeof metric.value === 'string' && metric.value.includes('{')
    });
    
    if (metric.sourceType === 'Client' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.client[deviceType] = value;
    } else if (metric.sourceType === 'CD_Avg' && deviceType && value !== null && !isNaN(value)) {
      deviceDistribution.cdAvg[deviceType] = value;
    }
  });

  // Debug logging for device distribution structure
  console.log('🔍 DEVICE DEBUG - Processed deviceDistribution:', {
    client: deviceDistribution.client,
    cdAvg: deviceDistribution.cdAvg,
    rawMetricsCount: deviceDistributionMetrics.length
  });

  const result = {
    client,
    competitors,
    insights: [], // Load insights asynchronously
    trafficChannelMetrics, // Add separate traffic channel data for stacked bar chart
    deviceDistributionMetrics, // Add separate device distribution data for donut chart
    deviceDistribution, // Add processed device distribution for frontend charts
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
          console.log('🔍 PARSE SUCCESS - Device Distribution:', {
            metricName: m.metricName,
            sourceType: m.sourceType,
            channel: m.channel,
            rawValue: m.value,
            parsedPercentage: finalValue
          });
        } else {
          finalValue = parseMetricValue(m.value);
        }
        
        result.push({
          metricName: m.metricName,
          value: finalValue,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId || m.competitor_id // Handle both field formats
        });
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
                  metricName: m.metricName,
                  value: channel.percentage || channel.value || channel.sessions,
                  sourceType: m.sourceType,
                  timePeriod: m.timePeriod,
                  channel: channelName,
                  competitorId: m.competitorId
                });
              });
            }
          } catch (e) {
            logger.warn('🚛 QUERY OPTIMIZER - Failed to parse traffic channel JSON:', {
              sourceType: m.sourceType,
              timePeriod: m.timePeriod,
              value: rawValue,
              error: e
            });
            // Fallback for invalid JSON - keep original
            result.push({
              metricName: m.metricName,
              value: rawValue,
              sourceType: m.sourceType,
              timePeriod: m.timePeriod,
              channel: m.channel,
              competitorId: m.competitorId
            });
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
              metricName: m.metricName,
              value: channel.percentage || channel.value || channel.sessions,
              sourceType: m.sourceType,
              timePeriod: m.timePeriod,
              channel: channelName,
              competitorId: m.competitorId
            });
          });
        } else {
          logger.warn('🚛 QUERY OPTIMIZER - Unexpected traffic channel format:', {
            sourceType: m.sourceType,
            timePeriod: m.timePeriod,
            valueType: typeof rawValue,
            value: rawValue
          });
        }
      } else if (m.metricName === 'Traffic Channels' || m.metricName === 'Device Distribution') {
        // Traffic channel metric that doesn't match above patterns
        logger.warn('🚛 QUERY OPTIMIZER - Unhandled traffic channel format:', {
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          valueType: typeof m.value,
          hasChannel: !!m.channel,
          value: m.value
        });
        
        // Still try to add it as a regular metric
        result.push({
          metricName: m.metricName,
          value: parseMetricValue(m.value),
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId
        });
      } else {
        // Regular metric - handle JSON-wrapped values from competitor data
        let finalValue = parseMetricValue(m.value);
        
        // Debug competitor metrics specifically
        if (m.sourceType === 'Competitor') {
          console.log('🔍 COMPETITOR METRIC DEBUG IN PROCESSING:', {
            metricName: m.metricName,
            sourceType: m.sourceType,
            rawValue: m.value,
            valueType: typeof m.value,
            valueString: typeof m.value === 'string' ? m.value.substring(0, 100) : 'not-string',
            parsedValue: finalValue,
            competitorId: m.competitorId || m.competitor_id
          });
        }
        
        result.push({
          metricName: m.metricName,
          value: finalValue,
          sourceType: m.sourceType,
          timePeriod: m.timePeriod,
          channel: m.channel,
          competitorId: m.competitorId || m.competitor_id // Handle both field formats
        });
      }
    });
    
    return result;
  };
  

  
  const cdAvgRaw = allFilteredCdAvgMetrics.filter(m => m.metricName === 'Traffic Channels');
  logger.debug('CD_AVG RAW BEFORE PROCESSING:', {
    count: cdAvgRaw.length,
    samples: cdAvgRaw.slice(0, 2).map(m => ({
      value: m.value,
      type: typeof m.value,
      channel: m.channel,
      valuePreview: typeof m.value === 'string' ? m.value.substring(0, 50) : m.value
    }))
  });

  console.error('🚨 COMPETITOR METRICS PIPELINE DEBUG:', {
    rawCompetitorCount: allCompetitorMetrics.length,
    periodsQueried: periodsToQuery,
    competitorSample: allCompetitorMetrics.slice(0, 3).map(m => ({
      metricName: m.metricName,
      value: m.value,
      valueType: typeof m.value,
      valueIsNull: m.value === null,
      hasValueProp: m.value && typeof m.value === 'object' && 'value' in m.value,
      competitorId: m.competitorId || m.competitor_id,
      timePeriod: m.timePeriod
    }))
  });
  
  const processedData = [
    ...processTrafficChannelData(allMetrics.map(m => ({ ...m, sourceType: m.sourceType }))),
    ...processTrafficChannelData(allCompetitorMetrics.map(m => ({ ...m, sourceType: 'Competitor' }))),
    ...processTrafficChannelData(allFilteredIndustryMetrics.map(m => ({ ...m, sourceType: 'Industry_Avg' }))),
    ...processTrafficChannelData(allFilteredCdAvgMetrics.map(m => ({ ...m, sourceType: 'CD_Avg' })))
  ];
  
  const processedCompetitorMetrics = processedData.filter(m => m.sourceType === 'Competitor');
  console.log('🔍 COMPETITOR METRICS DEBUG AFTER PROCESSING:', {
    count: processedCompetitorMetrics.length,
    sampleValues: processedCompetitorMetrics.slice(0, 3).map(m => ({
      metricName: m.metricName,
      value: m.value,
      valueType: typeof m.value,
      competitorId: m.competitorId,
      timePeriod: m.timePeriod
    }))
  });
  
  return processedData;
}

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

export async function getDashboardMetricsOptimized(clientId: string, filters: any) {
  const cacheKey = `metrics-${clientId}-${JSON.stringify(filters)}`;
  // TEMPORARILY DISABLED: const cached = getCachedData(cacheKey);
  // TEMPORARILY DISABLED: if (cached) return cached;
  
  const metrics: any[] = [];
  const benchmarks: any[] = [];
  
  const metricsData = { metrics, benchmarks };
  setCachedData(cacheKey, metricsData, 2 * 60 * 1000);
  return metricsData;
}