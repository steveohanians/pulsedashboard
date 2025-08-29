# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. It provides AI-powered web analytics by benchmarking client performance against competitors, industry averages, and Clear Digital's internal portfolio. Integrating with data sources like Google Analytics 4, it delivers comprehensive web analytics and actionable recommendations to enhance clients' digital presence and performance through competitive benchmarking.

## Recent Changes

### AI Insights Integration Optimization (August 2025)
**Major integration completed to optimize AI insights generation for website effectiveness scoring.**

**Database Changes:**
- Added 2 new columns to `effectiveness_runs` table: `ai_insights` (JSONB) and `insights_generated_at` (TIMESTAMP)
- Migration applied: `migrations/add_insights_to_effectiveness_runs.sql`

**Backend Changes:**
- `server/routes/effectivenessRoutes.ts`: Modified scoring process to generate insights during effectiveness runs (lines 195-255)
- `shared/schema.ts`: Added new columns to schema definition  
- `server/index.ts`: Fixed port binding issue (removed reusePort: true)

**Frontend Changes:**
- `client/src/components/effectiveness-card.tsx`: Updated to use stored insights and improved caching
- `client/src/components/effectiveness-ai-insights.tsx`: Modified to accept stored insights as props

**Key Integration Points:**
- Insights now generate automatically during scoring (after overallScore is set)
- Frontend receives insights immediately with run data (no separate API call needed)
- Maintains backwards compatibility with existing `/insights` endpoint as fallback

