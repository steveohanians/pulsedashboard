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
- **Authentication & Authorization**: JWT-based session authentication with role-based access control and comprehensive admin route security.
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion, and AI Integration endpoints with Zod validation schemas for API responses and canonical routing.
- **Data Flow**: Automated ingestion, processing, normalization, and analytics pipeline with intelligent 15-month data fetching, daily-to-monthly coalescing, and comprehensive GA4 health monitoring.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting and server-side input sanitization. Implements a versioned AI insights architecture with persistence, server-computed badge persistence, transactional deletion, and comprehensive "With Context" badge system featuring blue-themed badges with AI sparkles icons for genuine user-provided context.
- **Brandfetch Integration**: Automatic client icon fetching system using Brandfetch's free API tier (250 requests/month). Features smart icon selection prioritizing "icon" type logos, SVG format preference, real-time preview in edit modal, and comprehensive error handling with success/fail toast notifications.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Authentic data integration ensures access token refresh and empty states instead of synthetic data.
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
- **AI Insights UX Enhancement**: Complete typewriter animation system with anti-flicker protection, sequential section typing (Context → Insights → Recommendations), precise action bar timing, and comprehensive coverage of all generation cases including regenerate, regenerate with context, error fallback, and initial generation scenarios.
- **CD Portfolio Averages System**: Resolved critical issue where CD Portfolio averages were never calculated, resulting in missing chart data. System now properly generates CD_Avg metrics using existing PortfolioIntegration service with intelligent fallback to most recent available data when exact periods unavailable. Auto-maintains averages when portfolio companies are modified.
- **PDF Export System**: Complete client-side PDF export functionality using html2canvas + jsPDF with advanced reliability features. Implements slice-based rendering (1400px chunks) to prevent memory crashes, asset preflight loading for fonts/images, CORS-safe capture configuration, and CSS animation control. Features smart appendChild override in main.tsx that whitelists html2canvas elements while blocking dev overlays to prevent "Unable to find iframe window" errors. Includes comprehensive CORS image preparation, robust error handling, and sandbox-safe downloads. Generates comprehensive analytics reports with actual dashboard data including key metrics, traffic channels, device distribution, and AI insights. Features simplified header without left navigation, professional Clear Digital branding, and reliable multi-page output. System uses authentic data only (no fallback/sample data) and maintains data integrity standards.
  - **PDF Header Design Standards**: Professional header layout with actual Clear Digital logo (imported from attached assets), constrained to max 35px height and 120px width with proper aspect ratio preservation. Uses Poppins font family throughout (20px title, 14px subtitle, 12px metadata). Logo positioned at 40px from left, vertically centered, with text starting 30px after logo. Right-aligned date information uses full month names. Consistent styling between logo load success and fallback states. Enhanced background removal system using CSS !important flags and Tailwind class removal for outline-only appearance.
- **Centralized Period Management System**: Comprehensive PeriodService (singleton) handling all date/period logic for GA4 and SEMrush data alignment. Features Pacific Time zone support for "Last Month" calculations, automatic handling of SEMrush 1-month data delay, robust period normalization (supports "Last Month", YYYY-MM, daily/group formats, date ranges), user-friendly display formatting, period metadata with alignment warnings, and cache invalidation detection for month transitions. Eliminates scattered date logic across codebase and ensures consistent period handling between data sources.
- **Centralized Data Source Configuration System**: Comprehensive dataSourceConfig organizing all data source characteristics, metric processing, and environment settings. Features data source delay definitions (GA4: 0 months, SEMrush: 1 month), organized metric fallback values from existing chartUtils, environment-based feature flags (debug logging, data source indicators, aligned periods), metric conversion configuration (percentage/time conversions), data quality thresholds, cache configuration, and helper functions for metric processing. Provides single source of truth for all data source settings and eliminates scattered configuration across codebase.
- **Production-Safe Logging System**: Complete migration from console.log/warn/error statements to centralized debugLog system. Implemented across dashboard.tsx and chartGenerators.ts with appropriate log levels (WARNING, ERROR, DEVICE, TRAFFIC, DEBUG). All debug output is controlled by environment configuration flags, ensuring clean production logs while maintaining development debugging capabilities. Standardized error handling with TypeScript-safe error object processing.
- **Metric Processing Service**: Extracted complex groupedMetrics logic from dashboard.tsx into reusable MetricProcessingService singleton. Features comprehensive metric aggregation and transformation with support for time series data, source type normalization, period filtering, and metric value formatting. Reduces dashboard component complexity by ~80 lines and provides standardized metric processing across the application. Includes built-in debugLog integration and TypeScript safety.
- **Traffic Channel Service**: Comprehensive TrafficChannelService extracting complex processTrafficChannelData logic (~200 lines) from dashboard.tsx into reusable singleton service. Features traffic channel data aggregation for stacked bar charts, competitor fallback data generation, consistent channel color assignment, proper debugging with centralized logging system, and comprehensive data source selection (dedicated metrics, time series fallback, regular metrics). Significantly improves code organization and maintainability while preserving all original functionality.

## External Dependencies
**Core Infrastructure:**
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

**Data Sources:**
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.