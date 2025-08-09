# Data Flow Maps v1

This document traces end-to-end data flows from frontend chart components through API endpoints to database operations and back for key ClearSight dashboard features.

## Overview

ClearSight employs a sophisticated data architecture with environment flags controlling backward compatibility and GA4 integration modes. All flows respect the **authentic data integrity principle** - no synthetic or fallback data is ever displayed.

### Environment Flags Impacting All Flows

- `GA4_COMPAT_MODE=true` (default): Ensures backward compatibility with legacy dashboard support
- `GA4_FORCE_ENABLED=true`: Forces GA4 data fetching regardless of client configuration  
- `GA4_LOCKS_ENABLED=true`: Enables concurrency control for GA4 fetch operations
- `GA4_STRICT_CLIENTID_VALIDATION=true`: Enforces strict clientId format validation

---

## Flow A: Time Series Chart (Sessions/Bounce Rate/Duration)

**Frontend Component:** `client/src/components/charts/time-series-chart.tsx`

### 1. Frontend Request Trigger
- **Location:** `client/src/pages/dashboard.tsx:233` - Dashboard component loads with `useQuery`
- **Trigger:** `useQuery` hook with memoized query key
- **Query Key:** `["/api/dashboard/${clientId}?timePeriod=${timePeriod}&businessSize=${businessSize}&industryVertical=${industryVertical}"]`
- **Data Fetching:** Uses default fetcher from `@/lib/queryClient`

### 2. HTTP Request Details
- **Endpoint:** `GET /api/dashboard/{clientId}`
- **Method:** GET
- **Parameters:**
  - Path: `clientId` (string)
  - Query: `timePeriod`, `businessSize`, `industryVertical`
- **Authentication:** `requireAuth` middleware validates session

### 3. Backend Route Handler
- **File:** `server/routes.ts:233`
- **Handler:** Dashboard route with performance optimization
- **Process Flow:**
  ```
  1. Authentication check (req.user validation)
  2. Dynamic period mapping generation (server/utils/dateUtils.ts)
  3. Client access validation (clientId vs user permissions)
  4. Client retrieval from storage
  5. Call getDashboardDataOptimized()
  6. Background AI insights queuing
  7. GA4 compatibility layer application
  8. JSON serialization safety check
  ```

### 4. Service Layer Invocation
- **Primary Service:** `server/utils/query-optimization/queryOptimizer.ts:getDashboardDataOptimized()`
- **Process:**
  ```
  1. Cache key generation (currently disabled for debugging)
  2. Parallel data fetching:
     - Client metrics (storage.getClientMetrics)
     - Competitor metrics (storage.getCompetitorMetrics) 
     - Industry benchmarks (storage.getIndustryBenchmarks)
     - CD portfolio averages (storage.getCdPortfolioMetrics)
  3. Time series data aggregation by period
  4. Metric value parsing and conversion
  ```

### 5. Database Operations
- **Tables Accessed:**
  - `metrics` - Primary metric storage with JSONB values
  - `clients` - Client configuration and metadata
  - `competitors` - Competitor definitions and associations
  - `benchmark_companies` - Industry benchmark data
  - `cd_portfolio_companies` - Clear Digital portfolio companies

- **Key Queries:**
  ```sql
  -- Client metrics for time periods
  SELECT * FROM metrics 
  WHERE client_id = ? AND time_period IN (?) AND source_type = 'Client'
  
  -- Competitor metrics
  SELECT * FROM metrics m
  JOIN competitors c ON m.competitor_id = c.id
  WHERE c.client_id = ? AND m.time_period IN (?)
  
  -- Portfolio averages
  SELECT * FROM metrics 
  WHERE source_type = 'CD_Avg' AND time_period IN (?)
  ```

### 6. Response Processing & Caching
- **Data Shape:**
  ```typescript
  {
    client: { id, name, websiteUrl },
    metrics: Array<{
      metricName: string,
      value: string | number,
      sourceType: 'Client' | 'Competitor' | 'CD_Avg' | 'Industry_Avg',
      timePeriod: string,
      channel?: string,
      competitorId?: string
    }>,
    timeSeriesData: Record<string, Array<MetricData>>,
    periods: string[],
    timestamp: number,
    dataFreshness: 'live'
  }
  ```

