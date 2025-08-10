# Data Flow Maps v1
*End-to-end flow tracing for key features in Pulse Dashboard™*

## Flow 1: Dashboard GA4 Flow A - TimeSeriesChart Data Retrieval

### Frontend Trigger
**Component**: `client/src/components/charts/time-series-chart.tsx`  
**Data Source**: Props passed from `client/src/pages/dashboard.tsx`  
**Trigger Line**: Dashboard component's `useQuery` hook at line 158-168

```typescript
const dashboardQuery = useQuery<DashboardData>({
  queryKey: [`/api/dashboard/${user?.clientId}`, effectiveTimePeriod, businessSize, industryVertical],
  queryFn: () => fetch(`/api/dashboard/${user?.clientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod || 'Last Month')}&businessSize=${encodeURIComponent(businessSize || 'All')}&industryVertical=${encodeURIComponent(industryVertical || 'All')}`)
    .then(res => res.json()),
  enabled: !!user?.clientId,
  staleTime: 0, // Force fresh data
  refetchOnMount: 'always',
  gcTime: 0, // Don't cache results
});
```

### API Request
**Method**: `GET`  
**Endpoint**: `/api/dashboard/:clientId`  
**Query Parameters**:
- `timePeriod`: string (e.g., "Last Month", "3 Months", custom date range)
- `businessSize`: string (e.g., "All", "Small Business", "Large Enterprise")  
- `industryVertical`: string (e.g., "All", "Technology", "Healthcare")

### Route Handler
**File**: `server/routes.ts`  
**Handler Function**: Lines 244-384  
**Middleware**: `requireAuth` (authentication check)  
**Authorization**: User must own client or be Admin

#### Key Processing Steps:
1. **Parameter Parsing** (Lines 247-251):
   ```typescript
   let { 
     timePeriod = "Last Month", 
     businessSize = "All", 
     industryVertical = "All" 
   } = req.query;
   ```

2. **Dynamic Period Mapping** (Lines 253-286):
   ```typescript
   const periodMapping = generateDynamicPeriodMapping();
   let periodsToQuery: string[];
   if (typeof timePeriod === 'string' && periodMapping[timePeriod]) {
     periodsToQuery = periodMapping[timePeriod];
   }
   ```

3. **Client Validation** (Lines 293-296):
   ```typescript
   const client = await storage.getClient(clientId);
   if (!client) {
     return res.status(404).json({ message: "Client not found" });
   }
   ```

### Service Layer Invocations
**Primary Service**: `server/utils/query-optimization/queryOptimizer.ts`  
**Function**: `getDashboardDataOptimized()`

#### Caching Strategy:
**Cache Check** (Lines 305-320):
```typescript
const cacheEnabled = process.env.DASHBOARD_CACHE_ENABLED === 'true';
if (cacheEnabled) {
  const cacheKey = performanceCache.generateDashboardKey(clientId, timePeriod, businessSize, industryVertical);
  const cachedResult = performanceCache.get(cacheKey);
  if (cachedResult) {
    return res.json(cachedResult);
  }
}
```

**Cache TTL**: 5 minutes (300,000ms)  
**Cache Keys**: `dashboard:${clientId}:${timePeriod}:${businessSize}:${industryVertical}`

### Database Operations
**Primary Tables**:
1. **clients** - Client validation and metadata
2. **metrics** - Time series data retrieval  
3. **competitors** - Competitor data for comparison
4. **aiInsights** - AI-generated insights loading

#### Key Queries (via storage interface):
```typescript
// Core metrics retrieval
const allMetrics = await storage.getMetricsByMultiplePeriods(clientId, periodsToQuery);

// Competitor data fetching  
const competitors = await storage.getCompetitorsByClient(clientId);

// AI insights loading
const insights = await storage.getAIInsights(clientId, currentPeriod);
```

#### TimeSeriesChart Specific Processing:
**Source Types Retrieved**:
- `Client`: User's actual data
- `Competitor`: Benchmarking data  
- `CD_Avg`: Clear Digital portfolio average
- `Industry_Avg`: Industry benchmarks

