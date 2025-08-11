# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its core purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. It integrates with Google Analytics 4 and other data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking and improve their digital presence.

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
- **Performance Optimization System**: Reduces load times through intelligent caching, parallelized database queries, background AI processing, chart optimization, database indexing, and connection pooling.
- **Authentic Data Integration**: Ensures authentic Google Analytics 4 and SEMrush data with automatic access token refresh. Never shows fake, sample, or fallback data; employs empty states to maintain data integrity.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation, including an intelligent `CD_Avg` historical data system.
- **Company Management**: Comprehensive company deletion system, robust company creation and validation including duplicate domain checking and SEMrush API health checks.
- **Metrics Schema**: Overhauled with `cd_portfolio_company_id` and `benchmark_company_id` for proper three-way linking.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable utilities.
- **Unified Color Management System**: Centralized color assignment across all six chart components with specialized functions (getChannelColors, getDeviceColors, getMetricsColors, getTimeSeriesColors, getCompetitorColorsArray) while preserving individual chart palettes and ensuring consistent colors for shared series.
- **Code Optimization**: Safely removed unused chart components (radial, gauge) reducing codebase by ~11KB while maintaining full functionality. Area chart remains active for session duration visualization.
- **AI Insights Persistence**: Database-backed insights loading for persistence across sessions and page refreshes. Enhanced AI context for traffic channels and comprehensive JSON parsing.
- **Utility Consolidation**: Systematic consolidation and refactoring of utility functions across the application to reduce code duplication and improve maintainability.
- **Background Processing Concurrency Safety**: Enhanced background processor with separate retry queue, atomic retry operations, and elimination of concurrent modification issues during queue processing.
- **Rate Limiter Safety**: Implemented snapshot-based iteration pattern in rate limiter to prevent concurrent modification during cleanup operations.
- **GA4 Health Monitoring**: Comprehensive health check infrastructure including database metrics validation script and endpoint smoke testing for monitoring GA4 data pipeline integrity.
- **Complete Architectural Documentation**: Systematic mapping and documentation across four core domains: Backend Infrastructure (50+ server files), Frontend Architecture (100+ client files, 7 pages, 10 chart components), Configuration & Environment (25+ variables, build systems), and Database Schema (17 tables, relationships, GA4 integration). Full architectural understanding achieved with comprehensive coverage verification.
- **End-to-End Data Flow Documentation**: Complete tracing of critical user flows including TimeSeriesChart data retrieval, LollipopChart device distribution processing, and Admin cleanup & refetch operations. Documentation includes frontend triggers, API requests, route handlers, service invocations, database operations, response shapes, caching strategies, and environment flag impacts. Identified 5 key breakpoints and potential issues across time period formats, JSONB parsing, concurrency control, environment dependencies, and authentication complexity.
- **API Contract Standardization**: Implemented Zod validation schemas for DashboardData, FilterOptions, and AIInsight responses in shared/http/contracts.ts with server-side validation at key endpoints (/api/dashboard, /api/filters, /api/ai-insights). Added SCHEMA_MISMATCH error handling and standardized React Query keys to hierarchical format: ["/api/dashboard", clientId, timePeriod], ["/api/filters"], ["/api/ai-insights", clientId, timePeriod]. Resolved parameter naming inconsistencies between frontend (businessSize) and backend (currentBusinessSize) ensuring consistent frontend-backend communication shapes.
- **AI Insights Route Canonicalization**: Established /api/ai-insights/:clientId as the canonical route for AI insights with backward-compatible aliases (/api/insights/:clientId and /api/insights) that include deprecation headers (Deprecation: true, Sunset: 2026-01-01, Link: successor-version). Updated QueryKeys.insights to use "/api/ai-insights" pattern and replaced all legacy string-based query invalidation patterns across dashboard.tsx and metric-insight-box.tsx components. Verified payload consistency between canonical and legacy routes through testing.
- **Complete Query Key Migration to Tuple-Based System**: Eliminated all string-based query keys (queryKey: ["/api/..."]) across the entire codebase, replacing them with centralized tuple-based helpers from QueryKeys and AdminQueryKeys. Created comprehensive AdminQueryKeys helper system covering all admin endpoints (clients, users, benchmarkCompanies, cdPortfolio, filterOptions, metricPrompts, ga4PropertyAccess, ga4ServiceAccounts). Implemented ESLint rules to prevent future string-based query patterns. Enhanced type safety and maintainability through const assertions and hierarchical query key structure. Verified zero remaining string-based patterns except for properly typed core authentication endpoint.
- **Cache and Locks Observability System**: Implemented comprehensive GA4 status tracking with StatusRegistry.ts for per-(clientId,timePeriod) fetch state management. Features include real-time status polling (3-second intervals), StatusBanner.tsx component showing sync progress with admin force refresh capability, GA4 status API endpoints (/api/ga4-data/status/:clientId, /api/ga4-data/force-refresh/:clientId), SmartDataFetcher integration with jitter/backoff, and automatic cleanup of old statuses. System provides complete visibility into GA4 fetch operations with indicators for in-progress syncs, last updated timestamps, error states, and admin controls for force refresh operations.
- **Contract Testing with Zod + Node.js Testing**: Implemented comprehensive "canary" contract tests using Zod schema validation and Node.js built-in testing framework to prevent API regression. Created server/__tests__/contracts.spec.ts with positive contract tests (validates DashboardResponseSchema, FiltersResponseSchema, InsightsResponseSchema) and negative contract tests (validates 400/422 error responses with SCHEMA_MISMATCH codes). Tests verify authentication middleware enforcement (401 responses), stable JSON error structure, and schema consistency between frontend and backend. Established run-contracts.sh script and comprehensive documentation for CI/CD integration. Contract tests serve as regression protection for API endpoints, authentication system, and error handling workflows.
- **Time Period Canonicalization System**: Implemented comprehensive canonical time period handling system replacing scattered ad-hoc date logic with centralized pure function adapters (parseUILabel, toDbRange, toGa4Range). System supports all time periods (Last Month, Last Quarter, Last Year, custom ranges) with full edge case handling including leap years, year boundaries, and UTC timezone consistency. Achieved 100% test coverage with 26 unit tests and 8 integration tests. Features backward-compatible legacy label support with deprecation warnings, SCHEMA_MISMATCH error handling for invalid periods, and performance optimization (<1ms per operation). Completed end-to-end implementation from UI labels → canonical objects → database ranges → GA4 date ranges with React Query key compatibility and server-side canonicalization.
- **Canonical Metric Envelope System**: Implemented comprehensive write-time metric normalization ensuring all metrics stored in Postgres follow a unified JSON structure eliminating source-specific branching in chart readers. Features: Zod schema validation (CanonicalMetricEnvelopeSchema), transformation utilities for GA4/SEMrush/DataForSEO sources, write-path enforcement with SCHEMA_MISMATCH error handling, dual-read capability during migration (canonical preferred, legacy fallback), background migration script with FEATURE_CANONICAL_ENVELOPE=true gate, simplified chart utilities, and comprehensive unit tests. Target envelope structure: {"series": [{"date": "YYYY-MM-DD", "value": number, "dimensions": {...}}], "meta": {"sourceType": "GA4"|"SEMrush"|"DataForSEO", "units": string}}. Added canonicalEnvelope field to metrics table maintaining backward compatibility during migration.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.