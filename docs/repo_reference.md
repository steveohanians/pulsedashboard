# Repository Reference - Pulse Dashboard™
*Comprehensive architectural documentation and development guide*

## Table of Contents

1. [Project Overview](#project-overview)
2. [Backend Infrastructure Map](#backend-infrastructure-map)
3. [Frontend Architecture Map](#frontend-architecture-map)
4. [Configuration & Environment](#configuration--environment)
5. [Database Schema Reference](#database-schema-reference)
6. [Data Flow Maps](#data-flow-maps)
7. [Development Guidelines](#development-guidelines)
8. [Open Questions & Assumptions](#open-questions--assumptions)

---

## Project Overview

Pulse Dashboard™ is a full-stack analytics benchmarking platform that transforms complex digital marketing insights into actionable intelligence. Built with enterprise-grade performance requirements, it integrates GA4 data, competitor analysis, and AI-powered recommendations for B2B clients.

### Core Technologies
- **Frontend**: React 18 + TypeScript, Tailwind CSS + shadcn/ui, TanStack Query, Wouter routing
- **Backend**: Node.js + Express.js + TypeScript (ESM), Passport.js authentication
- **Database**: PostgreSQL via Neon serverless, Drizzle ORM
- **Charts**: Recharts with custom optimization layer
- **AI Integration**: OpenAI API with database-backed insights persistence

### Architecture Principles
- **Performance First**: Sub-3-second load times, intelligent caching, background processing
- **Data Integrity**: Authentic GA4/SEMrush data only, no synthetic fallbacks
- **White-Label Ready**: Environment-driven branding and configuration
- **Scalable Design**: Modular services, background job processing, connection pooling

---

## Backend Infrastructure Map

*Based on comprehensive analysis of 50+ server files*

### Core Services Architecture

#### **Authentication & Session Management**
- **`server/auth.ts`**: Passport.js configuration with local strategy
- **`server/middleware/rateLimiter.ts`**: Request throttling (auth: 5/min, upload: 10/min, admin: 30/min)
- **Session Storage**: PostgreSQL via `connect-pg-simple` with configurable TTL

#### **Database Layer**
- **`server/db.ts`**: Neon PostgreSQL connection with pooling
- **`server/storage.ts`**: IStorage interface abstraction (450+ lines)
- **`shared/schema.ts`**: 17 tables with Drizzle ORM + Zod validation
- **Migration Management**: `drizzle-kit` with `./migrations` output

#### **GA4 Integration Services** (`server/services/ga4/`)
- **`GA4DataManager.ts`**: High-level orchestration and data management
- **`GA4APIService.ts`**: Google Analytics API client with OAuth handling
- **`GA4StorageService.ts`**: Database persistence with optimization logic
- **`GA4DataProcessor.ts`**: Transform GA4 responses to internal format
- **`SmartDataFetcher.ts`**: 15-month intelligent data fetching with concurrency control
- **`PulseDataService.ts`**: Legacy service wrapper for compatibility

#### **Route Structure** (`server/routes/`)
- **`server/routes.ts`**: Main API endpoints (600+ lines)
- **`ga4Routes.ts`**: GA4-specific endpoints with admin controls
- **`ga4DataRoute.ts`**: Data fetching and management endpoints
- **`smartGA4Route.ts`**: Intelligent GA4 operations
- **`cleanupAndFetchRoute.ts`**: Admin cleanup and data refresh operations

#### **Utility & Supporting Services**
- **`server/utils/background-processor.ts`**: Async job processing (AI insights, data operations)
- **`server/cache/performance-cache.ts`**: 5-minute TTL memory cache with cleanup
- **`server/utils/query-optimization/queryOptimizer.ts`**: Database query optimization and caching
- **`server/services/openai.ts`**: AI insights generation with prompt management
- **`server/services/semrush/`**: SEMrush API integration for competitor data
- **`server/utils/logging/logger.ts`**: Structured logging with environment-based levels

### Key API Endpoints

#### **Dashboard & Data Retrieval**
```
GET  /api/dashboard/:clientId              # Main dashboard data with caching
GET  /api/insights/:clientId               # AI insights loading
GET  /api/filters                          # Dynamic filter options
GET  /api/clients                          # Client management (admin)
```

#### **GA4 Operations**
```
POST /api/ga4/fetch/:clientId              # Manual GA4 data fetch
POST /api/cleanup-and-fetch/:clientId      # Clear cache + fetch fresh data
GET  /api/ga4/status/:clientId             # GA4 integration status
POST /api/ga4/property-access              # GA4 property setup
```

#### **Data Management**
```
POST /api/competitors                      # Add competitor
DELETE /api/competitors/:id               # Remove competitor
POST /api/metrics/bulk                    # Bulk metrics import
DELETE /api/debug/clear-all-insights      # Clear AI insights (debug)
```

### Environment-Driven Configuration

#### **GA4 Feature Flags**
- `GA4_FORCE_ENABLED`: Bypass availability checks
- `GA4_COMPAT_MODE`: Enable backward compatibility (default: true)
- `GA4_STRICT_CLIENTID_VALIDATION`: Enhanced input validation
- `GA4_LOCKS_ENABLED`: Concurrent fetch protection

#### **Performance Controls**
- `DASHBOARD_CACHE_ENABLED`: Response caching toggle
- `NODE_ENV`: Affects logging, error handling, plugin loading
- `SESSION_SECRET`: Session encryption key
- `DATABASE_URL`: PostgreSQL connection string

---

## Frontend Architecture Map

*Based on analysis of 100+ client-side files*

### Component Architecture

#### **Core Pages** (`client/src/pages/`)
- **`dashboard.tsx`**: Main analytics dashboard (800+ lines)
- **`login.tsx`**: Authentication interface
- **`admin.tsx`**: Admin management panel
- **`insights.tsx`**: AI insights management
- **`data-management.tsx`**: Data import/export tools
- **`competitors.tsx`**: Competitor management interface
- **`reports.tsx`**: Report generation and export

#### **Chart Components** (`client/src/components/charts/`)
- **`time-series-chart.tsx`**: Historical data visualization with authentic time series
- **`metrics-chart.tsx`**: KPI comparison charts
- **`bar-chart.tsx`**: General performance metrics
- **`lollipop-chart.tsx`**: Device distribution visualization
- **`stacked-bar-chart.tsx`**: Traffic channel breakdown
- **`area-chart.tsx`**: Session duration visualization
- **`ChartContainer.tsx`**: Responsive chart wrapper
- **`PerformanceIndicator.tsx`**: Real-time status indicators

#### **UI Component System** (`client/src/components/ui/`)
Built on shadcn/ui foundation with 40+ components:
- **Form Controls**: Button, Input, Select, Checkbox, Switch
- **Layout**: Card, Dialog, Sheet, Tabs, Accordion
- **Feedback**: Toast, Alert, Progress, Spinner
- **Data Display**: Table, Badge, Avatar, Tooltip
- **Navigation**: Command, Menu, Breadcrumb

#### **Utility Functions** (`client/src/utils/`)
- **`chartUtils.ts`**: Color management, chart configurations, data processing
- **`chartDataProcessor.ts`**: Metric parsing and normalization
- **`chartGenerators.ts`**: Time period generation and formatting
- **`metricParser.ts`**: Safe value parsing with type validation
- **`sharedUtilities.ts`**: Common helper functions

### State Management & Data Flow

#### **TanStack Query Configuration**
```typescript
// Query keys follow hierarchical pattern
["/api/dashboard", clientId, timePeriod, businessSize, industryVertical]
["/api/insights", clientId]
["/api/filters", businessSize, industryVertical]

// Cache configuration
staleTime: 0,           // Always fetch fresh dashboard data
gcTime: 0,              // No client-side caching for dashboard
refetchOnMount: 'always' // Ensure data freshness
```

#### **Hook Architecture** (`client/src/hooks/`)
- **`use-auth.ts`**: Authentication state management
- **`use-toast.ts`**: Global notification system
- **Custom query hooks**: Wrap API calls with proper error handling

### Routing & Navigation
**Router**: Wouter (lightweight React routing)
```typescript
// Route definitions in App.tsx
<Route path="/dashboard" component={Dashboard} />
<Route path="/admin" component={Admin} />
<Route path="/insights" component={Insights} />
```

### Theme & Styling
- **Dark Mode**: CSS variables with class-based toggling
- **Responsive Design**: Tailwind CSS with mobile-first approach
- **Component Theming**: shadcn/ui with custom color palette
- **Chart Colors**: Centralized color management for consistency

---

## Configuration & Environment

*Analysis of 25+ environment variables and build configuration*

### Critical Environment Variables

#### **Database & Core Services**
```bash
DATABASE_URL=postgresql://...              # Required - Neon PostgreSQL connection
SESSION_SECRET=...                         # Required - Session encryption key  
NODE_ENV=production|development            # Affects security headers, logging
```

#### **External API Integration**
```bash
OPENAI_API_KEY=...                        # Required - AI insights generation
GOOGLE_SERVICE_ACCOUNT_KEY=...            # GA4 API access credentials
SEMRUSH_API_KEY=...                       # Competitor data integration
```

#### **Feature Flags & Performance**
```bash
GA4_FORCE_ENABLED=true|false              # Bypass GA4 availability checks
GA4_COMPAT_MODE=true|false                # Backward compatibility (default: true)
DASHBOARD_CACHE_ENABLED=true|false        # Response caching toggle
```

### Build Configuration

#### **Vite Configuration** (`vite.config.ts`)
- **SSR**: Express server integration for API routes
- **Aliases**: Path mapping for imports (`@/` → `client/src/`)
- **Plugins**: React, TypeScript, Tailwind CSS processing
- **Dev Server**: Proxy configuration for API routes

#### **TypeScript Configuration** (`tsconfig.json`)
- **Module Resolution**: Node16 for ESM compatibility
- **Strict Mode**: Full type checking enabled
- **Path Mapping**: Consistent with Vite aliases

#### **Package Management** (`package.json`)
- **Scripts**: Development, build, and deployment commands
- **Dependencies**: 60+ production packages
- **Dev Dependencies**: Build tools, type definitions, testing

### Security Configuration
- **Helmet**: Security headers in production
- **CORS**: Configurable origin policies
- **Rate Limiting**: Per-endpoint throttling
- **Session Security**: Secure cookies, CSRF protection

---

## Database Schema Reference

*Complete analysis of 17 tables with relationships and indexes*

### Core Entities

#### **clients** (Primary customer entities)
```sql
CREATE TABLE clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  websiteUrl TEXT NOT NULL,
  industryVertical TEXT NOT NULL,
  businessSize TEXT NOT NULL,
  ga4PropertyId TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for filtering performance
CREATE INDEX idx_clients_industry_vertical ON clients(industryVertical);
CREATE INDEX idx_clients_business_size ON clients(businessSize);
```

#### **metrics** (Core data storage with JSONB flexibility)
```sql
CREATE TABLE metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  clientId VARCHAR REFERENCES clients(id),
  competitorId VARCHAR REFERENCES competitors(id),
  cdPortfolioCompanyId VARCHAR REFERENCES cdPortfolioCompanies(id),
  benchmarkCompanyId VARCHAR REFERENCES benchmarkCompanies(id),
  metricName TEXT NOT NULL,
  value JSONB NOT NULL,              -- Flexible data structure
  sourceType sourceTypeEnum NOT NULL, -- Client, CD_Avg, Competitor, etc.
  timePeriod TEXT NOT NULL,          -- YYYY-MM format
  channel VARCHAR(50),               -- For traffic channels breakdown
  createdAt TIMESTAMP NOT NULL DEFAULT now()
);

-- Performance indexes for frequent queries
CREATE INDEX idx_metrics_client_metric ON metrics(clientId, metricName);
CREATE INDEX idx_metrics_time_period ON metrics(timePeriod);
```

### GA4 Integration Tables

#### **ga4PropertyAccess** (Client-specific GA4 setup)
```sql
CREATE TABLE ga4PropertyAccess (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  clientId VARCHAR UNIQUE NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  serviceAccountId VARCHAR NOT NULL REFERENCES ga4ServiceAccounts(id),
  propertyId TEXT NOT NULL,
  propertyName TEXT,
  accessLevel TEXT,                  -- Viewer, Analyst, Editor
  accessVerified BOOLEAN NOT NULL DEFAULT false,
  lastVerified TIMESTAMP,
  syncStatus TEXT NOT NULL DEFAULT 'pending' -- pending, success, failed, blocked
);
```

### Enums & Constants

#### **sourceTypeEnum**
```sql
CREATE TYPE sourceTypeEnum AS ENUM (
  'Client',           -- User's actual data
  'CD_Portfolio',     -- Clear Digital portfolio companies
  'CD_Avg',           -- Calculated portfolio average
  'Industry',         -- Industry reference companies  
  'Competitor',       -- Client-specific competitors
  'Industry_Avg',     -- Calculated industry average
  'Competitor_Avg'    -- Calculated competitor average
);
```

#### **Standard Metric Names**
```typescript
const METRIC_NAMES = {
  BOUNCE_RATE: 'Bounce Rate',
  SESSION_DURATION: 'Session Duration', 
  PAGES_PER_SESSION: 'Pages per Session',
  SESSIONS_PER_USER: 'Sessions per User',
  TRAFFIC_CHANNELS: 'Traffic Channels',
  DEVICE_DISTRIBUTION: 'Device Distribution'
};
```

### Data Formats & Patterns

#### **Time Period Formats**
- **Monthly**: `YYYY-MM` (e.g., `2025-07`)
- **Daily**: `YYYY-MM-daily-YYYYMMDD` (e.g., `2025-07-daily-20250715`)

#### **JSONB Value Structures**
```json
// Simple metrics
{"value": 45.2, "units": "%"}

// Traffic Channels (array)
[
  {"channel": "Organic Search", "sessions": 1250, "percentage": 35.7},
  {"channel": "Direct", "sessions": 890, "percentage": 25.4}
]

// Device Distribution (array)  
[
  {"device": "Desktop", "sessions": 2100, "percentage": 60.0},
  {"device": "Mobile", "sessions": 1200, "percentage": 34.3}
]
```

---

## Data Flow Maps

*End-to-end tracing for key features*

### Flow 1: TimeSeriesChart Data Retrieval

```
Frontend Trigger → API Request → Route Handler → Service Layer → Database → Response
     ↓                ↓             ↓              ↓            ↓          ↓
dashboard.tsx     GET /api/     routes.ts      queryOptimizer  metrics    JSON with
useQuery hook  dashboard/:id   requireAuth    getDashboard     table     timeSeriesData
Lines 158-168   timePeriod=    Lines 244-384  Optimized       SELECT     + caching
                3 Months       Cache check    Parallel        with       headers
                filters        Auth + period  queries         indexes
```

**Key Processing Steps**:
1. **Frontend**: TanStack Query with cache disabled for freshness
2. **Route**: Dynamic period mapping + client validation  
3. **Service**: Optimized batch fetching with performance cache
4. **Database**: Indexed queries for metrics, competitors, insights
5. **Response**: Structured JSON with ETag headers

### Flow 2: Device Distribution (LollipopChart)

```
Same Dashboard Query → Special JSONB Parsing → Device Data Extraction → Chart Props
          ↓                      ↓                       ↓                 ↓
  metrics table            parseDistribution        processDevice      LollipopChart
  JSONB values             MetricValue()           Distribution()      component
  Array vs Object          Lines 34-117            dashboard.tsx       with colors
  format handling          Client: full array      Lines 800-950       + responsive
                          CD_Avg: percentage                           layout
```

**Data Structure Complexity**:
- **Client Data**: Full array `[{device: "Desktop", percentage: 89.5}]`
- **Benchmark Data**: Object per device `{percentage: 27.87, source: "cd_portfolio_average"}`
- **Frontend Processing**: Normalizes formats for consistent chart rendering

### Flow 3: Admin Cleanup & Refetch

```
Admin Button → POST Request → Concurrency Lock → GA4 Services → Database Clear → Fresh Fetch
     ↓             ↓              ↓                ↓              ↓             ↓
handleRefresh  /cleanup-and-  cleanupInProgress SmartDataFetcher clearClient   GA4 API call
dashboard.tsx  fetch/:id      global semaphore  fetch15MonthData MetricsByPeriod authentic data
Lines 58-86    cleanupAndFetch authentication   with force=true  storage layer  + cache clear
Button click   Route.ts       + admin check     GA4APIService   SQL DELETE      background AI
```

**Security & Concurrency**:
- **Global Lock**: Prevents concurrent cleanup operations
- **Admin Auth**: Role-based access control + client ownership validation
- **Input Validation**: Enhanced clientId format checking with environment flags
- **Cache Invalidation**: Multi-layer cache clearing (performance, query, frontend)

---

## Development Guidelines

### Code Organization Principles

#### **Separation of Concerns**
- **Frontend**: Pure presentation layer, no business logic
- **Routes**: Thin controllers, authentication/validation only
- **Services**: Business logic, external API integration
- **Storage**: Data persistence abstraction layer

#### **Type Safety**
```typescript
// Shared types between frontend/backend
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

// Zod validation schemas
const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true
});
```

#### **Error Handling**
- **Structured Logging**: Winston with configurable levels
- **Error Boundaries**: React error boundaries for frontend
- **API Consistency**: Standard error response format
- **Graceful Degradation**: Empty states instead of failures

### Performance Optimization

#### **Database Optimization**
- **Indexes**: Composite indexes for common query patterns
- **Connection Pooling**: Neon serverless with connection limits
- **Query Batching**: Parallel data fetching where possible
- **JSONB Usage**: Flexible schema with GIN indexes

#### **Caching Strategy**
- **Performance Cache**: 5-minute TTL for dashboard data
- **Query Cache**: Optimized query results caching
- **Frontend Cache**: TanStack Query with strategic invalidation
- **CDN Ready**: Static assets with versioning

#### **Background Processing**
```typescript
// Non-blocking AI insight generation
backgroundProcessor.enqueue('AI_INSIGHT', {
  clientId,
  metricName: 'Session Duration',
  priority: 1
});
```

### Security Best Practices

#### **Authentication & Authorization**
- **Session-Based Auth**: Secure cookies with PostgreSQL storage
- **Role-Based Access**: Admin vs User permissions
- **Input Validation**: Zod schemas for all API inputs
- **Rate Limiting**: Per-endpoint throttling

#### **Data Protection**
- **Environment Variables**: Sensitive data in environment only
- **SQL Injection Prevention**: Parameterized queries via Drizzle
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: SameSite cookie configuration

---

## Open Questions & Assumptions

### Current Assumptions

#### **Data Flow Assumptions**
1. **GA4 Data Freshness**: Assumes GA4 data is updated daily, but actual refresh frequency may vary
2. **Time Zone Handling**: Currently assumes UTC for all timestamp operations
3. **Data Retention**: 15-month historical data assumption may need adjustment based on storage costs
4. **Competitor Data Currency**: Assumes competitor data from SEMrush is sufficiently current for benchmarking

#### **Performance Assumptions**
1. **Cache TTL**: 5-minute cache TTL balances freshness vs performance, but may need tuning
2. **Database Connection Limits**: Assumes Neon serverless can handle concurrent load during peak usage
3. **Memory Usage**: In-memory caching assumes single-instance deployment
4. **Background Job Processing**: Assumes single-threaded job processing is sufficient for current load

#### **Environment & Deployment Assumptions**
1. **Single Region**: Currently assumes single-region deployment, may need multi-region considerations
2. **Environment Parity**: Assumes development/staging environments match production configuration
3. **Backup Strategy**: Database backup strategy not explicitly documented in codebase
4. **Monitoring & Alerting**: Production monitoring setup not evident in codebase

### Open Questions Requiring Clarification

#### **Business Logic Questions**
1. **Metric Aggregation**: How should competing values for the same metric+period be handled? (current: last-write-wins)
2. **Competitor Data Staleness**: What's the acceptable age for competitor benchmark data?
3. **Industry Classification**: How are industry verticals and business sizes standardized across data sources?
4. **Data Quality Thresholds**: What constitutes sufficient data quality for generating insights?

#### **Technical Architecture Questions**
1. **Scaling Strategy**: How will the application scale beyond single-instance deployment?
2. **Data Migration**: How will schema changes be managed in production without downtime?
3. **Error Recovery**: What's the strategy for recovering from GA4 API outages or rate limits?
4. **Multi-Tenancy**: Is the current client isolation sufficient for enterprise deployment?

#### **Security & Compliance Questions**
1. **Data Retention**: Are there regulatory requirements for data retention/deletion?
2. **Access Auditing**: Should all data access be logged for compliance purposes?
3. **Encryption at Rest**: Are additional encryption requirements needed beyond PostgreSQL defaults?
4. **Third-Party Data**: What are the terms of service limitations for GA4 and SEMrush data usage?

#### **Performance & Reliability Questions**
1. **Load Testing**: What are the expected concurrent user limits and peak load patterns?
2. **Failover Strategy**: How should the application handle database or external API failures?
3. **Cache Warming**: Should there be a cache warming strategy for better user experience?
4. **Resource Limits**: What are the memory and CPU constraints for the deployment environment?

---

**Generated**: August 10, 2025  
**Version**: 1.0  
**Status**: Complete architectural documentation covering backend, frontend, database, and data flows  
**Coverage**: 200+ files analyzed across all domains  
**Next Steps**: Address open questions and validate assumptions with stakeholders