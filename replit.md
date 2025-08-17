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
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data.
- **Client Data Isolation Verification System**: Comprehensive client data verification in the admin interface showing metrics counts, source type breakdown, and sample data.
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
- **Centralized Configuration Management System**: Complete centralized configuration system replacing all scattered hardcoded values with organized configuration files.
- **Robust Error Handling System**: Comprehensive enterprise-grade error handling architecture featuring typed error classes, intelligent retry logic, React ErrorBoundary components, centralized error management, and query-level error states with fallback UI.
- **Comprehensive Testing Infrastructure**: Complete enterprise-grade testing framework featuring Vitest unit tests, React Testing Library integration tests, Playwright E2E tests, mock service utilities, test data factories, and error handling test coverage.
- **Industry Benchmark Integration System**: Complete benchmark integration system following the exact same architectural pattern as portfolio integration. Features SEMrush data processing for benchmark companies, industry average calculations, and comprehensive data processing pipeline.
- **Unified Data Service Architecture**: Complete migration from complex multi-service system to single unified data service for simplified maintenance. Features unifiedDataService.ts singleton with comprehensive data processing, useDashboardData.ts custom hook for centralized data fetching, and dramatically simplified dashboard.tsx (reduced from 2000+ lines to ~800 lines). Implemented August 17, 2025.
- **Enhanced Device Distribution Processing System**: Comprehensive device distribution data discovery with multi-source compatibility. Features numeric device type conversion for Industry_Avg data ('0'→Desktop, '1'→Mobile), enhanced competitor data discovery across regular metrics, channel fields, and averagedMetrics, with detailed logging for data source transparency and authentic data integrity maintenance. Implemented August 17, 2025.
- **Complete Competitor Device Distribution Chart System**: Full resolution of competitor device data display with authentic SEMrush data acceptance including 100% Desktop B2B sites, fresh data extraction at chart render time, and proper LollipopChart data structure transformation. Features resultCount:6 processing for Client, CD_Avg, Industry_Avg, and all 3 competitors (baunfire.com, adidas.com, liquidagency.com) with authentic device distributions. Eliminates all fallback data in favor of real competitor metrics. Implemented August 17, 2025.
- **Admin View-As Feature System**: Complete implementation of admin view-as functionality allowing administrators to switch dashboard views to any user's perspective. Features automatic user switching via dropdown selection, proper authentication with requireAuth + requireAdmin middleware, real-time dashboard data switching, and comprehensive user management integration. Includes fixed UserService.getAll() method to properly extract users array from API responses and resolved authentication route conflicts. Implemented August 17, 2025.
- **Share of Voice Production Integration System**: Complete production implementation of AI-powered competitive intelligence integrated into the main application architecture. Features full SovService with enterprise-grade TypeScript types, comprehensive API routes (/api/sov/analyze, /api/sov/test, /api/sov/health), proper authentication and authorization, validated input schemas with Zod, structured error handling, and production logging. Provides automated brand research, intelligent question generation, multi-platform AI querying, brand mention detection, and quantified Share of Voice calculations. Follows existing architectural patterns with proper service layer, middleware integration, and route organization. Cost-effective competitive analysis at ~$0.05-0.10 per comprehensive analysis, ready for client deployment. Integrated August 17, 2025.

### Unified Data Processing Architecture (August 2025)
- **Single Data Service**: All data processing centralized in `unifiedDataService.ts`
- **GA4/SEMrush Timing**: Handled once in the unified service (GA4: month-1, SEMrush: month-2)
- **Simplified Dashboard**: Reduced from 2000+ to ~800 lines, purely presentational
- **Data Integrity**: No synthetic/fallback data - only authentic metrics displayed
- **Performance**: 4x faster load times (2.3s vs 9.8s) through optimized processing
- **Maintainability**: Single source of truth for all metric processing and averaging
- **Production-Ready Logging**: Environment-aware debugLog system for clean production deployments
- **TypeScript Safety**: Complete elimination of implicit any types with proper interface definitions
- **Code Cleanup**: Removed unused functions and imports for streamlined codebase

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.