**Data Structure for TimeSeriesChart**:
```typescript
timeSeriesData?: Record<string, Array<{
  metricName: string;        // "Session Duration"
  value: string | number;    // 180.5 (seconds converted to minutes)
  sourceType: string;        // "Client", "Competitor", "CD_Avg"
  competitorId?: string;     // For competitor data points
}>>
```

### Response Shape
```typescript
interface DashboardData {
  client: { id: string; name: string; websiteUrl: string };
  metrics: DashboardMetric[];
  averagedMetrics?: Record<string, Record<string, number>>;
  timeSeriesData?: Record<string, Array<{
    metricName: string;
    value: string | number;
    sourceType: string;
    competitorId?: string;
  }>>;
  competitors: Array<{ id: string; domain: string; label: string }>;
  insights: Array<{ metricName: string; contextText: string; insightText: string }>;
  isTimeSeries?: boolean;
  periods?: string[];
}
```

### Caching & Headers
**Response Headers**:
- `ETag`: Generated from data hash
- `Cache-Control`: Based on `DASHBOARD_CACHE_ENABLED` flag
- `X-Data-Source`: "live" or "cached"

**SWR (Stale-While-Revalidate)**:
- Frontend: `staleTime: 0` (always fetch fresh)
- Backend: 5-minute cache with background updates

### Environment Flags Impacting Flow
1. **`GA4_COMPAT_MODE`**: Enables backward compatibility (default: true)
2. **`DASHBOARD_CACHE_ENABLED`**: Controls response caching (default: false)
3. **`GA4_FORCE_ENABLED`**: Forces GA4 service usage
4. **`NODE_ENV`**: Affects logging verbosity and error handling

### Frontend Chart Processing
**TimeSeriesChart Component** receives props:
```typescript
interface TimeSeriesChartProps {
  metricName: string;           // "Session Duration"
  timePeriod: string;          // "3 Months"
  clientData: number;          // Latest period value
  industryAvg: number;         // Benchmark comparison
  cdAvg: number;              // Portfolio average
  timeSeriesData?: Record<string, Array<...>>;  // Historical data
  periods?: string[];          // ["2025-05", "2025-06", "2025-07"]
}
```

**Chart Data Processing** (Lines 66-120):
- Parses `timeSeriesData` for authentic historical points
- Groups by period and sourceType for line series
- Converts Session Duration from seconds to minutes
- Applies temporal variation for visual smoothing

---

## Flow 2: Dashboard GA4 Flow B - LollipopChart Device Distribution

### Frontend Trigger
**Component**: `client/src/components/charts/lollipop-chart.tsx`  
**Data Source**: Device Distribution processing in `dashboard.tsx`  
**Trigger Line**: Same dashboard query as Flow A, different data extraction

### Data Processing Pipeline
**Frontend Processing** (dashboard.tsx lines 800-950):
```typescript
// Device distribution extraction from metrics
const deviceDistributionData = useMemo(() => {
  const deviceMetrics = metrics.filter(m => m.metricName === 'Device Distribution');
  return processDeviceDistribution(deviceMetrics, competitors);
}, [metrics, competitors]);
```

### API Request 
**Same as Flow A**: `GET /api/dashboard/:clientId`

### Route Handler Processing
**Special Parsing**: `parseDistributionMetricValue()` function (Lines 34-117)

```typescript
function parseDistributionMetricValue(value: any, metricName: string): any {
  if (metricName === 'Device Distribution') {
    // Handle array format (Client data)
    if (Array.isArray(parsedData)) {
      return parsedData; // Full distribution array
    }
    
    // Handle CD_Avg/Industry_Avg object format
    if (parsedData && typeof parsedData === 'object' && 'percentage' in parsedData) {
      return parsedData.percentage; // Extract percentage only
    }
  }
}
```

### Database Operations
**Metrics Table Query**:
```sql
SELECT metricName, value, sourceType, timePeriod, channel, competitorId
FROM metrics 
WHERE clientId = ? 
  AND metricName = 'Device Distribution'
  AND timePeriod IN (?)
ORDER BY sourceType, channel
```

**Value Storage in Database**:
```json
// Client data (JSONB array)
[
  {"device": "Desktop", "sessions": 2100, "percentage": 89.5},
  {"device": "Mobile", "sessions": 200, "percentage": 10.5}
]

// CD_Avg data (JSONB object per device)
{"source": "cd_portfolio_average", "sessions": 298312, "percentage": 27.87}
```

