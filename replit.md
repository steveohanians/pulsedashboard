# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. It integrates with Google Analytics 4 and other data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client digital presence and performance through competitive benchmarking.

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
- **Authentication**: Passport.js

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
- **Database Performance Optimization System**: Comprehensive performance enhancement system with composite database indexing, explicit SELECT column optimization, intelligent caching, parallelized database queries, background AI processing, chart optimization, and connection pooling.
- **Authentic Data Integration**: Ensures authentic Google Analytics 4 and SEMrush data with automatic access token refresh, using empty states rather than synthetic data.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, data validation, and an intelligent `CD_Avg` historical data system.
- **Company Management**: Comprehensive company deletion system, robust company creation and validation including duplicate domain checking and SEMrush API health checks.
- **Metrics Schema**: Overhauled with `cd_portfolio_company_id` and `benchmark_company_id` for proper three-way linking.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable utilities.
- **Unified Color Management System**: Centralized color assignment across all six chart components with specialized functions while preserving individual chart palettes and ensuring consistent colors for shared series.
- **AI Insights Persistence System**: Comprehensive database-backed insights with server-computed badge persistence, true transactional deletion, and period-compatible queries.
- **AI Insights Loading State Resolution**: Centralized hook optimization and proper spinner logic to resolve "Regenerating..." issues.
- **"With Context" Badge System**: Implemented comprehensive "With Context" badge display system for AI insights with complete server-side computation. **Fixed critical data synchronization bug** (August 2025) where badges flashed and disappeared due to unsynchronized data sources between preloadedInsight and useAIInsights hook. **Fixed field name inconsistency bug** (August 2025) where two boolean fields (`hasContext` and `hasCustomContext`) were being maintained but only one was read, causing badges to not show when context was provided. **Completed full backend implementation** (August 2025) with SQL EXISTS query checking `insightContexts` table, ensuring badges only appear when actual user context exists. **Resolved database schema alignment issues** (August 2025) fixing camelCase/snake_case column name mismatches and removing non-existent period filtering from context queries. **Implemented dual parameter support** (August 2025) accepting both `period=YYYY-MM` and `timePeriod=Last Month` formats with automatic canonicalization. **Eliminated all fallback hasContext logic** (August 2025) removing `Boolean(aiInsights.contextText?.trim() || ...)` patterns from all three storage methods (`getInsightsWithContext`, `getAIInsightWithContext`, `getAIInsightsForPeriod`) and replaced with pure EXISTS queries against `insightContexts` table. **Removed duplicate legacy handler** (August 2025) ensuring single canonical `/api/ai-insights/:clientId` endpoint. All code paths now use server-computed `hasContext` field consistently with explicit boolean values and proper loading state management. **Applied blue theme styling** (August 2025) with AI Sparkles icon, light blue background (`bg-blue-50`), blue border (`border-blue-200`), blue text (`text-blue-700`), rectangular design with rounded corners similar to admin Active buttons, and professional hover effects for enhanced UI/UX. **Implemented comprehensive MetricInsightBox DELETE and typewriter fixes** (August 2025) adding `lastTypedRef` tracking, optimistic DELETE with immediate cache surgery preventing flash-back to old text, enhanced hydration guards with `suppressHydrationRef`, and robust typewriter trigger monitoring `metricInsight?.insightText` changes for reliable animation.
- **Utility Consolidation**: Systematic consolidation and refactoring of utility functions across the application.
- **Background Processing Concurrency Safety**: Enhanced background processor with separate retry queue and atomic retry operations.
- **Rate Limiter Safety**: Implemented snapshot-based iteration pattern in rate limiter.
- **GA4 Health Monitoring**: Comprehensive health check infrastructure including database metrics validation script and endpoint smoke testing.
- **API Contract Standardization**: Implemented Zod validation schemas for API responses with server-side validation.
- **AI Insights Route Canonicalization**: Established `/api/ai-insights/:clientId` as the canonical route.
- **Query Key Migration**: Eliminated all string-based query keys, replacing them with centralized tuple-based helpers.
- **Cache and Locks Observability System**: Implemented comprehensive GA4 status tracking with real-time status polling.
- **Contract Testing**: Implemented comprehensive "canary" contract tests using Zod schema validation.
- **Time Period Canonicalization System**: Implemented comprehensive canonical time period handling system.
- **Canonical Metric Envelope System**: Implemented comprehensive write-time metric normalization.
- **Versioned AI Insights System**: Implemented comprehensive versioned AI insights architecture with automatic regeneration.
- **Admin Route Security System**: Comprehensive authentication and authorization middleware system ensuring all admin-only routes are properly protected.
- **Comprehensive Recharts Hardening System**: Implemented robust chart crash prevention across all six chart components with null-safe data normalization, CSS variable validation, safe tooltip/brush props guards, and comprehensive test suite.
- **Comprehensive Error Handling and UI Banner System**: Implemented standardized error handling system that maps backend error codes to distinct UI banners with specific retry mechanisms.
- **Daily → Monthly Coalescing System**: Implemented comprehensive Layer B aggregation system for "Last Month" chart data availability, including weighted-average aggregation for key metrics and automatic detection of missing monthly data with fallback to daily records.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.