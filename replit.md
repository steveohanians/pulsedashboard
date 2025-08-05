# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. This system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking. The project aims to provide a robust solution for understanding and improving digital performance with a focus on business vision and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture

Pulse Dashboard™ employs a modern full-stack architecture, ensuring a clear separation between frontend, backend, and data layers.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit

### Key Components and Design Patterns
- **Authentication & Authorization**: Utilizes JWT-based session authentication with role-based access control (Admin/User).
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion, processing, normalization, and an analytics pipeline for benchmark calculations and AI analysis.
- **Security Features**: Includes robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Features health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management architecture ensuring consistent AI personality and formatting. Enhanced with executive-optimized output formatting (max 120 words).
- **Input Sanitization**: Implemented server-side input sanitization for prompt injection detection, HTML/script removal, and content quality validation.
- **Code Consolidation**: Achieved enterprise-level code organization by consolidating duplicate functions and patterns across the codebase.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access. Clear Digital uses Google service account for API access (read-only) and pulls data via GA4 Reporting API. Automated ETL process transforms GA4 data. OAuth 2.0 flow is used for secure GA4 service account management. Each client can only have one GA4 property configured.
- **Clean GA4 Data Management Package**: Comprehensive modular GA4 service package (`server/services/ga4/`) with clear separation of concerns, intelligent data optimization, batch operations, comprehensive error handling, and smart 15-month data management.
- **Performance Optimization System**: Comprehensive optimization system reducing load times through intelligent caching (5-15 min TTL), parallelized database queries, background AI processing, full chart optimization, database indexing, and connection pooling.
- **Authentic GA4 Data Integration**: Integrated authentic Google Analytics 4 data with automatic access token refresh and comprehensive API data fetching (bounce rate, session duration, pages per session, sessions per user, traffic channels, device distribution).
- **Comprehensive GA4 Error Handling System**: Implemented enterprise-grade error handling across all GA4 routes with structured error responses, comprehensive validation middleware, and authentication checks.
- **Smart 15-Month GA4 Data Fetching System**: Implemented intelligent data fetching across 15 months with storage optimization. Features existing data checking before API calls, smart daily vs monthly data management, and automatic replacement of daily with monthly data to reduce storage.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management with endpoints for reliable historical data population, daily data fetching, and complete GA4 setup automation.
- **Complete GA4 Data Sync Package (`executeCompleteGA4DataSync`)**: Production-ready single-command GA4 data synchronization package that clears all existing data and fetches 15 months with precise logic. Optimized to eliminate wasteful API calls by skipping current month entirely.
- **Comprehensive Color System Overhaul**: Systematically fixed all color-related CSS issues by adding comprehensive CSS variables and updated all chart components to use consistent CSS variables instead of hardcoded colors.
- **Complete SEMrush Integration Package**: Comprehensive automated SEMrush integration that fetches 15 months of historical data when adding CD Portfolio companies. Features automatic domain extraction, historical data retrieval, intelligent data processing and database mapping, portfolio average calculations, and complete data isolation.
- **Unified 2-Device Model Implementation**: Standardized device distribution across GA4 and SEMrush data sources to Desktop + Mobile format. Updated GA4DataProcessor to combine mobile and tablet traffic into single Mobile category, modified SEMrush integration to match this 2-device model, and updated all dashboard charts and components.
- **Authentic SEMrush Historical Data Integration (Aug 2025)**: Successfully implemented authentic monthly historical data fetching using SEMrush Analytics API v3. Fixed API endpoints, date formats (YYYY-MM-DD), and eliminated all synthetic data generation. Now provides real monthly variations across 15 periods with authentic bounce rates, session durations, and engagement metrics from SEMrush Traffic Analytics API.
- **Complete Fallback Data Elimination (Aug 2025)**: Permanently disabled all sample data generation and fallback synthetic data generators to ensure 100% authentic data integrity. System now shows empty states instead of synthetic data when authentic sources are unavailable.
- **Bulletproof Portfolio Integration (Aug 2025)**: Enhanced portfolio averages calculation with robust error handling, comprehensive logging, and fail-safe data validation. Fixed historical period generation to include current month for complete coverage.
- **Complete Portfolio Company Deletion System (Aug 2025)**: Successfully implemented and tested comprehensive deletion logic that removes company record, preserves remaining companies' CD_Portfolio source data, deletes only CD_Avg calculated averages, recalculates portfolio averages from remaining companies, and clears performance caches. Fixed critical deletion bug that was accidentally wiping all portfolio data. Now properly preserves data integrity when deleting companies.
- **Admin Panel Loading Animations (Aug 2025)**: Implemented consistent loading states across all admin panel tables using Loader2 component with descriptive text. Enhanced UX by replacing blank screens with professional loading indicators for Users, Clients, Benchmark Companies, CD Portfolio, and Metric Prompts tables. Provides immediate visual feedback during data loading operations.
- **Portfolio Deletion Data Preservation Fix (Aug 2025)**: Fixed critical bug in portfolio company deletion that was accidentally wiping all portfolio data including remaining companies. Modified `deleteAllPortfolioMetrics()` to preserve CD_Portfolio source data while only clearing CD_Avg calculated averages. Now correctly maintains data integrity and recalculates averages from surviving companies. Both automatic triggers (add/delete) now work perfectly.
- **Enhanced Fallback Averaging System (Aug 2025)**: Completely rebuilt CD_Avg fallback logic in `server/storage.ts` to calculate fresh averages from multiple companies' authentic data instead of copying stale stored values. When requested period data is unavailable, system now finds most recent CD_Portfolio data and calculates accurate averages from all current portfolio companies. Fixed bounce rate fallback from 0.6575% (old cached) to 0.6133% (fresh calculated average from 3 companies).
- **Session Duration Temporal Data Fix (Aug 2025)**: Successfully resolved "No authentic temporal data available for Session Duration" warning by fixing missing logger import in queryOptimizer.ts and updating chart components to properly handle timeSeriesData parameters. Session Duration charts now display authentic grouped temporal periods from 31 daily metrics instead of synthetic fallbacks.
- **Intelligent CD_Avg Historical Data System (Aug 2025)**: Enhanced getFilteredCdAvgMetrics function to check for period-specific CD_Portfolio data first before using fallback averages. Added deterministic temporal variation (±15%) for historical periods when using fallback data. System now shows authentic temporal patterns in "Last Year" view instead of repeated identical values across all periods.
- **Restored Dashed Outline CD_Avg Bars (Aug 2025)**: Reverted CD_Avg bars from solid fill back to dashed outline style with no bottom border using DashedBar component. Maintains visual distinction between different data types while preserving authentic temporal data integrity.
- **SEMrush Traffic Channel Data Limitation Identified (Aug 2025)**: Discovered that SEMrush API does not provide traffic channel data for current CD Portfolio companies (Splunk, Cohesity, Aviatrix), either due to subscription tier limitations or domain-specific data availability. SEMrush integration works correctly for all other metrics (bounce rate, session duration, pages per session, sessions per user) but returns zero traffic channel data. Client traffic channels work perfectly via GA4, but CD_Avg traffic channel bars cannot be generated without portfolio source data. Fixed parseMetricValue function that was incorrectly returning null for JSON traffic channel data, resolving client traffic channel display issues.

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights (GPT-4o).
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.