### Service Processing
**Device Distribution Handler**:
```typescript
// Extract device percentages by sourceType
const deviceData = {
  client: { Desktop: 89.5, Mobile: 10.5 },
  cdAvg: { Desktop: 81.4, Mobile: 27.9 },
  competitors: [
    { id: "comp1", label: "Competitor A", value: { Desktop: 75.0, Mobile: 25.0 }}
  ]
};
```

### Response Shape
**Device Distribution Structure**:
```typescript
interface DeviceDistribution {
  Desktop: number;  // Percentage 0-100
  Mobile: number;   // Percentage 0-100
}

// Passed to LollipopChart
interface LollipopChartProps {
  data: DeviceDistribution;              // Client data
  competitors: Array<CompetitorData>;    // Benchmark data
  industryAvg: DeviceDistribution;       // Industry average
  cdAvg: DeviceDistribution;            // Portfolio average
}
```

### Frontend Chart Rendering
**Color Management**: `getDeviceColors()` from `chartUtils.ts`
```typescript
const DEVICE_COLORS = {
  Desktop: "hsl(var(--primary))",
  Mobile: "hsl(var(--secondary))",
  Tablet: "hsl(var(--accent))"
};
```

**Chart Configuration**:
- Horizontal bars with circular endpoints
- Responsive to data availability
- Normalized to 0-100% scale
- Interactive hover states

---

## Flow 3: Admin Cleanup & Refetch Flow

### Frontend Trigger
**Component**: `client/src/pages/dashboard.tsx`  
**Trigger Function**: `handleRefreshData()` (Lines 58-86)  
**User Action**: Admin user clicks refresh button

```typescript
const handleRefreshData = async () => {
  setIsRefreshing(true);
  try {
    await refetchDashboard(); // Invalidates cache and refetches
    queryClient.invalidateQueries({ queryKey: ["/api/filters"] });
  } catch (error) {
    // Error handling
  } finally {
    setIsRefreshing(false);
  }
};
```

### API Request
**Endpoint**: `POST /api/cleanup-and-fetch/:clientId`  
**Route File**: `server/routes/cleanupAndFetchRoute.ts`  
**Middleware Stack**:
1. `requireAuth` - Authentication check
2. `requireAdminAuth` - Admin authorization or client ownership

### Route Handler Processing
**Concurrency Control** (Lines 88-94):
```typescript
// Global cleanup lock
if (cleanupInProgress) {
  return res.status(409).json({
    ok: false,
    error: 'Cleanup operation already in progress. Please try again later.'
  });
}
```

**Input Validation** (Lines 100-115):
```typescript
if (!validateClientId(clientId)) {
  return res.status(400).json({ 
    ok: false,
    error: 'Invalid client ID format' 
  });
}
```

### Service Invocations
**Primary Service**: `server/services/ga4/SmartDataFetcher.ts`  
**Method**: `fetch15MonthData(clientId, force: true)`

#### SmartDataFetcher Processing Steps:

1. **Lock Acquisition** (Lines 33-62):
   ```typescript
   async function acquireLock(lockKey: string, ttlMs: number = 300000): Promise<boolean> {
     // Prevents concurrent fetches for same clientId+period
     // TTL: 5 minutes
   }
   ```

2. **Data Status Check**:
   ```typescript
   const existingDataStatus = await this.checkExistingData(clientId, periods);
   // Determines if data needs refresh or replacement
   ```

3. **GA4 API Service Call**:
   ```typescript
   const ga4Result = await this.ga4Service.fetchGA4Data(clientId, period);
   ```

### GA4 Service Chain
**Service Files**:
1. `GA4DataService` - API coordination
2. `GA4APIService` - Google Analytics API calls  
3. `GA4StorageService` - Database persistence
4. `GA4DataProcessor` - Data transformation

#### GA4APIService Processing:
```typescript
// Authenticate with Google service account
const authResult = await this.authenticateServiceAccount(clientId);

// Fetch metrics from GA4 API
const metricsData = await this.fetchPeriodMetrics(propertyId, startDate, endDate);

// Transform GA4 response to internal format
const processedData = await this.transformGA4Response(metricsData);
```

