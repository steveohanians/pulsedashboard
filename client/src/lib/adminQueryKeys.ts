/**
 * Query keys for admin panel endpoints
 * Keeps admin-specific query keys separate from main app query keys
 */

export const AdminQueryKeys = {
  clients: () => ["/api/admin/clients"] as const,
  benchmarkCompanies: () => ["/api/admin/benchmark-companies"] as const,
  benchmarkCompaniesStats: () => ["/api/admin/benchmark-companies/stats"] as const,
  users: () => ["/api/admin/users"] as const,
  cdPortfolio: () => ["/api/admin/cd-portfolio"] as const,
  filterOptions: () => ["/api/admin/filter-options"] as const,
  metricPrompts: () => ["/api/admin/metric-prompts"] as const,
  ga4PropertyAccess: () => ["/api/admin/ga4-property-access"] as const,
  cdPortfolioData: (companyId: string) => ["/api/admin/cd-portfolio", companyId, "data"] as const,
  ga4ServiceAccounts: () => ["/api/admin/ga4-service-accounts"] as const,
  ga4PropertyAccessClient: (clientId: string) => ["/api/admin/ga4-property-access/client", clientId] as const,
  
  /**
   * Generic admin cache invalidation helpers
   */
  allDashboards: () => ["/api/dashboard"] as const,
  allFilters: () => ["/api/filters"] as const,
} as const;