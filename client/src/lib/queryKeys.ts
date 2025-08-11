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
   * Dashboard data query key
   * @param clientId - Client identifier
   * @param timePeriod - Time period for data filtering
   */
  dashboard: (clientId: string, timePeriod: string = "Last Month") => 
    ["/api/dashboard", clientId, timePeriod] as const,

  /**
   * Filter options query key
   */
  filters: () => 
    ["/api/filters"] as const,

  /**
   * AI insights query key
   * @param clientId - Client identifier  
   * @param timePeriod - Time period for insights
   */
  aiInsights: (clientId: string, timePeriod: string = "Last Month") => 
    ["/api/ai-insights", clientId, timePeriod] as const,

  /**
   * User data query key
   */
  user: () => 
    ["/api/user"] as const,

  /**
   * Server boot time query key
   */
  serverBootTime: () => 
    ["/api/server-boot-time"] as const,

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
   * Generic API cache invalidation helpers
   */
  allDashboards: () => ["/api/dashboard"] as const,
  allFilters: () => ["/api/filters"] as const,
} as const;

/**
 * Type helper for query key tuples
 */
export type QueryKeyTuple = ReturnType<typeof QueryKeys[keyof typeof QueryKeys]>;