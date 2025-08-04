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
- **Authentic GA4 Data Integration**: Integrated authentic Google Analytics 4 data from property 276066025 via Google OAuth 2.0 authentication. Features automatic access token refresh, comprehensive API data fetching (bounce rate, session duration, pages per session, sessions per user, traffic channels, device distribution), and intelligent storage optimization. Replaced all sample data with authentic GA4 metrics.
- **Comprehensive GA4 Error Handling System**: Implemented enterprise-grade error handling across all GA4 routes with structured error responses, comprehensive validation middleware, and authentication checks.
- **Smart 15-Month GA4 Data Fetching System**: Implemented intelligent data fetching across 15 months with storage optimization. Features existing data checking before API calls, smart daily vs monthly data management (daily for recent 3 months, monthly summaries for older periods), and automatic replacement of daily with monthly data to reduce storage.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management with endpoints for reliable historical data population, daily data fetching, and complete GA4 setup automation.
- **Chart Date Display Fix**: Fixed time-series chart labels to display correct periods (e.g., "Jul 25" for July 2025 data).
- **Daily GA4 Data Integration**: Restored daily GA4 data fetching for "Last Month" charts to enable intra-month variation display.
- **Complete Daily Chart Display Fix**: Resolved "Last Month" charts showing single dots instead of daily variations by including daily data for single-period queries and enhancing label generation.
- **Systematic Data Authenticity Fix - Device Distribution & Traffic Channels**: Resolved dual storage systems to ensure only authentic GA4 API data is used for Device Distribution and Traffic Channels, removing synthetic data.
- **Enhanced GA4 Channel Mapping System**: Improved GA4DataProcessor.normalizeChannelName() to preserve specific channel names (Cross-network, Unassigned, Social Media) for clearer traffic channel attribution.
- **Traffic Channels Duplicate Data Fix**: Resolved critical issue where duplicate Traffic Channels metrics in database caused doubled percentages (Direct showing 129% instead of 64.7%). Implemented database cleanup and backend consolidation logic to prevent future duplicates.
- **Production Code Cleanup**: Comprehensive cleanup of temporary development files, debug logging, and TypeScript errors. Removed 20+ temporary files (cookies, sessions, test scripts), cleaned debug logs with fire emoji prefixes, and fixed TypeScript errors in request logger and scripts. GA4 integration package is now production-ready with clean, optimized code structure.
- **Complete GA4 Data Sync Package (`executeCompleteGA4DataSync`)**: Production-ready single-command GA4 data synchronization package that clears all existing data and fetches 15 months with precise logic: Months 1-2 get daily data for 4 main metrics + monthly for traffic/device data, Months 3-15 get monthly data for all 6 metrics. Fixed line chart display issue by ensuring "Last Month" period gets daily data for proper daily groupings instead of single dots.
- **Line Chart Display Fix**: Resolved issue where Bounce Rate and other main metric charts showed single dots instead of daily groupings for "Last Month" period. Updated `DAILY_DATA_THRESHOLD_MONTHS` from 1 to 2 to ensure both current month and last month receive daily data, enabling proper time-series visualization matching Session Duration chart behavior.
- **GA4 Sync Optimization**: Optimized `executeCompleteGA4DataSync` package to eliminate wasteful API calls by skipping current month entirely. Dashboard shows completed months only, so current month data is unnecessary. Package now starts from last month (period generation loop from i=1 instead of i=0), reducing API calls by ~7% and improving execution efficiency while maintaining proper daily data for "Last Month" line chart groupings.
- **Comprehensive Color System Overhaul**: Systematically fixed all color-related CSS issues by adding comprehensive CSS variables (--color-primary, --color-success, --color-warning, --color-danger, device colors, channel colors, performance colors) and updated all chart components (stacked-bar, gauge, lollipop, radial, bar, time-series, area charts) to use consistent CSS variables instead of hardcoded colors. Eliminated hardcoded hex/hsl values throughout the codebase for unified theming and maintainability.

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights (GPT-4o).
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.