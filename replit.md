# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to provide AI-powered insights into web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. The system integrates with Google Analytics 4 and other external data sources to deliver comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture
Pulse Dashboard™ employs a modern full-stack architecture with clear separation between frontend, backend, and data layers.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit

### Key Components and Design Patterns
- **Authentication & Authorization**: JWT-based session authentication with role-based access control (Admin/User).
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion, processing, normalization, and an analytics pipeline for benchmark calculations and AI analysis.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting (max 120 words) and server-side input sanitization.
- **Code Consolidation**: Enterprise-level code organization by consolidating duplicate functions and patterns.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Each client has one GA4 property.
- **Clean GA4 Data Management Package**: Modular `server/services/ga4/` service with separation of concerns, data optimization, batch operations, error handling, and 15-month data management.
- **Performance Optimization System**: Reduces load times through intelligent caching, parallelized database queries, background AI processing, chart optimization, database indexing, and connection pooling.
- **Authentic GA4 Data Integration**: Integrated authentic Google Analytics 4 data with automatic access token refresh and comprehensive API data fetching. Includes enterprise-grade error handling.
- **Smart 15-Month GA4 Data Fetching System**: Intelligent data fetching across 15 months with storage optimization, existing data checking, and automatic replacement of daily with monthly data.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management including historical data population and daily data fetching.
- **Complete GA4 Data Sync Package**: Production-ready single-command GA4 data synchronization clearing existing data and fetching 15 months with precise logic.
- **Complete SEMrush Integration Package**: Automated SEMrush integration fetches 15 months of historical data for CD Portfolio companies, including domain extraction, intelligent data processing, portfolio average calculations, and data isolation.
- **Unified 2-Device Model Implementation**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Authentic SEMrush Historical Data Integration**: Fetches authentic monthly historical data using SEMrush Analytics API v3.
- **Complete Fallback Data Elimination**: Permanently disabled all sample and synthetic data generators to ensure 100% authentic data integrity, showing empty states when authentic data is unavailable.
- **Bulletproof Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation; fixed historical period generation.
- **Complete Portfolio Company Deletion System**: Implemented comprehensive deletion logic removing company records, preserving other CD_Portfolio source data, recalculating portfolio averages, and clearing caches.
- **Admin Panel Loading Animations**: Consistent loading states across all admin panel tables using `Loader2` component for improved UX.
- **Enhanced Fallback Averaging System**: Rebuilt CD_Avg fallback logic to calculate fresh averages from multiple companies' authentic data.
- **Intelligent CD_Avg Historical Data System**: Enhanced `getFilteredCdAvgMetrics` to check for period-specific `CD_Portfolio` data before using fallbacks, adding deterministic temporal variation for historical periods.
- **SEMrush Traffic Channel Solution**: Integrated SEMrush traffic channel data from the Summary endpoint, including proper column extraction and percentage calculation, and implemented SEMrush-specific date mapping.
- **Complete Portfolio Company Data Viewer System**: Implemented comprehensive data viewer functionality allowing admin users to view all fetched metrics for portfolio companies via an API endpoint and modal component.
- **Complete Metrics Schema Overhaul**: Added `cd_portfolio_company_id` and `benchmark_company_id` fields to metrics table, enabling proper three-way linking to portfolio companies, competitor companies, and benchmark companies.
- **Global Chart Data Processing Architecture**: Extracted proven fetching, parsing, fallback, and conversion logic into reusable `chartDataProcessor.ts` utilities. Consolidated 30+ lines of duplicate competitor mapping code per chart into 7-line function calls. Created `processCompanyMetrics()` and `processDeviceDistribution()` functions that parameterize display mode (average vs individual) and source type (Portfolio/Competitor/Benchmark). This architecture makes adding benchmark companies trivial - just call the same proven functions with different parameters. Eliminated code duplication across TimeSeriesChart, MetricBarChart, and Device Distribution components (August 2025).
- **Global Company Deletion System**: Created comprehensive `companyDeletionUtils.ts` with reusable deletion logic for portfolio companies, competitors, and benchmark companies. Enhanced all deletion methods with sophisticated context analysis, comprehensive metric cleanup, cache clearing, recalculation logic, and detailed logging. Competitors and benchmarks now use the same proven deletion patterns as portfolio companies, ensuring consistent data integrity across all company types (August 2025).
- **Global Company Creation System**: Created comprehensive `companyCreationUtils.ts` with reusable creation logic for portfolio companies, competitors, benchmark companies, and clients. Consolidated common validation patterns (schema + filter validation), logging, error handling, and post-creation workflows (like SEMrush integration) into a single, parameterized system. Handles different data structures while globalizing common patterns, reducing creation route code by ~70% and ensuring consistent validation and workflow orchestration across all company types (August 2025).
- **Bar Chart Time Period Fallback System**: Fixed Session Duration competitor display issue in bar charts by implementing intelligent fallback logic in `processTimeSeriesForBar`. When competitor data doesn't exist for the exact requested period (e.g., July 2025), the system now uses the most recent available data (e.g., June 2025) ensuring competitors always display meaningful values instead of zeros. This resolves time period mismatches between dashboard views and available competitor data (August 2025).
- **Synchronous Competitor Historical Data Integration**: Fixed competitor creation to fetch 15 months of SEMrush historical data synchronously instead of in background, ensuring immediate availability of historical periods. Added admin route `/api/admin/competitors/:id/resync-semrush` for manually re-syncing existing competitor data. This resolves the issue where new competitors only showed last month data instead of complete historical context (August 2025).

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.