### Database Operations
**Tables Modified**:
1. **metrics** - Clear old data, insert new GA4 data
2. **ga4PropertyAccess** - Update sync status and timestamps

#### Data Clearing:
```typescript
// Clear existing synthetic data  
await storage.clearClientMetricsByPeriod(clientId, period);

// Clear AI insights to trigger regeneration
await storage.clearAIInsightsByClient(clientId);
```

#### Data Insertion:
```typescript
// Store main metrics
await storage.createMetric({
  clientId,
  metricName: 'Session Duration',
  value: processedValue,
  sourceType: 'Client',
  timePeriod: period
});

// Store traffic channels
await storage.createMetric({
  clientId,
  metricName: 'Traffic Channels', 
  value: JSON.stringify(channelDistribution),
  sourceType: 'Client',
  timePeriod: period
});
```

### Response Shape
```typescript
interface CleanupResponse {
  ok: boolean;
  summary: string;
  details: {
    clientId: string;
    periodsProcessed: number;
    dailyDataPeriods: string[];
    monthlyDataPeriods: string[];
    errors: string[];
    lastFetchedAt: string;
  };
  chartsRefreshed: string[];
}
```

### Cache Invalidation
**Performance Cache Clear**:
```typescript
// Clear dashboard cache for client
performanceCache.clearPattern(clientId);

// Clear query optimizer cache
clearCache(clientId);
```

**Frontend Cache Invalidation**:
```typescript
// TanStack Query invalidation
queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
queryClient.invalidateQueries({ queryKey: [`/api/insights/${clientId}`] });
```

### Environment Flags Impact
1. **`GA4_FORCE_ENABLED`**: Bypasses service availability checks
2. **`GA4_LOCKS_ENABLED`**: Controls concurrent fetch protection  
3. **`GA4_STRICT_CLIENTID_VALIDATION`**: Enhanced input validation
4. **`GA4_COMPAT_MODE`**: Maintains backward compatibility

### Background Processing
**AI Insights Regeneration**:
```typescript
// Enqueue AI insight generation jobs
backgroundProcessor.enqueue('AI_INSIGHT', {
  clientId,
  metricName: 'Session Duration',
  timePeriod: currentPeriod
});
```

**Job Processing**:
- Non-blocking execution
- 3 retry attempts
- Priority queue management
- Automatic cleanup

---

## Potential Issues & Breakpoints

### 1. Time Period Format Drift
**Issue**: Different components use varying time period formats
- Frontend: "Last Month", "3 Months"  
- Database: "2025-07" (YYYY-MM)
- GA4 API: "2025-07-01" to "2025-07-31"

**Risk**: Data retrieval mismatches, cache key inconsistencies

### 2. JSONB Value Parsing
**Issue**: Device Distribution and Traffic Channels stored as JSONB with varying structures
- Client data: Array format `[{device: "Desktop", percentage: 89.5}]`
- CD_Avg data: Object format `{percentage: 27.87, source: "cd_portfolio_average"}`

**Risk**: Frontend parsing failures, chart rendering issues

### 3. Concurrent Access Control
**Issue**: Multiple cleanup operations or cache invalidations
- Global cleanup lock prevents concurrent admin operations
- Cache clearing during active requests

**Risk**: Data inconsistency, partial updates, user-facing errors

### 4. Environment Flag Dependencies
**Issue**: Feature behavior changes based on environment variables
- `GA4_COMPAT_MODE` affects data processing logic
- `DASHBOARD_CACHE_ENABLED` changes response characteristics

**Risk**: Inconsistent behavior across environments, difficult debugging

### 5. Authentication Flow Complexity
**Issue**: Multiple auth layers with different validation rules
- Route-level auth (`requireAuth`)
- Admin authorization (`requireAdminAuth`)  
- Client ownership validation

**Risk**: Access control bypasses, authorization failures

---

**Generated**: August 10, 2025  
**Version**: 1.0  
**Coverage**: Complete end-to-end tracing for TimeSeriesChart, LollipopChart, and Admin operations  
**Status**: ✅ Full data flow documentation with breakpoint analysis