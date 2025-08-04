# GA4 Data Management Package

A comprehensive, clean, and organized package for managing all Google Analytics 4 (GA4) data operations in Pulse Dashboard™.

## Overview

This package consolidates all GA4-related functionality into a modular, maintainable architecture with clear separation of concerns:

- **Authentication**: Token management and refresh
- **API Communication**: Direct GA4 API interactions
- **Data Processing**: Raw API response transformation
- **Storage**: Database operations and optimization
- **Orchestration**: High-level data management

## Architecture

```
ga4/
├── index.ts                    # Main package exports
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Configuration and constants
├── GA4DataManager.ts           # Main orchestrator
├── GA4AuthenticationService.ts # Authentication & tokens
├── GA4APIService.ts            # Direct API calls
├── GA4DataProcessor.ts         # Data transformation
├── GA4StorageService.ts        # Database operations
└── README.md                   # This documentation
```

## Core Components

### GA4DataManager
Main orchestrator providing high-level interface for:
- Period-based data fetching
- Smart 15-month data management
- Current period refresh
- Client access validation

### GA4AuthenticationService
Handles authentication operations:
- Property access retrieval
- Token expiration checking
- Automatic token refresh
- Access validation

### GA4APIService
Direct GA4 API communication:
- Main metrics fetching
- Daily metrics with date dimension
- Traffic channels data
- Device distribution data
- Batch operations for efficiency

### GA4DataProcessor
Data transformation and processing:
- Raw API response parsing
- Data normalization (channels, devices)
- Period averages calculation
- Error handling and validation

### GA4StorageService
Database operations:
- Metric storage (daily/monthly)
- Data status checking
- Storage optimization
- Historical data management

## Usage Examples

### Basic Data Fetching
```typescript
import { GA4DataManager } from '../services/ga4';

const ga4Manager = new GA4DataManager();

// Fetch data for a specific period
const data = await ga4Manager.fetchPeriodData(
  'client-id', 
  '2025-07-01', 
  '2025-07-31', 
  '2025-07'
);

// Fetch daily data
const dailyData = await ga4Manager.fetchDailyData(
  'client-id', 
  '2025-07-01', 
  '2025-07-31', 
  '2025-07'
);
```

### Smart 15-Month Fetch
```typescript
// Intelligent 15-month data fetching with optimization
const result = await ga4Manager.smartFetch({
  clientId: 'client-id',
  periods: 15,
  forceRefresh: false
});

console.log(`Processed ${result.periodsProcessed} periods`);
console.log(`Daily periods: ${result.dailyDataPeriods}`);
console.log(`Monthly periods: ${result.monthlyDataPeriods}`);
```

### Current Period Refresh
```typescript
// Refresh current month's data
const success = await ga4Manager.refreshCurrentPeriod('client-id');
```

### Access Validation
```typescript
// Validate client GA4 access
const isValid = await ga4Manager.validateClientAccess('client-id');
```

## Smart Data Management

The package implements intelligent data management:

1. **Recent Periods (0-3 months)**: Daily granular data
2. **Older Periods (3+ months)**: Monthly summary data
3. **Automatic Optimization**: Replaces daily with monthly data for storage efficiency
4. **Existing Data Checking**: Avoids redundant API calls
5. **Force Refresh Option**: Allows complete data renewal

## Data Types

### Core Data Structures
- `GA4MetricData`: Main metrics with traffic channels and device distribution
- `GA4DailyMetric`: Daily breakdown with date dimension
- `GA4PropertyAccess`: Authentication and property information
- `DataPeriod`: Period configuration with type (daily/monthly)
- `FetchResult`: Comprehensive operation results

### Key Metrics
- Bounce Rate (percentage)
- Session Duration (seconds)
- Pages per Session
- Sessions per User
- Total Sessions
- Total Users
- Traffic Channels (with percentages)
- Device Distribution (with percentages)

## Error Handling

The package implements comprehensive error handling:
- Authentication failures
- API rate limiting
- Invalid property access
- Network timeouts
- Data processing errors
- Storage failures

All errors are logged with context and return meaningful error messages.

## Performance Features

- **Batch API Calls**: Parallel requests for efficiency
- **Token Caching**: Automatic token refresh only when needed
- **Data Optimization**: Smart daily vs monthly data management
- **Cache Integration**: Works with existing performance cache
- **Minimal API Calls**: Checks existing data before fetching

## Migration from Legacy Services

This package replaces:
- `ga4DataService.ts`
- `smartGA4DataFetcher.ts`
- Various scattered GA4 utilities

Old route implementations automatically updated to use new `GA4DataManager`.

## Environment Requirements

Required environment variables:
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

Database requirements:
- PostgreSQL with GA4 schema tables
- Proper indexes for performance

## Future Enhancements

Planned improvements:
- Real-time data streaming
- Custom dimension support
- Enhanced error recovery
- Metrics calculation caching
- Multi-property support