# Schema Reference v1
*Complete database schema documentation for Pulse Dashboard™*

## Tables/Collections

### Core Business Entities

#### **clients**
**Purpose**: Primary customer entities using the analytics dashboard
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | - | Client company name |
| `websiteUrl` | text | No | - | Client website URL |
| `industryVertical` | text | No | - | Industry classification |
| `businessSize` | text | No | - | Company size category |
| `ga4PropertyId` | text | Yes | null | Google Analytics 4 property ID |
| `active` | boolean | No | true | Client status flag |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Indexes:**
- `idx_clients_industry_vertical` on `industryVertical`
- `idx_clients_business_size` on `businessSize`
- `idx_clients_active` on `active`

**Relationships:**
- One-to-many: users, competitors, metrics, aiInsights, insightContexts
- One-to-one: ga4PropertyAccess

#### **users**
**Purpose**: User accounts with role-based access control
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | Yes | null | Foreign key to clients |
| `name` | text | No | - | User full name |
| `email` | text | No | - | Unique email address |
| `password` | text | No | - | Hashed password |
| `role` | roleEnum | No | "User" | User role (Admin/User) |
| `status` | statusEnum | No | "Active" | Account status |
| `lastLogin` | timestamp | Yes | null | Last login timestamp |
| `createdAt` | timestamp | No | `now()` | Account creation timestamp |

**Constraints:**
- Unique constraint on `email`
- Foreign key: `clientId` → `clients.id`

#### **competitors**
**Purpose**: Client-specific competitor companies for benchmarking
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | No | - | Foreign key to clients |
| `domain` | text | No | - | Competitor domain |
| `label` | text | No | - | Display name for competitor |
| `status` | statusEnum | No | "Active" | Competitor status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Relationships:**
- Many-to-one: client
- One-to-many: metrics

### Benchmarking Entities

#### **benchmarkCompanies**
**Purpose**: Industry reference companies for generating Industry_Avg benchmarks
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | - | Company name |
| `websiteUrl` | text | No | - | Company website |
| `industryVertical` | text | No | - | Industry classification |
| `businessSize` | text | No | - | Company size category |
| `sourceVerified` | boolean | No | false | Data source verification status |
| `active` | boolean | No | true | Company status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

#### **cdPortfolioCompanies**
**Purpose**: Clear Digital's client portfolio for generating CD_Avg benchmarks
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | - | Portfolio company name |
| `websiteUrl` | text | No | - | Company website |
| `industryVertical` | text | No | - | Industry classification |
| `businessSize` | text | No | - | Company size category |
| `active` | boolean | No | true | Company status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

### GA4 Integration

#### **ga4ServiceAccounts**
**Purpose**: Google service account management for GA4 API access
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | - | Service account name |
| `serviceAccountEmail` | text | No | - | Unique service account email |
| `accessToken` | text | Yes | null | OAuth access token |
| `refreshToken` | text | Yes | null | OAuth refresh token |
| `tokenExpiry` | timestamp | Yes | null | Access token expiration |
| `scopes` | text[] | Yes | null | Granted OAuth scopes |
| `verified` | boolean | No | false | OAuth verification status |
| `active` | boolean | No | true | Service account status |
| `lastUsed` | timestamp | Yes | null | Last usage timestamp |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Constraints:**
- Unique constraint on `serviceAccountEmail`

#### **ga4PropertyAccess**
**Purpose**: GA4 property access tracking per client
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | No | - | Foreign key to clients (unique) |
| `serviceAccountId` | varchar | No | - | Foreign key to ga4ServiceAccounts |
| `propertyId` | text | No | - | GA4 property ID |
| `propertyName` | text | Yes | null | GA4 property name |
| `accessLevel` | text | Yes | null | Access level (Viewer, Analyst, Editor) |
| `accessVerified` | boolean | No | false | Access verification status |
| `lastVerified` | timestamp | Yes | null | Last verification timestamp |
| `lastDataSync` | timestamp | Yes | null | Last data synchronization |
| `syncStatus` | text | No | "pending" | Sync status (pending, success, failed, blocked) |
| `errorMessage` | text | Yes | null | API error messages |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Constraints:**
- Unique constraint on `clientId` (one-to-one relationship)
- Foreign keys: `clientId` → `clients.id`, `serviceAccountId` → `ga4ServiceAccounts.id`
- Cascade delete on both foreign keys

