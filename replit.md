# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its main purpose is to provide AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's internal portfolio. It integrates with various data sources, including Google Analytics 4, to deliver comprehensive web analytics and actionable recommendations. The project aims to enhance clients' digital presence and performance through competitive benchmarking, supporting their business vision and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
SEO preferences: Noindex meta tag applied to prevent search engine crawling.
Branding: Clear Digital favicon applied from company website.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.
Architecture preference: Use enterprise-grade frontend service layer with automatic cache management. All API interactions should go through specialized service classes (clientService, userService, etc.) rather than direct apiRequest calls. Manual cache invalidation is deprecated in favor of automatic dependency-aware cache management.
User creation policy: Registration functionality completely removed from frontend. All user creation handled exclusively through admin panel backend interface.

## System Architecture
Pulse Dashboard™ utilizes a modern full-stack architecture prioritizing performance, data integrity, and scalability, with clear separation between frontend, backend, and data layers.

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

**Key Architectural Decisions and Features:**
- **Authentication & Authorization**: JWT-based session authentication with role-based access control.
- **Data Models**: Structured around key entities like Clients, Benchmark Companies, and Metrics.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline with intelligent 15-month data fetching and daily-to-monthly coalescing.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output and server-side input sanitization, supporting versioned AI insights.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data.
- **Client Data Isolation Verification**: Admin interface for verifying client data metrics, source types, and sample data.
- **Database Performance Optimization**: Indexing, explicit SELECT column optimization, intelligent caching, parallel queries, and connection pooling.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling and historical data system.
- **Metrics Schema**: Overhauled for proper three-way linking using `cd_portfolio_company_id` and `benchmark_company_id`.
- **Global Chart Data Processing**: Extracted fetching, parsing, and conversion logic into reusable utilities with Recharts hardening.
- **Unified Color Management System**: Centralized color assignment across all chart components.
- **Typewriter Animation System**: Sequential typewriter animation for content generation with robust state management.
- **Rendering Optimization**: Elimination of infinite re-render loops and optimized CPU usage via `useMemo` and Set-based state management.
- **Contract Testing**: "Canary" contract tests using Zod schema validation.
- **Time Period Canonicalization**: Comprehensive handling of time periods.
- **Error Handling**: Standardized error handling with UI banners and retry mechanisms.
- **PDF Export System**: Client-side PDF export using html2canvas + jsPDF.
- **Centralized Period Management System**: PeriodService handling all date/period logic for GA4 and SEMrush data alignment, including time zones and data delays.
- **Centralized Data Source Configuration**: `dataSourceConfig` organizes data source characteristics and settings.
- **Production-Safe Logging**: Migration from `console.log` to centralized `debugLog` system with environment-controlled log levels.
- **Metric Processing Service**: Extracted complex `groupedMetrics` logic into reusable `MetricProcessingService` singleton.
- **Traffic Channel Service**: Extracts complex traffic channel data processing logic into a reusable singleton.
- **Device Distribution Service**: Extracts device distribution data processing logic into a singleton service.
- **Data Orchestrator Service**: Master coordination service for all data processing operations, orchestrating period, metric, traffic, and device services, with data quality assessment and performance tracking.
- **Data Source Transparency System**: Admin-only data quality status banner providing details on data source availability and completeness.
- **Performance Optimization**: Lazy-loaded admin panel queries and development server optimization scripts.
- **Frontend API Service Layer**: Enterprise-grade frontend service abstraction mirroring backend API endpoints, using BaseService and specialized service classes.
- **Complete TypeScript Type Safety**: Elimination of all `any` types with proper TypeScript interfaces, generics, and API type definitions.
- **Intelligent Cache Management System**: Dependency-aware cache invalidation system with a CacheManager singleton.
- **Event-Driven Real-Time System**: EventBus architecture for real-time event notifications for async operations, using TypeScript-safe event system and React hooks.
- **Centralized Configuration Management**: Replaces scattered hardcoded values with organized configuration files.
- **Robust Error Handling**: Typed error classes, intelligent retry logic, React ErrorBoundary components, and query-level error states with fallback UI.
- **Comprehensive Testing Infrastructure**: Vitest unit tests, React Testing Library integration tests, Playwright E2E tests, mock service utilities, test data factories, and error handling test coverage.
- **Industry Benchmark Integration**: Follows portfolio integration pattern, with SEMrush data processing for benchmark companies and industry average calculations.
- **Unified Data Service Architecture**: All data processing centralized in `unifiedDataService.ts` for simplified maintenance and faster load times. Includes `useDashboardData.ts` custom hook.
- **Enhanced Device Distribution Processing**: Multi-source compatibility for device distribution data discovery.
- **Complete Competitor Device Distribution Chart System**: Displays authentic SEMrush competitor device data without fallback data.
- **Admin View-As Feature**: Allows administrators to switch dashboard views to any user's perspective.
- **Share of Voice Production Integration**: AI-powered competitive intelligence with `SovService`, API routes, authentication, validated input schemas, error handling, and logging. Provides automated brand research and Share of Voice calculations.
- **Brand Signals UI Refactoring**: Refactors `brand-signals.tsx` into a 3-state system (Idle → Running → Results) using existing Dashboard card components.
- **Benchmark Data Coverage Display**: Correctly displays benchmark companies data coverage and badge status.
- **Dynamic Filter System**: Industry/business size filter functionality with React Query caching and dynamic filter population from `/api/filters/dynamic`.
- **Filtered Industry Averages System**: Calculates authentic segment-specific industry averages based on available metrics data and filter criteria.
- **Comparison Chips System**: Complete implementation of performance comparison chips for key metrics (Bounce Rate, Session Duration, Pages per Session, Sessions per User). Features square-styled chips matching AI insight box design, showing industry and best competitor performance comparisons with color-coded percentages. Includes universal data normalization in comparison utility function and fixed multi-period industry average aggregation bug in unified data service to prevent incorrect re-averaging of pre-calculated Industry_Avg data, ensuring consistent calculations across all time periods.
- **Legacy Code Cleanup (August 2025)**: Removed unused `/api/generate-insights/:clientId` endpoint and associated frontend service method. This legacy endpoint had no active frontend usage and was superseded by specific metric insight endpoints. Also removed unused dashboard components: `dashboard-old-complex.tsx`, `dashboard-minimal.tsx`, and `optimized-dashboard.tsx`. These components had no active imports, contained inconsistent logic, and were causing LSP compilation errors. Cleanup maintains only actively used components for better code maintainability and eliminates dead code.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.