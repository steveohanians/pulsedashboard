// Database query optimization utilities
import { performanceCache } from '../cache/performance-cache';
import { storage } from '../storage';
import { parseMetricValue } from './metricParser';
import logger from './logger';

// Optimized query for filtered metrics with caching
export async function getFilteredMetricsOptimized(
  timePeriod: string,
  filters: { businessSize: string; industryVertical: string },
  type: 'industry' | 'cd_avg'
): Promise<any[]> {
  const cacheKey = `filtered_${type}_${timePeriod}_${filters.businessSize}_${filters.industryVertical}`;
  
  // Check cache first
  const cached = performanceCache.get(cacheKey);
  if (cached) {
    logger.debug(`Cache HIT for filtered metrics: ${cacheKey}`);
    return cached;
  }
  
  // Fetch from database
  const result = type === 'industry' 
    ? await storage.getFilteredIndustryMetrics(timePeriod, filters)
    : await storage.getFilteredCdAvgMetrics(timePeriod, filters);
  
  // Cache the result
  performanceCache.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes TTL
  logger.debug(`Cached filtered metrics: ${cacheKey} (${result.length} records)`);
  
  return result;
}

// Batch fetch multiple periods with intelligent caching
export async function batchFetchMetrics(
  clientId: string,
  periods: string[],
  filters: { businessSize: string; industryVertical: string }
): Promise<{
  clientMetrics: any[][];
  competitorMetrics: any[][];
  industryMetrics: any[][];
  cdAvgMetrics: any[][];
}> {
  // Create all promises for parallel execution
  const clientPromises = periods.map(p => {
    const cacheKey = `client_metrics_${clientId}_${p}`;
    const cached = performanceCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    
    return storage.getMetricsByClient(clientId, p).then(result => {
      performanceCache.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    });
  });

  const competitorPromises = periods.map(p => {
    const cacheKey = `competitor_metrics_${clientId}_${p}`;
    const cached = performanceCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    
    return storage.getMetricsByCompetitors(clientId, p).then(result => {
      performanceCache.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    });
  });

  const industryPromises = periods.map(p => 
    getFilteredMetricsOptimized(p, filters, 'industry')
  );

  const cdAvgPromises = periods.map(p => 
    getFilteredMetricsOptimized(p, filters, 'cd_avg')
  );

  // Execute all in parallel
  const [clientMetrics, competitorMetrics, industryMetrics, cdAvgMetrics] = await Promise.all([
    Promise.all(clientPromises),
    Promise.all(competitorPromises),
    Promise.all(industryPromises),
    Promise.all(cdAvgPromises)
  ]);

  return { clientMetrics, competitorMetrics, industryMetrics, cdAvgMetrics };
}

// Pre-aggregate commonly used metrics
export async function preAggregateMetrics(
  metrics: any[],
  type: 'average' | 'sum' | 'latest'
): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    // Use setImmediate to avoid blocking the event loop
    setImmediate(() => {
      const aggregated: Record<string, number> = {};
      
      if (type === 'average') {
        const grouped: Record<string, number[]> = {};
        
        metrics.forEach(m => {
          if (!grouped[m.metricName]) grouped[m.metricName] = [];
          grouped[m.metricName].push(parseMetricValue(m.value) || 0);
        });
        
        Object.entries(grouped).forEach(([name, values]) => {
          aggregated[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
        });
      }
      // Add other aggregation types as needed
      
      resolve(aggregated);
    });
  });
}

// Intelligent cache warming for frequently accessed data
export async function warmCache(clientId: string): Promise<void> {
  try {
    logger.info(`Warming cache for client: ${clientId}`);
    
    // Pre-load current month data which is most frequently accessed
    const currentDate = new Date();
    const currentPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const commonFilters = [
      { businessSize: 'All', industryVertical: 'All' },
      { businessSize: 'Mid-Market (100-500 employees)', industryVertical: 'All' },
      { businessSize: 'All', industryVertical: 'SaaS/Technology' }
    ];
    
    // Pre-load in background
    const warmupPromises = commonFilters.map(filters => 
      batchFetchMetrics(clientId, [currentPeriod], filters)
    );
    
    await Promise.all(warmupPromises);
    logger.info(`Cache warmed for client: ${clientId}`);
  } catch (error) {
    logger.error('Cache warming failed:', error);
  }
}