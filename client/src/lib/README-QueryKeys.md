# Query Keys Architecture

## Overview
This project uses a centralized, tuple-based query key system for all React Query operations to ensure type safety, maintainability, and consistent cache invalidation patterns.

## Key Principles

### 1. Tuple-Based Query Keys
- ✅ **Correct**: `queryKey: QueryKeys.dashboard(clientId, timePeriod)`
- ❌ **Incorrect**: `queryKey: ["/api/dashboard", clientId, timePeriod]`

### 2. Centralized Helpers
- **Main App**: Use `QueryKeys` from `@/lib/queryKeys`
- **Admin Panel**: Use `AdminQueryKeys` from `@/lib/adminQueryKeys`

### 3. Type Safety
All query keys use `as const` assertions for strong typing:
```typescript
export const QueryKeys = {
  dashboard: (clientId: string, timePeriod: string) => 
    ["/api/dashboard", clientId, timePeriod] as const,
} as const;
```

## Available Query Keys

### QueryKeys (Main App)
- `QueryKeys.dashboard(clientId, timePeriod)` - Dashboard data
- `QueryKeys.filters()` - Filter options
- `QueryKeys.aiInsights(clientId, timePeriod)` - AI insights
- `QueryKeys.competitors(clientId)` - Competitor data
- `QueryKeys.allDashboards()` - Cache invalidation helper
- `QueryKeys.allFilters()` - Cache invalidation helper

### AdminQueryKeys (Admin Panel)
- `AdminQueryKeys.clients()` - Client management
- `AdminQueryKeys.users()` - User management  
- `AdminQueryKeys.benchmarkCompanies()` - Benchmark companies
- `AdminQueryKeys.cdPortfolio()` - CD portfolio companies
- `AdminQueryKeys.filterOptions()` - Filter options
- `AdminQueryKeys.metricPrompts()` - Metric prompts
- `AdminQueryKeys.ga4PropertyAccess()` - GA4 property access
- `AdminQueryKeys.ga4ServiceAccounts()` - GA4 service accounts
- `AdminQueryKeys.ga4PropertyAccessClient(clientId)` - Client-specific GA4 access
- `AdminQueryKeys.cdPortfolioData(companyId)` - Portfolio company data

## Usage Examples

### Query Definition
```typescript
const { data: dashboard } = useQuery({
  queryKey: QueryKeys.dashboard(clientId, timePeriod),
  enabled: !!clientId,
});
```

### Cache Invalidation
```typescript
// Specific invalidation
queryClient.invalidateQueries({ 
  queryKey: QueryKeys.dashboard(clientId, timePeriod) 
});

// Broader invalidation (all dashboards)
queryClient.invalidateQueries({ 
  queryKey: QueryKeys.allDashboards() 
});
```

### Mutation Success Handlers
```typescript
const mutation = useMutation({
  mutationFn: updateClient,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: AdminQueryKeys.clients() });
  },
});
```

## ESLint Rules
Custom ESLint rules prevent string-based query keys:
- Detects `queryKey: ["/api/..."]` patterns
- Enforces use of helper functions
- Provides clear error messages with suggested fixes

## Benefits
1. **Type Safety**: Compile-time checking of query key structure
2. **Maintainability**: Centralized management of all query keys
3. **Consistency**: Standardized patterns across the codebase
4. **Cache Control**: Precise invalidation targeting
5. **Refactor Safety**: IDE support for finding all usages

## Migration Guide
When adding new endpoints:
1. Add helper to appropriate QueryKeys file
2. Use const assertion: `as const`
3. Import and use the helper in components
4. Never use string-based patterns directly