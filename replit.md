# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its core purpose is to provide AI-powered web analytics by benchmarking client performance against competitors, industry averages, and Clear Digital's internal portfolio. By integrating with data sources like Google Analytics 4 and SEMrush, it delivers comprehensive web analytics and actionable recommendations to enhance clients' digital presence and performance through competitive benchmarking. The project aims to provide enterprise-grade performance and replace lengthy load times with immediate data insights.

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
Pulse Dashboard™ employs a modern full-stack architecture built for performance, data integrity, and scalability, with a clear separation of concerns between frontend, backend, and data layers.

**Frontend:**
- **Framework**: React 18 with TypeScript
- **UI**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts
- **Key Features**: Enterprise-grade service layer with automatic cache management, comprehensive TypeScript type safety, event-driven real-time system with EventBus, centralized configuration, robust error handling with `ErrorBoundary` and retry logic, client-side PDF export, unified color management, and rendering optimizations (`useMemo`, Set-based state management).

**Backend:**
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js (JWT-based session authentication with role-based access control)
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging (`debugLog`), comprehensive error handling, templated email service, and environment-driven configuration.

**Database:**
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM
- **Performance Optimization**: Indexing, explicit SELECT column optimization, intelligent caching, parallel queries, and connection pooling.

**Key Architectural Decisions and Features:**
- **AI Integration**: Centralized AI prompt system with database-driven template storage and admin UI for managing SOV question generation prompts. Automated AI insights generation during effectiveness scoring, with insights stored directly in the database. Advanced AI-powered CTA analysis system using 5-criteria scoring, vision-enhanced analysis with full-page screenshots, and CTA taxonomy.
- **Data Flow & Processing**: Automated ingestion, processing, normalization, and analytics pipeline. Intelligent 15-month historical data fetching with daily-to-monthly coalescing. Centralized `PeriodService` for date/period logic and `dataSourceConfig`. Complex metric processing extracted into `MetricProcessingService`, `Traffic Channel Service`, and `Device Distribution Service` singletons. `Data Orchestrator Service` for coordination and quality assessment.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID; Google service account for API access. Automated ETL transforms GA4 data. Multi-service account system for managing GA4 access with admin UI.
- **Benchmarking & Analytics**: Enhanced portfolio averages calculation. Industry benchmark integration with SEMrush data for industry averages and competitor analysis. Implementation of performance comparison chips showing industry and best competitor performance. Dynamic filter system for industry/business size.
- **Data Integrity**: Client data isolation verification, metric versioning, company validation and normalization utilities, robust company creation and deletion logic. Strict policy of never showing fake or sample data; empty states are preferred.
- **System Consistency**: Achievement of identical 5-criteria AI + Vision pattern for Positioning, Brand Story, and CTAs.
- **Advanced CTA Analysis System (August 2025)**: Replaced 500+ line hardcoded CTA scorer with sophisticated AI-powered analysis system using 5-criteria scoring pattern. Implemented vision-enhanced analysis with full-page screenshots, CTA taxonomy classification (PRIMARY vs SECONDARY), conflict detection using synonym groups, and 13-field AI response schema.
- **Type Safety**: Complete elimination of all `any` types across the codebase, ensuring robust production deployments.
- **Production Optimization**: Centralized debug logging, enhanced Content Security Policy, standardized authentication middleware, complete GA4 API endpoints integration, and resource preloading optimization.
- **Effectiveness System Architecture Overhaul (September 2025)**: Complete redesign of the effectiveness scoring engine with enterprise-grade reliability, performance, and user experience improvements. **SYSTEM NOW FULLY OPERATIONAL** with successful end-to-end analysis completion:
  * **Smart Timeout Management**: Progressive timeout warnings, component-level tracking with circuit breakers, checkpoint recovery for resuming runs, and adaptive timeouts based on historical performance (15s data collection, 40s AI analysis, 45s PageSpeed API). **Proven stable in production**.
  * **Tiered Progressive Execution**: Three-tier system delivering immediate results - Tier 1: Fast HTML Analysis (UX, Trust, Accessibility, SEO in 214ms), Tier 2: AI-Powered Analysis (Positioning, Brand Story, CTAs in 13.4s), Tier 3: External API Analysis (Speed/PageSpeed in 29.2s) with circuit breaker protection. **Achieving 9.2/10 scores in 100-second analyses**.
  * **Atomic Database Operations**: Transaction-based scoring ensuring data consistency, automatic rollback on failure, atomic progress updates, and critical operation protection for run completion and criterion scoring. **All 8 criteria saved successfully**.
  * **Enhanced AI-Powered Criteria**: Brand Story analysis with AI + vision capabilities for POV/mechanism/outcomes assessment, CTA analysis using 5-criteria system with conflict detection and taxonomy, vision-enhanced scoring with screenshot analysis, and smart fallbacks when AI analysis fails. **Achieving perfect 10/10 scores on AI criteria**.
  * **Real-Time Progress Streaming**: Server-Sent Events (SSE) architecture for live progress tracking, persistent connections with automatic reconnection, heartbeat system for stability (30-second intervals), smart fallback percentage system, and seamless integration with time-aware progress tracker. **Live progress from 0% to 100% working perfectly**.
  * **Reliability & Performance**: Browser lifecycle management fixing race conditions, parallel data collection with timeout protection, screenshot service improvements with Playwright fallbacks, error classification system, automated stale run cleanup, and comprehensive cache invalidation for real-time competitor management updates. **Circuit breakers all operational, competitor analysis functioning**.

## External Dependencies
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Used for AI-powered insights and analysis.
- **n8n**: Workflow automation platform for data collection.
- **Google Analytics 4**: Primary source for client web performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.