### Data Storage

#### **metrics**
**Purpose**: Core metrics data storage with flexible JSONB values
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | Yes | null | Foreign key to clients |
| `competitorId` | varchar | Yes | null | Foreign key to competitors |
| `cdPortfolioCompanyId` | varchar | Yes | null | Foreign key to cdPortfolioCompanies |
| `benchmarkCompanyId` | varchar | Yes | null | Foreign key to benchmarkCompanies |
| `metricName` | text | No | - | Metric identifier |
| `value` | jsonb | No | - | Metric value (flexible structure) |
| `sourceType` | sourceTypeEnum | No | - | Data source classification |
| `timePeriod` | text | No | - | Time period (YYYY-MM format) |
| `channel` | varchar(50) | Yes | null | Traffic channel breakdown |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Indexes:**
- `idx_metrics_client_id` on `clientId`
- `idx_metrics_metric_name` on `metricName`
- `idx_metrics_time_period` on `timePeriod`
- `idx_metrics_source_type` on `sourceType`
- `idx_metrics_client_metric` on (`clientId`, `metricName`)
- `idx_metrics_client_time_period` on (`clientId`, `timePeriod`)
- `idx_metrics_metric_time_period` on (`metricName`, `timePeriod`)

**Relationships:**
- Many-to-one: client, competitor, cdPortfolioCompany, benchmarkCompany

#### **benchmarks**
**Purpose**: Structured benchmark data for industry/business size comparisons
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `metricName` | text | No | - | Benchmark metric name |
| `industryVertical` | text | No | - | Industry classification |
| `businessSize` | text | No | - | Business size category |
| `sourceType` | sourceTypeEnum | No | - | Benchmark source type |
| `value` | decimal(10,4) | No | - | Benchmark value |
| `timePeriod` | text | No | - | Time period (YYYY-MM format) |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Indexes:**
- `idx_benchmarks_industry_vertical` on `industryVertical`
- `idx_benchmarks_business_size` on `businessSize`
- `idx_benchmarks_metric_name` on `metricName`
- `idx_benchmarks_time_period` on `timePeriod`
- `idx_benchmarks_industry_metric` on (`industryVertical`, `businessSize`, `metricName`)

### AI & Insights

#### **aiInsights**
**Purpose**: AI-generated insights and recommendations
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | No | - | Foreign key to clients |
| `metricName` | text | No | - | Associated metric name |
| `timePeriod` | text | No | - | Time period (YYYY-MM format) |
| `contextText` | text | Yes | null | Contextual information |
| `insightText` | text | Yes | null | AI-generated insight |
| `recommendationText` | text | Yes | null | AI-generated recommendation |
| `status` | text | Yes | null | Insight status (success, needs_improvement, warning) |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Indexes:**
- `idx_ai_insights_client_id` on `clientId`
- `idx_ai_insights_metric_name` on `metricName`
- `idx_ai_insights_time_period` on `timePeriod`
- `idx_ai_insights_client_metric` on (`clientId`, `metricName`)

#### **globalPromptTemplate**
**Purpose**: Global AI prompt template configuration
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `name` | text | No | "Global Base Template" | Template name (unique) |
| `promptTemplate` | text | No | - | AI prompt template text |
| `description` | text | Yes | null | Admin help text |
| `variables` | text | Yes | null | JSON array of available variables |
| `isActive` | boolean | No | true | Template active status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |
| `updatedAt` | timestamp | No | `now()` | Last update timestamp |

**Constraints:**
- Unique constraint on `name`

#### **metricPrompts**
**Purpose**: Metric-specific AI prompt templates
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `metricName` | text | No | - | Metric name (unique) |
| `promptTemplate` | text | No | - | Metric-specific prompt template |
| `description` | text | Yes | null | Admin help text |
| `variables` | text | Yes | null | JSON array of available variables |
| `isActive` | boolean | No | true | Template active status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |
| `updatedAt` | timestamp | No | `now()` | Last update timestamp |