**Rollback Strategy:**
If issues arise, comment out lines 199-244 in `server/routes/effectivenessRoutes.ts` to revert to on-demand insights generation. Database columns can remain (safe to ignore).

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
- **Data Models**: Structured around Clients, Benchmark Companies, and Metrics.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline with intelligent 15-month data fetching and daily-to-monthly coalescing.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output and server-side input sanitization, supporting versioned AI insights. Includes database-driven template storage and admin UI for managing SOV question generation prompts with dynamic placeholders.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Includes a comprehensive multi-service account system for managing GA4 access, with admin UI components and client-specific data synchronization controls.
- **Client Data Isolation Verification**: Admin interface for verifying client data metrics, source types, and sample data.
- **Database Performance Optimization**: Indexing, explicit SELECT column optimization, intelligent caching, parallel queries, and connection pooling.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling and historical data system.
- **Metrics Schema**: Overhauled for proper three-way linking.
- **Global Chart Data Processing**: Extracted fetching, parsing, and conversion logic into reusable utilities with Recharts hardening.
- **Unified Color Management System**: Centralized color assignment across all chart components.
- **Typewriter Animation System**: Sequential typewriter animation for content generation with robust state management.
- **Rendering Optimization**: Elimination of infinite re-render loops and optimized CPU usage via `useMemo` and Set-based state management.
- **Contract Testing**: "Canary" contract tests using Zod schema validation.
- **Time Period Canonicalization**: Comprehensive handling of time periods.
- **Error Handling**: Standardized error handling with UI banners and retry mechanisms.
- **PDF Export System**: Client-side PDF export using html2canvas + jsPDF.
- **Centralized Period Management System**: `PeriodService` handling all date/period logic for GA4 and SEMrush data alignment, including time zones and data delays.
- **Centralized Data Source Configuration**: `dataSourceConfig` organizes data source characteristics and settings.
- **Production-Safe Logging**: Migration from `console.log` to centralized `debugLog` system with environment-controlled log levels.
- **Metric Processing Services**: Extracted complex `groupedMetrics` logic into reusable `MetricProcessingService`, `Traffic Channel Service`, and `Device Distribution Service` singletons.
- **Data Orchestrator Service**: Master coordination service for all data processing operations, orchestrating period, metric, traffic, and device services, with data quality assessment and performance tracking.
- **Data Source Transparency System**: Admin-only data quality status banner providing details on data source availability and completeness.
- **Performance Optimization**: Lazy-loaded admin panel queries and development server optimization scripts.
- **Frontend API Service Layer**: Enterprise-grade frontend service abstraction mirroring backend API endpoints, using `BaseService` and specialized service classes with automatic cache management.
- **Complete TypeScript Type Safety**: Elimination of all `any` types with proper TypeScript interfaces, generics, and API type definitions.
- **Event-Driven Real-Time System**: EventBus architecture for real-time event notifications for async operations, using TypeScript-safe event system and React hooks.
- **Centralized Configuration Management**: Replaces scattered hardcoded values with organized configuration files.
- **Robust Error Handling**: Typed error classes, intelligent retry logic, React ErrorBoundary components, and query-level error states with fallback UI.
- **Comprehensive Testing Infrastructure**: Vitest unit tests, React Testing Library integration tests, Playwright E2E tests, mock service utilities, test data factories, and error handling test coverage.
- **Industry Benchmark Integration**: Follows portfolio integration pattern, with SEMrush data processing for benchmark companies and industry average calculations.
- **Unified Data Service Architecture**: All data processing centralized in `unifiedDataService.ts` for simplified maintenance and faster load times. Includes `useDashboardData.ts` custom hook.
- **Enhanced Device Distribution Processing**: Multi-source compatibility for device distribution data discovery.
- **Complete Competitor Device Distribution Chart System**: Displays authentic SEMrush competitor device data without fallback data.
- **Admin View-As Feature**: Allows administrators to switch dashboard views to any user's perspective.
- **Share of Voice Production Integration**: AI-powered competitive intelligence with `SovService`, API routes, authentication, validated input schemas, error handling, and logging. Provides automated brand research and Share of Voice calculations with enhanced question generation for buyer journey coverage.
- **Brand Signals UI Refactoring**: Refactors `brand-signals.tsx` into a 3-state system (Idle → Running → Results).
- **Benchmark Data Coverage Display**: Correctly displays benchmark companies data coverage and badge status.
- **Dynamic Filter System**: Industry/business size filter functionality with React Query caching and dynamic filter population.
- **Filtered Industry Averages System**: Calculates authentic segment-specific industry averages based on available metrics data and filter criteria.
- **Comparison Chips System**: Implementation of performance comparison chips for key metrics, showing industry and best competitor performance comparisons with color-coded percentages. Includes universal data normalization and corrected multi-period industry average aggregation.
- **Data Integrity and Company Management**: Implemented metric versioning, company validation and normalization utilities, comprehensive company deletion logic, and robust company creation utilities with SEMrush API integration checks.
- **Complete TypeScript Error Resolution (August 2025)**: Successfully eliminated all TypeScript compilation errors across the entire codebase. Achieved zero TypeScript errors through frontend architecture overhaul, enhanced chart data processing with safe value parsing utilities (`safeNumericValue`, `validateAndGetColor`), improved JSONB data handling for metrics and device distribution, and comprehensive type safety implementation. Build process now completes without any TypeScript warnings or errors, ensuring robust production deployments and improved developer experience.
- **Production Optimization Phase Implementation (August 2025)**: Completed 5-phase production readiness enhancement. **Phase 1**: Centralized debug logging system with environment-aware suppression for production performance. **Phase 2**: Enhanced Content Security Policy with strict production rules while maintaining development flexibility for Vite HMR. **Phase 3**: Standardized authentication middleware with consistent error codes (401 UNAUTHENTICATED, 403 FORBIDDEN) and development auto-authentication. **Phase 4**: Complete GA4 API endpoints integration with token management, refresh handling, and property access verification. **Phase 5**: Resource preloading optimization with Link headers for critical API endpoints (`/api/user`, `/api/filters`) to improve initial load performance.
- **AI Insights Integration Optimization (August 2025)**: Implemented automated AI insights generation during effectiveness scoring. Added database storage for insights (`ai_insights` JSONB column in `effectiveness_runs`), modified scoring pipeline to generate insights automatically after score calculation, and updated frontend components to consume stored insights directly. Maintains backward compatibility with existing insights endpoint while eliminating separate API calls for improved performance.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.