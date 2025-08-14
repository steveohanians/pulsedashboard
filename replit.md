# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. Its purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. It integrates with Google Analytics 4 and other data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client digital presence and performance through competitive benchmarking.

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
- **Authentication & Authorization**: JWT-based session authentication with role-based access control and comprehensive admin route security.
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation schemas for API responses and canonical routing.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline with intelligent 15-month data fetching, daily-to-monthly coalescing, and comprehensive GA4 health monitoring.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting and server-side input sanitization. Implements a versioned AI insights architecture with persistence and a comprehensive "With Context" badge system.
- **Brandfetch Integration**: Automatic client icon fetching system using Brandfetch's free API tier, with smart icon selection, SVG preference, and error handling.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Authentic data integration ensures access token refresh and empty states.
- **Database Performance Optimization System**: Comprehensive performance enhancement system with composite database indexing, explicit SELECT column optimization, intelligent caching, parallelized database queries, background AI processing, chart optimization, and connection pooling.
- **Unified Device Model**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, data validation, and historical data system.
- **Company Management**: Comprehensive company deletion, creation, and validation including duplicate domain checking and SEMrush API health checks.
- **Metrics Schema**: Overhauled with `cd_portfolio_company_id` and `benchmark_company_id` for proper three-way linking and canonical metric envelope system for write-time normalization.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable utilities. Comprehensive Recharts hardening system prevents crashes.
- **Unified Color Management System**: Centralized color assignment across all six chart components with specialized functions while preserving individual chart palettes and ensuring consistent colors for shared series.
- **Typewriter Animation System**: Complete sequential typewriter animation system with 2x speed (10ms intervals) covering Context → Insights → Recommendations sections. Features comprehensive animation state management, flash-prevention, and action bar timing control for all generation scenarios.
- **Rendering Optimization**: Elimination of infinite re-render loops and optimized CPU usage through `useMemo` derivations and Set-based state management in chart components.
- **Contract Testing**: Comprehensive "canary" contract tests using Zod schema validation.
- **Time Period Canonicalization System**: Comprehensive canonical time period handling.
- **Error Handling**: Standardized error handling system with UI banners and retry mechanisms.
- **CD Portfolio Averages System**: System now properly generates CD_Avg metrics using existing PortfolioIntegration service with intelligent fallback and auto-maintenance.
- **PDF Export System**: Complete client-side PDF export functionality using html2canvas + jsPDF with advanced reliability features. Implements slice-based rendering, asset preflight loading, CORS-safe capture, and CSS animation control. Generates comprehensive analytics reports with actual dashboard data.
- **Centralized Period Management System**: Comprehensive PeriodService handling all date/period logic for GA4 and SEMrush data alignment. Features Pacific Time zone support for "Last Month" calculations, automatic handling of SEMrush 1-month data delay, robust period normalization, and cache invalidation detection.
- **Centralized Data Source Configuration System**: Comprehensive `dataSourceConfig` organizing all data source characteristics, metric processing, and environment settings. Provides single source of truth for all data source settings.
- **Production-Safe Logging System**: Complete migration from `console.log` to centralized `debugLog` system with appropriate log levels controlled by environment configuration flags.
- **Metric Processing Service**: Extracted complex groupedMetrics logic into reusable `MetricProcessingService` singleton for comprehensive metric aggregation and transformation.
- **Traffic Channel Service**: Comprehensive `TrafficChannelService` extracting complex traffic channel data processing logic into reusable singleton service.
- **Device Distribution Service**: Complete `DeviceDistributionService` extracting device distribution data processing logic into singleton service architecture.
- **Data Orchestrator Service**: Master coordination service providing unified API for all data processing operations. Orchestrates `PeriodService`, `MetricProcessingService`, `TrafficChannelService`, and `DeviceDistributionService` through a single `orchestrateData()` method. Features comprehensive data quality assessment with completeness scoring, automatic data source alignment validation, performance tracking with millisecond-precision timing, data source transparency with GA4/SEMrush metadata, and intelligent refresh detection for new month transitions. Returns structured OrchestrationResult with processed metrics, traffic channels, device distribution, period metadata, and data quality warnings. Eliminates complex coordination logic from dashboard components while providing enterprise-grade data processing reliability. Fully integrated into dashboard.tsx with orchestratedData useMemo hook and data quality warning banner displaying alignment warnings and completeness issues.
- **Data Source Transparency System**: Admin-only comprehensive data quality status banner providing detailed transparency about data source availability and completeness. Features color-coded status indicators (green for complete, yellow for incomplete), individual data source breakdown (Client GA4, CD Portfolio, Competitors), accurate date parsing with JavaScript month handling, dismissible interface with X button, and comprehensive warning system for data alignment issues. Enhances admin oversight while maintaining clean user interface for regular users.
- **Performance Optimization System**: Comprehensive performance tracking and optimization system including millisecond-precision timing for all operations, lazy-loaded admin panel queries that only fetch data for active tabs (reducing initial load from 6 parallel API calls to 1), and development server optimization scripts. Features performance markers tracking component mount, API fetch times, and data orchestration with automatic detection of slow operations (>2s and >5s). Includes specialized Replit environment optimization scripts for Vite development server performance improvement.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.