**Constraints:**
- Unique constraint on `metricName`

#### **insightContexts**
**Purpose**: User-provided context for AI insight generation
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `clientId` | varchar | No | - | Foreign key to clients |
| `metricName` | text | No | - | Associated metric name |
| `userContext` | text | No | - | User-provided context |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |
| `updatedAt` | timestamp | No | `now()` | Last update timestamp |

### Configuration

#### **filterOptions**
**Purpose**: Dynamic filter management for business sizes and industry verticals
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `category` | text | No | - | Filter category (businessSizes, industryVerticals) |
| `value` | text | No | - | Filter option value |
| `order` | integer | No | 0 | Display order |
| `active` | boolean | No | true | Option active status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |
| `updatedAt` | timestamp | No | `now()` | Last update timestamp |

### Authentication

#### **passwordResetTokens**
**Purpose**: Secure password reset token management
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | varchar | No | `gen_random_uuid()` | Primary key |
| `userId` | varchar | No | - | Foreign key to users |
| `token` | text | No | - | Unique reset token |
| `expiresAt` | timestamp | No | - | Token expiration timestamp |
| `used` | boolean | No | false | Token usage status |
| `createdAt` | timestamp | No | `now()` | Record creation timestamp |

**Constraints:**
- Unique constraint on `token`
- Foreign key: `userId` → `users.id`

## Enums & Constants

### Database Enums

#### **roleEnum**
**Values**: `["Admin", "User"]`
**Usage**: User role classification for access control

#### **statusEnum**
**Values**: `["Active", "Inactive", "Invited"]`
**Usage**: Entity status across users, competitors, and companies

#### **sourceTypeEnum**
**Values**: `["Client", "CD_Portfolio", "CD_Avg", "Industry", "Competitor", "Industry_Avg", "Competitor_Avg"]`
**Usage**: Data source classification for metrics and benchmarks

### GA4 Constants

#### **GA4_METRICS**
```typescript
{
  BOUNCE_RATE: 'bounceRate',
  SESSION_DURATION: 'averageSessionDuration', 
  PAGES_PER_SESSION: 'screenPageViewsPerSession',
  SESSIONS_PER_USER: 'sessionsPerUser',
  SESSIONS: 'sessions',
  TOTAL_USERS: 'totalUsers'
}
```

#### **GA4_DIMENSIONS**
```typescript
{
  DATE: 'date',
  TRAFFIC_CHANNEL: 'sessionDefaultChannelGrouping',
  DEVICE_CATEGORY: 'deviceCategory'
}
```

#### **METRIC_NAMES (Display Names)**
```typescript
{
  BOUNCE_RATE: 'Bounce Rate',
  SESSION_DURATION: 'Session Duration',
  PAGES_PER_SESSION: 'Pages per Session', 
  SESSIONS_PER_USER: 'Sessions per User',
  TRAFFIC_CHANNELS: 'Traffic Channels',
  DEVICE_DISTRIBUTION: 'Device Distribution'
}
```

### Time Period Formats

#### **Standard Formats**
- **Monthly**: `YYYY-MM` (e.g., `2025-07`)
- **Daily**: `YYYY-MM-daily-YYYYMMDD` (e.g., `2025-07-daily-20250715`)

#### **Data Management Constants**
```typescript
{
  DEFAULT_PERIODS: 15, // months
  DAILY_DATA_THRESHOLD_MONTHS: 1, // Keep daily data for last month only
  MAX_BATCH_SIZE: 5,
  CACHE_TTL_MINUTES: 15
}
```

### Traffic Channels
**Standard Values**: `["Organic Search", "Direct", "Social", "Paid Search", "Email", "Referral", "Display", "Affiliate"]`

### Device Categories
**Standard Values**: `["Desktop", "Mobile", "Tablet"]`

### Business Sizes
**Standard Values**: `["Startup", "Small Business", "Medium Business", "Large Enterprise"]`

### Industry Verticals
**Standard Values**: `["Technology", "Healthcare", "Finance", "Retail", "Manufacturing", "Education", "Non-Profit", "Government", "Other"]`

## GA4/Charts Field Map

### Dashboard API Endpoints → Database Fields

