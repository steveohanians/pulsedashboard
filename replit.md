# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. Its purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. The system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking, ultimately enhancing client performance.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture
Pulse Dashboard™ employs a modern full-stack architecture with clear separation between frontend, backend, and data layers, emphasizing performance, data integrity, and scalability.

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
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints for clear functional separation.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration ensure stability and maintainability.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting (max 120 words) and server-side input sanitization.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Each client has one GA4 property.
- **Data Management**: Intelligent 15-month data fetching system with storage optimization, existing data checking, and automatic replacement of daily with monthly data for GA4 and SEMrush. Includes a complete data sync package for 15 months with precise logic.
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
- **Medium Utility Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of medium utility components (60-103 lines) in client/src/components. Added comprehensive JSDoc documentation to MetricsChart, OptimizedChart, DashedBar, and InsightGenerationButton components. Standardized export patterns by converting 3 components from default to named exports for consistency. Updated import dependencies in dashboard.tsx and comprehensive-insights-display.tsx. Enhanced documentation covers component purposes, performance optimizations, parameter descriptions, and special handling logic. All changes verified with successful builds, zero LSP errors, and preserved functionality.
- **Charts Directory & Smaller Chart Components Refactoring (Aug 2025)**: Completed refactoring of specialized chart components in client/src/components. Enhanced charts/ directory (ChartContainer, PerformanceIndicator) with export standardization from default to named exports. Added comprehensive JSDoc documentation to gauge-chart.tsx (MetricGaugeChart) and radial-chart.tsx (MetricRadialChart) covering speedometer gauge visualization and donut chart comparative analysis. Standardized export patterns across all chart components for consistency. Components are currently unused (no import dependencies), making refactoring completely safe. All changes verified with successful builds and server restarts.
- **Dashboard Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of dashboard navigation components (140-149 lines) in client/src/components/dashboard/. Added comprehensive JSDoc documentation to MobileMenu and SideNavigation components covering mobile collapsible navigation and desktop persistent navigation functionality. Enhanced documentation includes parameter descriptions, feature explanations, and behavioral specifications. Standardized export patterns from default to named exports for consistency. Components are currently unused (no import dependencies), ensuring completely safe refactoring. All changes verified with successful builds and page reloads.
- **Quick Wins Export Standardization (Aug 2025)**: Completed export standardization for components with existing good documentation. Enhanced typewriter-text.tsx (81 lines) by converting from default to named export, updated corresponding import in ai-insights.tsx. Refactored pdf-export-component.tsx (30 lines) with comprehensive JSDoc documentation covering performance-optimized PDF export functionality and converted to named export. Both components verified working with server restarts and successful builds.
- **Performance-Optimized & Chart Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of performance-critical components. Enhanced optimized-dashboard.tsx (118 lines) with comprehensive JSDoc documentation covering React.memo, lazy loading, Suspense, and TanStack Query optimizations. Added detailed performance features documentation and caching strategies. Refactored stacked-bar-chart.tsx (158 lines) with comprehensive JSDoc for interactive traffic channel visualization, hover states, color theming, and responsive design. Both components maintain existing named exports and verified with successful builds.
- **Administrative Components Refactoring (Aug 2025)**: Completed comprehensive JSDoc documentation for global-prompt-template-form.tsx (184 lines). Enhanced documentation covers AI prompt template management, TanStack Query integration, mutation handling, form state management, optimistic updates, error handling, and cache invalidation. Component maintains existing named export pattern and verified working with HMR updates and successful builds. Used in admin panel for system-wide AI prompt template configuration.
- **Insights Display Components Refactoring (Aug 2025)**: Completed comprehensive refactoring of comprehensive-insights-display.tsx (205 lines). Added extensive JSDoc documentation covering AI insights fetching, database integration, dashboard vs metric separation, interactive generation, and responsive UI features. Converted from default to named export for consistency and updated import dependency in dashboard.tsx. Component handles comprehensive analytics insights display with TanStack Query integration. Verified working with HMR updates and successful builds.
- **Large Chart Components Refactoring (Aug 2025)**: Completed behavior-preserving refactoring of lollipop-chart.tsx (243 lines). Added comprehensive JSDoc documentation for device distribution visualization, competitive benchmarking, and responsive design features. Created structured interfaces (DeviceDistribution, CompetitorData) for better type safety. Converted from default to named export and updated import dependency in dashboard.tsx. Enhanced internal function documentation for client name extraction and data normalization. Resolved type signature mismatches and verified zero LSP errors with successful builds.

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.