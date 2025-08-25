/**
 * Centralized React Query key generators for consistent caching
 * 
 * All query keys should be defined here to ensure:
 * - Consistent hierarchical structure
 * - Type safety with tuple returns
 * - Easy cache invalidation patterns
 * - Prevention of string-based query keys
 */

export const QueryKeys = {
  /**
   * Dashboard data query key (supports canonical time periods and filters)
   * @param clientId - Client identifier
   * @param timePeriod - Time period for data filtering (string or canonical object)
   * @param businessSize - Business size filter
   * @param industryVertical - Industry vertical filter
   */
  dashboard: (clientId: string, timePeriod: any = "Last Month", businessSize?: string, industryVertical?: string) => 
    ["/api/dashboard", clientId, timePeriod, businessSize, industryVertical] as const,

  /**
   * Filter options query key
   */
  filters: () => 
    ["/api/filters"] as const,

  /**
   * AI insights query key (supports canonical time periods)
   * @param clientId - Client identifier  
   * @param timePeriod - Time period for insights (string or canonical object)
   */
  aiInsights: (clientId: string, timePeriod: any = "Last Month") => 
    ["/api/ai-insights", clientId, timePeriod] as const,

  /**
   * User data query key
   */
  user: () => 
    ["/api/user"] as const,


  /**
   * Competitors query key
   * @param clientId - Client identifier
   */
  competitors: (clientId: string) => 
    ["/api/competitors", clientId] as const,

  /**
   * Metric insights query key (legacy support)
   * @param clientId - Client identifier
   */
  metricInsights: (clientId: string) => 
    ["/api/metric-insights", clientId] as const,

  /**
   * Insight context query key
   * @param clientId - Client identifier
   * @param metricName - Metric name for context
   */
  insightContext: (clientId: string, metricName: string, period?: string) => 
    ["/api/insight-context", clientId, metricName, period] as const,

  /**
   * Generic API cache invalidation helpers
   */
  allDashboards: () => ["/api/dashboard"] as const,
  allFilters: () => ["/api/filters"] as const,
} as const;

/**
 * Type helper for query key tuples
 */
export type QueryKeyTuple = ReturnType<typeof QueryKeys[keyof typeof QueryKeys]>;