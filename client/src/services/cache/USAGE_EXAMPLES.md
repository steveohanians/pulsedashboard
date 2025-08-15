# Cache Management Usage Examples

## Automatic Cache Invalidation in Services

```typescript
import { clientService, cacheManager } from '@/services/api';

// When you create a client - cache automatically invalidated
const newClient = await clientService.create({
  name: 'Demo Company',
  websiteUrl: 'https://demo.com',
  industryVertical: 'Technology',
  businessSize: 'Mid-Market (100-500 employees)'
});
// ✅ Automatically invalidates: client, dashboard, filter caches

// When you update a portfolio company - cache automatically invalidated
await portfolioService.resyncSemrush('portfolio-id');
// ✅ Automatically invalidates: portfolio, dashboard caches

// When you generate AI insights - cache automatically invalidated  
await insightService.generateForMetric('client-id', 'Bounce Rate', {
  metricValue: 25.8,
  context: 'E-commerce site with recent design changes'
});
// ✅ Automatically invalidates: insight caches
```

## Manual Cache Management (Edge Cases)

```typescript
import { cacheManager } from '@/services/api';

// Invalidate specific entities
cacheManager.invalidate('client');                    // Only client
cacheManager.invalidate('client', 'dashboard');       // Client + dashboard
cacheManager.invalidate('filter');                    // Filter + dependents

// Invalidate specific query keys
cacheManager.invalidateKey('/api/dashboard/demo-client-id');
cacheManager.invalidateKey(['/api/filters', '/api/dashboard']);

// Clear all caches (nuclear option)
cacheManager.invalidateAll();

// Clear backend performance cache
await cacheManager.clearBackendCache(['dashboard', 'filters']);
```

## Dependency Relationships

The cache manager understands these relationships:

- **Client changes** → Invalidates dashboard, filter caches
- **Competitor changes** → Invalidates dashboard caches  
- **Benchmark changes** → Invalidates dashboard, filter caches
- **Portfolio changes** → Invalidates dashboard, filter caches
- **Filter changes** → Invalidates client, benchmark, portfolio, dashboard caches
- **GA4 changes** → Invalidates dashboard caches
- **Metric changes** → Invalidates dashboard, insight caches

## Debug Information

Cache invalidations are logged to console:

```javascript
// Console output when cache is invalidated:
Cache invalidated: {
  entities: ['client', 'dashboard', 'filter'],
  keys: ['/api/admin/clients', '/api/dashboard', '/api/filters']
}
```

## Benefits

✅ **Zero Manual Cache Management** - All CRUD operations automatically handle cache invalidation
✅ **Intelligent Dependencies** - Related data automatically stays in sync  
✅ **Centralized Logic** - All cache rules in one place
✅ **Type Safe** - Full TypeScript support with CacheEntity types
✅ **Performance** - Only invalidates necessary caches, not everything