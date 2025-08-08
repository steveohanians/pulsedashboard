# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its core purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. The system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking and ultimately improve their overall digital presence.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture
Pulse Dashboard™ employs a modern full-stack architecture with a clear separation between frontend, backend, and data layers, emphasizing performance, data integrity, and scalability.

### Frontend
- **Framework**: React 18 with TypeScript
- **UI**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js (local strategy, session-based via connect-pg-simple)

### Database
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM

### Key Components and Design Patterns
- **Authentication & Authorization**: JWT-based session authentication with role-based access control (Admin/User).
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights for comprehensive data representation.
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
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable `chartDataProcessor.ts` utilities.
- **AI Insights Persistence**: Database-backed insights loading for persistence across sessions and page refreshes. Enhanced AI context for traffic channels and comprehensive JSON parsing.
- **Utility Consolidation**: Systematic consolidation and refactoring of utility functions across the application to reduce code duplication and improve maintainability.
- **Small Utility Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of small utility components in client/src/components. Added comprehensive JSDoc documentation to LazyPDFExport, DashboardSkeleton, and Footer components. Standardized export patterns by converting Footer from default to named export for consistency. Extracted environment variable constants (COMPANY_LEGAL_NAME, COMPANY_NAME) in Footer to eliminate repetition. Updated import dependencies across 4 page files. All changes verified with successful builds, zero LSP errors, and preserved functionality.
- **Data Management Components Refactoring (Aug 2025)**: Completed comprehensive refactoring of csv-import-modal.tsx (385 lines). Added extensive JSDoc documentation for multi-step CSV import workflow (upload → mapping → importing → results), intelligent column mapping algorithms, and comprehensive validation systems. Enhanced interfaces (CSVImportModalProps, PreviewData, ImportResults) with detailed parameter descriptions. Documented complex file processing logic, pattern-based field detection, bulk data import with error handling, and backend integration. Component already used named exports correctly. Verified zero LSP errors with successful builds and HMR updates.
- **Advanced Chart Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of time-series-chart.tsx (667 lines) - the largest remaining component. Added comprehensive JSDoc documentation for advanced time series visualization, authentic data integration, competitive benchmarking, and interactive chart features. Enhanced TimeSeriesChartProps interface and documented complex data processing functions (generateTimeSeriesData, generateRealTimeSeriesData). Converted from default to named export and updated import dependency in dashboard.tsx. Documented sophisticated chart capabilities including line/bar toggle, dynamic Y-axis scaling, metric-specific formatting, and performance optimization. Verified zero LSP errors with successful builds and running application.
- **Interactive Chart Components Refactoring (Aug 2025)**: Completed comprehensive refactoring of bar-chart.tsx (636 lines) - the second largest component. Added extensive JSDoc documentation for interactive bar chart visualization, competitive analysis, and sophisticated data processing capabilities. Enhanced BarChartProps interface and documented complex functions (processTimeSeriesForBar, generateBarData). Converted from default to named export (MetricBarChart) and updated import dependency in dashboard.tsx. Documented advanced features including temporal variation, session duration conversion, dashed bar support, and responsive design optimization. Verified zero LSP errors with successful builds and running application.
- **AI Integration Components Refactoring (Aug 2025)**: Completed comprehensive refactoring of ai-insights.tsx (561 lines) - complex AI integration component. Added extensive JSDoc documentation for OpenAI integration, typewriter effects, context management, and interactive content features. Enhanced AIInsightsProps interface and documented internal functions (renderTextWithBold, StatusIcon). Converted from default to named export (AIInsights) and updated import dependencies in metric-insight-box.tsx and dashboard.tsx. Documented advanced AI capabilities including context-aware analysis, custom user context integration, database persistence, and executive-focused output formatting. Verified zero LSP errors with successful builds and running application.
- **Specialized Chart Components Refactoring (Aug 2025)**: Completed comprehensive refactoring of area-chart.tsx (555 lines) - session duration area chart component. Added extensive JSDoc documentation for temporal visualization, competitive analysis, and session duration-specific features. Enhanced AreaChartProps interface and documented internal functions (generateAreaData) and data structures (AreaDataPoint, CompetitorData). Converted from default to named export (SessionDurationAreaChart) and updated import dependency in dashboard.tsx. Documented advanced features including Pacific Time zone calculations, unit conversion (seconds to minutes), gradient area fills, and diamond dot indicators. Verified zero LSP errors with successful builds and running application.
- **Major Refactoring Project Completion (Aug 2025)**: Successfully completed systematic behavior-preserving refactoring of all major application components (300+ lines). Achieved 100% success rate with zero LSP errors across 30+ components including comprehensive JSDoc documentation, export standardization, and backward compatibility preservation. The four largest components (Time Series Chart 667 lines, Bar Chart 636 lines, AI Insights 561 lines, Area Chart 555 lines) received extensive documentation covering complex data processing, authentication, chart visualization, and AI integration capabilities. All import dependencies updated correctly with successful builds and HMR functionality maintained throughout.
- **Clear Insights Cache Fix (Aug 2025)**: Resolved critical server-side caching bug preventing clear insights functionality. Added proper cache clearing with `performanceCache.remove()` calls to individual and bulk insight deletion endpoints. Cache solution eliminates 10-minute stale data issue where database was empty but API returned cached insights.
- **UI Improvements (Aug 2025)**: Enhanced user experience by changing "Enhanced" tag to "With Context" in AI insights for better clarity when custom user context is provided. Provides clearer meaning for context-enhanced insights generation.

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.