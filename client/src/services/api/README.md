# Frontend API Service Layer

This directory contains a comprehensive service layer that mirrors all backend API endpoints from `server/routes.ts`. Each service provides type-safe methods for interacting with specific API domains.

## Architecture

- **BaseService**: Abstract base class providing common CRUD operations
- **Service Classes**: Domain-specific services extending BaseService where appropriate
- **Singleton Pattern**: All services are exported as singleton instances for consistent usage

## Usage Examples

### Using Singleton Instances (Recommended)

```typescript
import { clientService, dashboardService, insightService } from '@/services/api';

// Get all clients (admin)
const clients = await clientService.getAll();

// Get dashboard data
const dashboard = await dashboardService.getDashboard('client-id', {
  timePeriod: 'Last Month',
  businessSize: 'Mid-Market (100-500 employees)',
  industryVertical: 'Technology'
});

// Generate AI insights
const insights = await insightService.generateForMetric('client-id', 'Bounce Rate', {
  metricValue: 25.8,
  context: 'E-commerce website with recent design changes'
});
```

### Using Service Classes Directly

```typescript
import { ClientService, GA4Service } from '@/services/api';

const clientService = new ClientService();
const ga4Service = new GA4Service();

// Create client with GA4 setup
const newClient = await clientService.createWithGA4Setup({
  name: 'Demo Company',
  websiteUrl: 'https://demo.com',
  industryVertical: 'Technology',
  businessSize: 'Mid-Market (100-500 employees)',
  ga4PropertyId: 'GA_PROPERTY_123',
  enableGA4Sync: true
});

// Trigger GA4 data sync
await ga4Service.executeCompleteDataSync(newClient.id);
```

## Available Services

### Core Services
- **authService**: Authentication, password reset
- **dashboardService**: Dashboard data, filters, cache stats
- **metricService**: Metrics data, daily metrics, prompts

### Admin Services
- **clientService**: Client management, GA4 setup, icon operations
- **userService**: User management, invites, password resets
- **benchmarkService**: Benchmark companies, CSV import
- **portfolioService**: CD Portfolio management, SEMrush sync
- **filterService**: Filter options management

### Data & AI Services  
- **ga4Service**: GA4 integration, data sync, property management
- **insightService**: AI insights generation, context management
- **competitorService**: Competitor management

## Integration with React Query

All services use the existing `apiRequest` wrapper from `@/lib/queryClient.ts`, ensuring:

- Consistent error handling
- Proper TypeScript types
- Integration with existing auth system
- Standardized request/response patterns

## Error Handling

Services automatically handle errors through the existing API error system:

```typescript
try {
  const result = await clientService.create(clientData);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error [${error.code}]:`, error.message);
    // Handle specific error codes
  }
}
```

## Future Extensions

- Add request/response type definitions from shared schema
- Implement service-specific error handling
- Add request caching decorators
- Create service composition utilities