- **Caching Headers:** 
  ```
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0
  ```

### 7. Frontend Chart Processing
- **Component:** `TimeSeriesChart` receives props from dashboard data
- **Data Processing:**
  ```
  1. generateTimeSeriesData() - Line 66
  2. Authentic time series data validation
  3. Metric-specific conversions (Rate -> %, Duration -> minutes)
  4. Period label generation (generatePeriodLabel)
  5. Chart data point aggregation by period
  6. Y-axis domain calculation
  ```

### 8. Chart Rendering
- **Library:** Recharts LineChart/BarChart
- **Features:** Interactive visibility controls, responsive design, DiamondDot markers
- **Empty State:** Shows "No authentic data available" instead of synthetic fallbacks

---

## Flow B: Stacked Bar Chart (Traffic Channels/Device Distribution)

**Frontend Component:** `client/src/components/charts/stacked-bar-chart.tsx`

### 1. Frontend Request Trigger
- **Same as Flow A** - Uses identical dashboard data endpoint
- **Data Source:** Same `/api/dashboard/{clientId}` response
- **Distribution Data:** Extracted from metrics where `metricName = 'Traffic Channels'` or `'Device Distribution'`

### 2. Backend Distribution Processing
- **Parser:** `server/routes.ts:parseDistributionMetricValue()` (Line 23)
- **Special Handling:**
  ```
  1. Device Distribution: Preserves full array for Client data, extracts percentage for benchmarks
  2. Traffic Channels: Maintains complete channel breakdown for AI analysis
  3. JSONB parsing with error handling for malformed data
  4. Source-type specific formatting (Client arrays vs benchmark objects)
  ```

### 3. Database Storage Pattern
- **Metrics Table Structure:**
  ```sql
  -- Traffic Channels stored as JSONB array
  {
    "value": [
      {"name": "Organic Search", "sessions": 1500, "percentage": 45.2},
      {"name": "Direct", "sessions": 800, "percentage": 24.1},
      {"name": "Social Media", "sessions": 600, "percentage": 18.1}
    ]
  }
  
  -- Device Distribution similar structure
  {
    "value": [
      {"device": "Desktop", "sessions": 2100, "percentage": 63.5},
      {"device": "Mobile", "sessions": 1200, "percentage": 36.5}
    ]
  }
  ```

### 4. Frontend Chart Processing
- **Component:** `StackedBarChart` processes distribution arrays
- **Data Transformation:**
  ```
  1. Channel/device data aggregation by source type
  2. Percentage calculation for bar segments
  3. Color mapping via CHANNEL_COLORS constant
  4. Responsive bar sizing based on data length
  5. Hover state management for tooltips
  ```

### 5. Chart Rendering Features
- **Interactive Elements:** Hover tooltips, responsive layout
- **Color Scheme:** CSS custom properties for consistent theming
- **Empty State:** "No data available" with informative icon

---

## Flow C: Admin Cleanup & Refetch (GA4 Data Synchronization)

**Frontend Trigger:** Admin panel cleanup button or API call

### 1. Frontend Request Trigger
- **Endpoint:** `POST /api/cleanup-and-fetch/{clientId}`
- **Component:** Admin panel or direct API call
- **Authentication:** Requires Admin role or client ownership

### 2. Backend Route Handler
- **File:** `server/routes/cleanupAndFetchRoute.ts:81`
- **Security Features:**
  ```
  1. Concurrency control (cleanupInProgress lock)
  2. Enhanced authentication (requireAdminAuth)
  3. ClientId validation (conditional based on GA4_STRICT_CLIENTID_VALIDATION)
  4. Comprehensive non-cacheable headers
  ```

### 3. Cleanup Process
- **Step 1:** `clearSyntheticDataForClient(clientId)`
  - Removes cached/derived data for specific client
  - Preserves authentic GA4 data integrity
  
- **Step 2:** Smart GA4 data fetching based on compatibility mode

