# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its core purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. It integrates with Google Analytics 4 and other data sources to provide comprehensive web analytics, actionable recommendations, and aims to enhance client digital presence and performance through competitive benchmarking, ultimately supporting their business vision and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.
Architecture preference: Use enterprise-grade frontend service layer with automatic cache management. All API interactions should go through specialized service classes (clientService, userService, etc.) rather than direct apiRequest calls. Manual cache invalidation is deprecated in favor of automatic dependency-aware cache management.

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
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline with intelligent 15-month data fetching and daily-to-monthly coalescing.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting and server-side input sanitization, supporting a versioned AI insights architecture.
- **Brandfetch Integration**: Automatic client icon fetching system using Brandfetch's free API tier.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. **Authentication Fix Completed (Aug 2025)**: Resolved "No verified GA4 property access" issues by fixing property access verification flags, enabling successful sync of authentic GA4 data with 214+ metrics across 46 time periods for Demo Company.
- **Client Data Isolation Verification System**: Complete "Check Client Data" button with professional popup dialog in admin interface. Features comprehensive client data verification showing metrics counts, source type breakdown, and sample data. **Period Format Fix Completed (Aug 2025)**: Resolved period format mismatch bug in verification endpoint that was preventing authentic data display - now correctly converts "Last Month" to actual period format ("2025-07") for accurate client data isolation verification. **Dialog Columns Updated (Aug 2025)**: Successfully replaced bounce rate and session duration columns with "Latest Data Period" and "Last GA4 Sync" columns, displaying period format as human-readable months (e.g., "July 2025") and sync timestamps or "Never" for better operational visibility.
- **Database Performance Optimization System**: Comprehensive performance enhancement with indexing, explicit SELECT column optimization, intelligent caching, parallelized queries, and connection pooling.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling and historical data system.
- **Company Management**: Comprehensive company deletion, creation, and validation including duplicate domain checking.
- **Metrics Schema**: Overhauled with `cd_portfolio_company_id` and `benchmark_company_id` for proper three-way linking.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable utilities. Comprehensive Recharts hardening system prevents crashes.
- **Unified Color Management System**: Centralized color assignment across all chart components ensuring consistency.
- **Typewriter Animation System**: Complete sequential typewriter animation system for content generation, with robust state management.
- **Rendering Optimization**: Elimination of infinite re-render loops and optimized CPU usage through `useMemo` and Set-based state management.
- **Contract Testing**: Comprehensive "canary" contract tests using Zod schema validation.
- **Time Period Canonicalization System**: Comprehensive canonical time period handling.
- **Error Handling**: Standardized error handling system with UI banners and retry mechanisms.
- **PDF Export System**: Complete client-side PDF export functionality using html2canvas + jsPDF with advanced reliability features.
- **Centralized Period Management System**: Comprehensive PeriodService handling all date/period logic for GA4 and SEMrush data alignment, including time zone and data delay considerations.
- **Centralized Data Source Configuration System**: Comprehensive `dataSourceConfig` organizing all data source characteristics and settings.
- **Production-Safe Logging System**: Complete migration from `console.log` to centralized `debugLog` system with environment-controlled log levels.
- **Metric Processing Service**: Extracted complex groupedMetrics logic into reusable `MetricProcessingService` singleton.
- **Traffic Channel Service**: Comprehensive `TrafficChannelService` extracting complex traffic channel data processing logic into reusable singleton service.
- **Device Distribution Service**: Complete `DeviceDistributionService` extracting device distribution data processing logic into singleton service architecture.
- **Data Orchestrator Service**: Master coordination service providing unified API for all data processing operations, orchestrating period, metric, traffic, and device services. Features data quality assessment, performance tracking, data source transparency, and intelligent refresh detection.
- **Data Source Transparency System**: Admin-only comprehensive data quality status banner providing detailed transparency about data source availability and completeness.
- **Performance Optimization System**: Comprehensive performance tracking and optimization, including lazy-loaded admin panel queries and development server optimization scripts.
- **Frontend API Service Layer**: Complete enterprise-grade frontend service abstraction layer mirroring backend API endpoints, featuring a BaseService abstract class and specialized service classes.
- **Complete TypeScript Type Safety System**: Comprehensive elimination of all `any` types, with proper TypeScript interfaces, generics, and API type definitions for enterprise-grade compile-time type safety.
- **Intelligent Cache Management System**: Comprehensive dependency-aware cache invalidation system replacing manual calls, featuring a CacheManager singleton with intelligent invalidation rules.
- **Event-Driven Real-Time System**: Comprehensive EventBus architecture replacing polling with real-time event notifications for async operations, using TypeScript-safe event system and React hooks.
- **Centralized Configuration Management System**: Complete centralized configuration system replacing all scattered hardcoded values with organized configuration files. Features `app.config.ts` with API endpoints, polling intervals, toast durations, feature flags, default values, cache settings, UI breakpoints, validation patterns, admin panel settings, and standardized messages. Environment-specific configuration in `env.config.ts` with debug logging support. Eliminates maintenance issues from hardcoded values while enabling easy environment-specific customization. Successfully integrated across admin-panel.tsx, EventBus, and service layers with type-safe configuration access and zero TypeScript errors.
- **Robust Error Handling System**: Comprehensive enterprise-grade error handling architecture featuring typed error classes (AppError, NetworkError, ValidationError, AuthError), intelligent retry logic with exponential backoff, React ErrorBoundary components for crash recovery, centralized error management through ErrorHandler singleton, and query-level error states with fallback UI. Features automatic retry for GET requests, toast notifications with context-aware messages, and graceful degradation. Fully integrated with BaseService layer and admin panel with QueryError components providing consistent error UX across the application.
- **Comprehensive Testing Infrastructure**: Complete enterprise-grade testing framework featuring Vitest unit tests, React Testing Library integration tests, Playwright E2E tests, mock service utilities, test data factories, and error handling test coverage. Includes test utilities with React Query providers, automated test runners, and comprehensive coverage of critical user paths. Architecture-ready with complete test structure for service layer, components, integration scenarios, and end-to-end workflows.
- **Industry Benchmark Integration System (August 2025)**: Complete benchmark integration system following the exact same architectural pattern as portfolio integration. Features benchmarkIntegration.ts with SEMrush data processing for benchmark companies, industry average calculations using 'Industry_Avg' sourceType, and comprehensive data processing pipeline. Includes processBenchmarkCompanyData and calculateIndustryAverages methods with full helper method suite, plus updated storage layer supporting both CD Portfolio and Benchmark company metrics retrieval. Schema enhanced with 'Benchmark' sourceType for complete three-way data isolation between Client, CD Portfolio, and Industry Benchmark data sources. **Admin Panel Integration Completed (August 2025)**: Successfully implemented complete benchmark admin API routes (/api/admin/benchmark/) with sync endpoints for individual company sync, bulk sync-all operations, industry average recalculation, and sync status monitoring. Added SEMrush sync control panel to Benchmark Companies tab with "Sync All Companies" and "Recalculate Industry Avg" buttons, following the same UI pattern as CD Portfolio tab with proper loading states, toast notifications, and error handling. **Industry_Avg Chart Display Fix Completed (August 2025)**: Resolved critical MetricsChart percentage conversion issue where Industry_Avg and CD_Avg values displayed as decimals (0.5%) instead of proper percentages (50%) for rate metrics like Bounce Rate. Added shouldConvertToPercentage utility integration to MetricsChart component with proper decimal-to-percentage conversion logic (value × 100). Includes comprehensive debug endpoints for fallback mechanism troubleshooting and TypeScript null safety improvements. Performance dramatically improved from 2+ minutes to ~2.7 seconds dashboard load times.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.