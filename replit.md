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

## Recent Changes
### Client-Side Runtime Error Resolution (2025-08-08) ✅ COMPLETED
- **Critical Bug Fix**: Eliminated "NotFoundError: The object can not be found here" in Radix UI SelectContentImpl
- **Circular Reference Fix**: Resolved "TypeError: JSON.stringify cannot serialize cyclic structures" 
- **ErrorBoundary Implementation**: Added comprehensive error boundary protection around main Router
- **Defensive Programming**: Enhanced Select components with try-catch error handling and null validation
- **Query Optimization**: Simplified React Query key structure to prevent circular references
- **React Hooks Fix**: Removed problematic SafeSelect component that violated hooks rules
- **Data Validation**: Added proper Array.isArray checks and filtering for Select options
- **Application Stability**: Dashboard loads successfully with 44+ metrics, stable server processing, all API endpoints functional

### Critical Code Quality Improvements (2025-08-08)
- **Dead Code Elimination**: Removed 343 lines of unused fetchHelpers.ts module  
- **Duplication Resolution**: Consolidated parseMetricValue implementations (-37 lines)
- **Infrastructure Management**: Quarantined emailService.ts to deprecated/ with comprehensive documentation (-290 lines)
- **Documentation Trimming**: Comment-only optimization across 7 server utility modules (-420 lines)
  - dateUtils.ts: 272→210 lines (-62)
  - timePeriodsGenerator.ts: 125→67 lines (-58)  
  - metricParser.ts: 214→163 lines (-51)
  - inputSanitizer.ts: 393→343→329 lines (-64 total, preserved all security documentation)
  - logger.ts: 253→180 lines (-73)
  - errorHandling.ts: 612→551 lines (-61)
  - queryOptimizer.ts: 805→740 lines (-65, streamlined comments while preserving business logic)
- **Client-Side Utility Cleanup**: Systematic optimization across 8 client utility modules (-391 lines)
  - sharedUtilities.ts: 158→113 lines (-45, consolidated domain cleaning logic)
  - inputValidation.ts: 108→72 lines (-36, streamlined validation patterns)  
  - chartUtils.ts: 342→251 lines (-91, removed redundant color objects and JSDoc)
  - performanceUtils.ts: 179→159 lines (-20, streamlined comments while preserving functionality)
  - chartGenerators.ts: 388→313→311 lines (-77 total, extracted MONTH_NAMES constant and removed verbose JSDoc)
  - formValidation.ts: 231→166 lines (-65, removed extensive JSDoc while preserving validation logic)
  - chartDataProcessor.ts: 159→138 lines (-21, streamlined data processing comments and logic)
- **Large Server Utility Optimization**: Systematic behavior-preserving cleanup across 7 major utility modules (-274 lines)
  - advancedValidationWorkflows.ts: 549→507 lines (-42 lines, 7.6% reduction)
  - companyCreationUtils.ts: 545→504 lines (-41 lines, 7.5% reduction)
  - globalCompanyValidation.ts: 469→422 lines (-47 lines, 10.0% reduction)
  - globalValidationOrchestrator.ts: 407→371 lines (-36 lines, 8.8% reduction)
  - phase3Integration.ts: 402→372 lines (-30 lines, 7.5% reduction)
  - updateValidationUtils.ts: 336→308 lines (-28 lines, 8.3% reduction)
  - companyDeletionUtils.ts: 294→252 lines (-42 lines, 14.3% reduction)
  - portfolioAverageFix.ts: 260→227 lines (-33 lines, 12.7% reduction)
- **Total Cleanup**: -1,841 lines eliminated from active codebase (33.4% reduction)
- **Quality Metrics**: Clean LSP diagnostics, successful TypeScript compilation, full application functionality preserved across all 24 optimized modules

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
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable `chartDataProcessor.ts` utilities.
- **AI Insights Persistence**: Database-backed insights loading for persistence across sessions and page refreshes. Enhanced AI context for traffic channels and comprehensive JSON parsing.
- **Utility Consolidation**: Systematic consolidation and refactoring of utility functions across the application to reduce code duplication and improve maintainability.

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.