#### **GET /api/dashboard/{clientId}**
**Primary Data Flow:**
```typescript
metrics table → Chart Components
├── metricName: "Bounce Rate" → MetricsChart
├── metricName: "Session Duration" → TimeSeriesChart, AreaChart
├── metricName: "Pages per Session" → MetricsChart, BarChart
├── metricName: "Sessions per User" → MetricsChart
├── metricName: "Traffic Channels" → StackedBarChart
└── metricName: "Device Distribution" → LollipopChart
```

#### **Metrics Table Value Structure**
**Simple Metrics** (JSONB values):
```json
{
  "value": 45.2,
  "units": "%"
}
```

**Complex Metrics** (JSONB arrays):
```json
// Traffic Channels
[
  {"channel": "Organic Search", "sessions": 1250, "percentage": 35.7},
  {"channel": "Direct", "sessions": 890, "percentage": 25.4},
  {"channel": "Social", "sessions": 650, "percentage": 18.6}
]

// Device Distribution  
[
  {"device": "Desktop", "sessions": 2100, "percentage": 60.0},
  {"device": "Mobile", "sessions": 1200, "percentage": 34.3},
  {"device": "Tablet", "sessions": 200, "percentage": 5.7}
]
```

#### **Time Series Data Aggregation**
**Database Query Pattern:**
```sql
SELECT metricName, value, timePeriod, sourceType
FROM metrics 
WHERE clientId = ? 
  AND metricName = 'Session Duration'
  AND timePeriod IN ('2025-05', '2025-06', '2025-07')
ORDER BY timePeriod ASC
```

**Frontend Chart Mapping:**
```typescript
// TimeSeriesChart expects:
{
  period: "2025-07",
  client: 180.5,      // sourceType: "Client"
  competitor: 165.2,  // sourceType: "Competitor" 
  cdAvg: 195.8       // sourceType: "CD_Avg"
}
```

#### **Chart Color Assignment**
**Source Type → Color Mapping:**
- `Client`: Primary brand color (blue)
- `Competitor`: Warning color (orange/red)
- `CD_Avg`: Success color (green)
- `Industry_Avg`: Muted color (gray)

**Channel/Device Colors**: Managed by specialized utility functions:
- `getChannelColors()` - Traffic channel visualization
- `getDeviceColors()` - Device distribution charts
- `getMetricsColors()` - Core metric comparisons

### Storage Interface → Chart Data

#### **IStorage Methods Supporting Charts:**
```typescript
// Core data retrieval for dashboard
getMetricsByClient(clientId: string, timePeriod: string): Promise<Metric[]>
getMetricsByNameAndPeriod(clientId: string, metricName: string, timePeriod: string, sourceType: string): Promise<Metric[]>

// AI insights for chart annotations
getAIInsights(clientId: string, timePeriod: string): Promise<AIInsight[]>

// Benchmarking data for comparison charts
getBenchmarks(metricName: string, industryVertical: string, businessSize: string, timePeriod: string): Promise<Benchmark[]>
```

#### **Chart Component Data Dependencies:**
1. **MetricsChart**: Requires Client + Competitor + CD_Avg + Industry_Avg data
2. **TimeSeriesChart**: Requires 3+ months of historical data per sourceType
3. **StackedBarChart**: Requires Traffic Channels JSONB arrays
4. **LollipopChart**: Requires Device Distribution JSONB arrays
5. **AreaChart**: Requires Session Duration time series for area visualization
6. **BarChart**: Requires comparative metrics across sourceTypes

### Frontend Query Patterns

#### **TanStack Query Keys:**
```typescript
["/api/dashboard", clientId]           // Main dashboard data
["/api/dashboard", clientId, filters]  // Filtered dashboard data  
["/api/filters"]                       // Available filter options
["/api/ai-insights", clientId, period] // AI insights overlay
```

#### **Data Transformation Pipeline:**
```
Database JSONB → Server JSON → API Response → Frontend Parsing → Chart Props
```

---

**Generated**: August 10, 2025  
**Version**: 1.0  
**Coverage**: Complete schema with 17 tables, relationships, indexes, and GA4 integration  
**Status**: ✅ Full database documentation for chart visualization and data flow