### 4. GA4 Service Invocation
- **Service:** `server/services/ga4/SmartDataFetcher.ts`
- **Method:** `fetch15MonthData(clientId, force=true)`

### 5. Smart Data Fetcher Process
- **Lock Management:** 
  ```
  1. acquireLock() with TTL enforcement (Line 33)
  2. Per-period fetch coordination
  3. Cleanup of expired locks
  4. Timeout protection (300s default)
  ```

- **Data Validation:**
  ```
  1. Existing data status check per period
  2. Daily vs monthly data type detection
  3. Storage optimization (replace daily with monthly)
  4. 15-month historical data logic
  ```

### 6. GA4 API Integration
- **Service:** `GA4DataService` (PulseDataService.ts)
- **Process:**
  ```
  1. Google Analytics 4 API authentication
  2. Metric-specific API calls (sessions, bounce rate, duration, etc.)
  3. Daily data fetching for current month
  4. Monthly aggregation for historical periods
  5. Device and channel distribution queries
  ```

### 7. Database Operations
- **Insert/Update Pattern:**
  ```sql
  -- New authentic metrics from GA4
  INSERT INTO metrics (
    client_id, metric_name, value, source_type, 
    time_period, channel, created_at
  ) VALUES (?, ?, ?, 'Client', ?, ?, NOW())
  
  -- Replace daily with monthly data
  DELETE FROM metrics 
  WHERE client_id = ? AND time_period = ? AND data_type = 'daily'
  ```

### 8. Response & Cache Invalidation
- **Response Format:**
  ```typescript
  {
    success: boolean,
    periodsProcessed: number,
    dailyDataPeriods: string[],
    monthlyDataPeriods: string[],
    errors: string[],
    lastFetchedAt: string
  }
  ```

- **Cache Management:**
  ```
  1. Client-specific cache clearing
  2. Dashboard data invalidation
  3. Query cache reset for affected periods
  4. Frontend query invalidation via React Query
  ```

---

## Potential Breakpoints & Inconsistencies

### 1. Time Period Naming Drift
- **Issue:** Frontend uses "Last Month" while backend generates "2025-07" format
- **Impact:** Period mapping mismatches in time series aggregation
- **Location:** `generateDynamicPeriodMapping()` vs frontend display logic

### 2. Metric Value Parsing Inconsistencies  
- **Issue:** Multiple parsing functions (`parseMetricValue`, `parseDistributionMetricValue`)
- **Impact:** Inconsistent data type handling across different chart components
- **Location:** Routes vs chart components vs utility functions

### 3. Environment Flag Coordination
- **Issue:** GA4_COMPAT_MODE affects multiple layers but default behavior varies
- **Impact:** Compatibility layer applications inconsistent between flows
- **Location:** SmartDataFetcher vs routes vs frontend compatibility

### 4. Concurrency Control Gaps
- **Issue:** Dashboard route lacks locking while cleanup route has comprehensive controls
- **Impact:** Potential race conditions during concurrent dashboard loads and data fetches
- **Location:** Dashboard route vs cleanup route design patterns

### 5. Error Handling Depth Variation
- **Issue:** Deep error handling in GA4 services vs basic error responses in dashboard route
- **Impact:** Inconsistent error experience across different failure scenarios
- **Location:** Service layer vs route layer error handling strategies

---

## Performance Optimizations

### Active Optimizations
1. **Query Parallelization:** Multiple storage calls executed concurrently
2. **Background Processing:** AI insights generation queued non-blocking
3. **Lock-based Concurrency:** Prevents duplicate GA4 fetches
4. **React Query Caching:** Frontend-level data caching with stale-while-revalidate

### Caching Strategy
- **Frontend:** TanStack Query with 30s staleTime, 2min gcTime
- **Backend:** In-memory query cache (currently disabled for debugging)
- **Database:** Indexed queries on client_id, time_period, metric_name combinations

### Load Time Targets
- **Dashboard Initial:** < 2 seconds (vs legacy 22+ seconds)
- **Chart Rendering:** < 500ms per component
- **Data Refresh:** < 30 seconds for full 15-month sync