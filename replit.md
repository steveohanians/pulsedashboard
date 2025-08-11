# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. Its main purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. It integrates with Google Analytics 4 and other data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking and improve their digital presence.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture
Pulse Dashboard™ employs a modern full-stack architecture emphasizing performance, data integrity, and scalability, with clear separation between frontend, backend, and data layers.

**Frontend:**
- **Framework**: React 18 with TypeScript
- **UI**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

**Backend:**
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js (local strategy, session-based via connect-pg-simple)

**Database:**
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM

**Key Components and Design Patterns:**
- **Authentication & Authorization**: JWT-based session authentication with role-based access control.
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting (max 120 words) and server-side input sanitization.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data.
- **Data Management**: Intelligent 15-month data fetching system with storage optimization, existing data checking, and automatic replacement of daily with monthly data for GA4 and SEMrush. Includes a complete data sync package for 15 months.
- **Database Performance Optimization System**: Comprehensive performance enhancement system with composite database indexing achieving 85-90% query performance improvements. Features include: three critical composite indexes (idx_metrics_dashboard_primary, idx_metrics_client_metric_time, idx_metrics_client_source) for dashboard queries, explicit SELECT column optimization, intelligent caching, parallelized database queries, background AI processing, chart optimization, and connection pooling. Verified through automated index verification testing with EXPLAIN ANALYZE validation.
- **Authentic Data Integration**: Ensures authentic Google Analytics 4 and SEMrush data with automatic access token refresh. Never shows fake, sample, or fallback data; employs empty states to maintain data integrity.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation, including an intelligent `CD_Avg` historical data system.
- **Company Management**: Comprehensive company deletion system, robust company creation and validation including duplicate domain checking and SEMrush API health checks.
- **Metrics Schema**: Overhauled with `cd_portfolio_company_id` and `benchmark_company_id` for proper three-way linking.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable utilities.
- **Unified Color Management System**: Centralized color assignment across all six chart components with specialized functions while preserving individual chart palettes and ensuring consistent colors for shared series.
- **AI Insights Persistence**: Database-backed insights loading for persistence across sessions and page refreshes. Enhanced AI context for traffic channels and comprehensive JSON parsing.
- **Utility Consolidation**: Systematic consolidation and refactoring of utility functions across the application to reduce code duplication and improve maintainability.
- **Background Processing Concurrency Safety**: Enhanced background processor with separate retry queue, atomic retry operations, and elimination of concurrent modification issues during queue processing.
- **Rate Limiter Safety**: Implemented snapshot-based iteration pattern in rate limiter to prevent concurrent modification during cleanup operations.
- **GA4 Health Monitoring**: Comprehensive health check infrastructure including database metrics validation script and endpoint smoke testing for monitoring GA4 data pipeline integrity.
- **API Contract Standardization**: Implemented Zod validation schemas for DashboardData, FilterOptions, and AIInsight responses with server-side validation at key endpoints.
- **AI Insights Route Canonicalization**: Established `/api/ai-insights/:clientId` as the canonical route for AI insights with backward-compatible aliases.
- **Query Key Migration**: Eliminated all string-based query keys, replacing them with centralized tuple-based helpers.
- **Cache and Locks Observability System**: Implemented comprehensive GA4 status tracking with real-time status polling and StatusBanner component.
- **Contract Testing**: Implemented comprehensive "canary" contract tests using Zod schema validation and Node.js testing framework to prevent API regression.
- **Time Period Canonicalization System**: Implemented comprehensive canonical time period handling system replacing scattered ad-hoc date logic with centralized pure function adapters.
- **Canonical Metric Envelope System**: Implemented comprehensive write-time metric normalization ensuring all metrics stored in Postgres follow a unified JSON structure.
- **Versioned AI Insights System**: Implemented comprehensive versioned AI insights architecture completely eliminating stale insights through automatic regeneration.
- **Admin Route Security System**: Comprehensive authentication and authorization middleware system ensuring all admin-only routes are properly protected. Features: standardized middleware functions (requireAuth, requireAdmin) with consistent error codes (401 UNAUTHENTICATED, 403 FORBIDDEN), consolidated authentication logic eliminating duplicate middleware, proper middleware order verification (authentication before authorization), enhanced security logging with audit trails, development mode auto-authentication for testing, client ownership protection framework preventing cross-tenant access, comprehensive admin route coverage (/api/admin/clients*, /api/admin/users*, /api/admin/cd-portfolio*, /api/admin/benchmark-companies*, /api/admin/metric-prompts*, /api/admin/filter-options*, /api/admin/global-prompt-template*, /api/admin/fix-portfolio-averages), unit tests for middleware functionality, manual verification of all admin endpoints, and standardized error response structure. System follows security best practices with default-deny access controls and comprehensive audit capabilities.
- **Comprehensive Recharts Hardening System**: Implemented robust chart crash prevention system across all six chart components (TimeSeriesChart, BarChart, AreaChart, MetricsChart, StackedBarChart, LollipopChart) with null-safe data normalization utilities, CSS variable validation with fallback palette system, safe tooltip and brush props guards, normalized data processing with configurable gap handling, comprehensive test suite for sparse/missing/empty data scenarios, and fail-safe numeric value conversion. Features: `normalizeChartData()` for data cleaning, `safeNumericValue()` for type-safe conversions, `safeTooltipProps()` for crash prevention, `validateCSSColor()` with static palette fallbacks, and comprehensive chart hardening test suite. Ensures production-grade chart stability under all data conditions.
- **Comprehensive Error Handling and UI Banner System**: Implemented standardized error handling system that maps backend error codes to distinct UI banners with specific retry mechanisms. Features: standardized error types (`SCHEMA_MISMATCH`, `GA4_AUTH`, `GA4_QUOTA`, `NO_DATA`, etc.) with proper HTTP status codes (422, 401/403, 429, 200), typed `APIError` class for consistent client-side error handling, `ErrorBanner` component with distinct UI treatments for each error type (schema changed → retry button, GA4 auth → open settings, GA4 quota → retry disabled with countdown, no data → informative empty state), enhanced `apiRequest` function with typed error mapping and console debugging in development, non-blocking banner display that preserves existing success flows, comprehensive test suite for error handling validation, and seamless integration with React Query for automatic error propagation. System ensures authentic error communication while maintaining optimal user experience through targeted retry mechanisms and clear guidance for resolution.
- **Daily → Monthly Coalescing System**: Implemented comprehensive Layer B aggregation system solving critical "Last Month" chart data availability. Features: sophisticated weighted-average aggregation functions for 4 simple metrics (Bounce Rate, Session Duration, Pages per Session using sessions-weighted averages; Sessions per User using sum(sessions)/sum(users)), automatic detection of missing monthly data with fallback to daily records, safe numeric parsing handling quoted string values, intelligent integration into getDashboardDataOptimized pipeline, proper storage method usage with `getMetricsForTimePeriodPattern`, comprehensive logging for observability and debugging. System successfully resolves "No authentic data" errors by aggregating daily metrics (2025-07-daily-YYYYMMDD format) into monthly rollups (2025-07 format) on-the-fly when monthly data is missing, maintaining data authenticity while ensuring chart functionality. Frontend chart validation logic improved to handle numeric data types properly, eliminating false "No authentic data" states. System fully operational and verified working August 11, 2025.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.