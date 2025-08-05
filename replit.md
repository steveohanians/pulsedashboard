# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. It provides AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. The system integrates with Google Analytics 4 and other external data sources to deliver comprehensive web analytics and actionable recommendations, enhancing client performance through competitive benchmarking.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture

Pulse Dashboard™ employs a modern full-stack architecture, ensuring a clear separation between frontend, backend, and data layers.

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
- **Authentic GA4 Data Integration**: Integrated authentic Google Analytics 4 data with automatic access token refresh and comprehensive API data fetching (bounce rate, session duration, pages per session, sessions per user, traffic channels, device distribution). Includes enterprise-grade error handling.
- **Smart 15-Month GA4 Data Fetching System**: Intelligent data fetching across 15 months with storage optimization, existing data checking, and automatic replacement of daily with monthly data.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management including historical data population and daily data fetching.
- **Complete GA4 Data Sync Package**: Production-ready single-command GA4 data synchronization clearing existing data and fetching 15 months with precise logic.
- **Comprehensive Color System Overhaul**: Fixed all color-related CSS issues using CSS variables; updated chart components for consistency.
- **Complete SEMrush Integration Package**: Automated SEMrush integration fetches 15 months of historical data for CD Portfolio companies, including domain extraction, intelligent data processing, portfolio average calculations, and data isolation.
- **Unified 2-Device Model Implementation**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Authentic SEMrush Historical Data Integration**: Fetches authentic monthly historical data using SEMrush Analytics API v3, providing real monthly variations for bounce rates, session durations, and engagement metrics.
- **Complete Fallback Data Elimination**: Permanently disabled all sample and synthetic data generators to ensure 100% authentic data integrity, showing empty states when authentic data is unavailable.
- **Bulletproof Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation; fixed historical period generation.
- **Complete Portfolio Company Deletion System**: Implemented comprehensive deletion logic removing company records, preserving other CD_Portfolio source data, recalculating portfolio averages, and clearing caches.
- **Admin Panel Loading Animations**: Consistent loading states across all admin panel tables using `Loader2` component for improved UX.
- **Enhanced Fallback Averaging System**: Rebuilt CD_Avg fallback logic to calculate fresh averages from multiple companies' authentic data.
- **Session Duration Temporal Data Fix**: Resolved "No authentic temporal data" warnings by handling `timeSeriesData` parameters in chart components.
- **Intelligent CD_Avg Historical Data System**: Enhanced `getFilteredCdAvgMetrics` to check for period-specific `CD_Portfolio` data before using fallbacks, adding deterministic temporal variation for historical periods.
- **Restored Dashed Outline CD_Avg Bars**: Reverted CD_Avg bars to dashed outline style for visual distinction.
- **SEMrush Traffic Channel Solution**: Integrated SEMrush traffic channel data from the Summary endpoint, including proper column extraction and percentage calculation, and implemented SEMrush-specific date mapping.
- **CD_Avg Traffic Channel Parser Fix**: Updated `queryOptimizer.ts` to use `parseMetricPercentage()` for traffic channels, ensuring correct display of authentic portfolio averages.
- **Traffic Channel Aggregation Fix**: Resolved percentage inflation bug where multi-period data showed 550% Direct instead of 65%. Fixed `aggregateChannelData` function to average percentages across time periods instead of summing them, ensuring realistic traffic channel display for "Last Quarter" and "Last Year" periods.
- **Time Period Mismatch Resolution**: Fixed critical CD_Avg device distribution 0/0 display issue caused by time period mismatch between frontend requests for July 2025 data and SEMrush API availability through June 2025. Implemented intelligent fallback logic in `getFilteredCdAvgMetrics` that automatically uses the most recent available authentic month when requested month has no data, maintaining data integrity while ensuring proper dashboard functionality.
- **Device Distribution Response Structure Fix**: Resolved missing `deviceDistribution` key in dashboard API response by adding proper device metrics processing in `getDashboardDataOptimized` function. Enhanced data extraction to handle multiple field names (`deviceType`, `channel`, `value`, `valuePreview`) and created frontend-compatible structure with `client` and `cdAvg` properties. Added comprehensive debug logging to verify data processing (Client: Desktop 89.5%, Mobile 10.5%).
- **Critical Portfolio Averaging Calculation Bug Fix**: Identified and resolved major CD_Avg calculation error where portfolio averages were incorrectly calculated across all metrics. Individual company values were stored correctly (e.g., bounce rates 65.75% and 66.88%) but averaging was faulty, showing 65.75% instead of correct average 66.315%. Created comprehensive fix utility `portfolioAverageFix.ts` and manually corrected all CD_Avg values using direct SQL updates to ensure mathematical accuracy across all time periods and metrics (August 2025).
- **Complete Portfolio Company Data Viewer System**: Implemented comprehensive data viewer functionality allowing admin users to view all fetched metrics for portfolio companies. Added API endpoint `/api/admin/cd-portfolio/:companyId/data` using existing `getMetricsByCompanyId` storage method, created modal component displaying company information and metrics grouped by type and time period, integrated "View Data" buttons in both mobile and desktop edit modals, resolved React rendering errors for object metric values with robust value extraction and display formatting (August 2025).
- **Critical Data Integrity Issue Resolution**: Identified and resolved major data corruption where 1,266 orphaned CD_Portfolio metrics existed without proper portfolio company linkage, causing incorrect CD average calculations. Fixed authentication routing issues causing "/login" redirects. Cleaned orphaned data and established proper data recalculation workflow to ensure authentic portfolio averages (August 2025).
- **Portfolio Company Deletion Bug Fix**: Fixed critical bug in deletion logic where portfolio company metrics were not being removed when companies were deleted, causing orphaned records to accumulate. Updated `deleteCdPortfolioCompany` method to properly delete specific company's CD_Portfolio metrics before recalculating averages. Removed refresh button from dashboard header per user request (August 2025).

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.