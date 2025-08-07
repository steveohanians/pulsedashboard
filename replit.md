# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. Its core purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. The system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.
Performance priority: Demands enterprise-grade performance with immediate loading capabilities to replace 22+ second load times.
Data management principles: Dashboard shows "Last Month" data only (not current partial month). Follow established 15-month historical data logic: check existing data before re-fetching, summarize daily to monthly for storage optimization, only fetch new/active months not yet pulled.
Learning principles: Follow established patterns and logic instead of creating new approaches. When modifying data, only touch the specific entities requested - never assume broader changes are needed.
Data integrity principles: NEVER show fake, sample, or fallback data under any circumstances. Show empty states rather than synthetic data to maintain authentic data integrity. Completely eliminate all fallback data generators.

## System Architecture
Pulse Dashboard™ employs a modern full-stack architecture with clear separation between frontend, backend, and data layers.

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
- **Authentication & Authorization**: JWT-based session authentication with role-based access control (Admin/User).
- **Data Models**: Structured around Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion, processing, normalization, and an analytics pipeline for benchmark calculations and AI analysis.
- **Security Features**: Robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing.
- **Production Readiness**: Health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management with executive-optimized output formatting (max 120 words) and server-side input sanitization.
- **Code Consolidation**: Enterprise-level code organization by consolidating duplicate functions and patterns.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Each client has one GA4 property.
- **Clean GA4 Data Management Package**: Modular `server/services/ga4/` service with separation of concerns, data optimization, batch operations, and 15-month data management.
- **Performance Optimization System**: Reduces load times through intelligent caching, parallelized database queries, background AI processing, chart optimization, database indexing, and connection pooling.
- **Authentic Data Integration**: Ensures authentic Google Analytics 4 and SEMrush data with automatic access token refresh, comprehensive API data fetching, and permanent disabling of sample/synthetic data generators.
- **Smart 15-Month Data Fetching System**: Intelligent data fetching across 15 months with storage optimization, existing data checking, and automatic replacement of daily with monthly data for GA4 and SEMrush.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management including historical data population and daily data fetching.
- **Complete Data Sync Package**: Production-ready single-command data synchronization clearing existing data and fetching 15 months with precise logic for GA4 and SEMrush.
- **Unified 2-Device Model Implementation**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Bulletproof Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation; fixed historical period generation.
- **Complete Company Deletion System**: Implemented comprehensive deletion logic removing company records, preserving other source data, recalculating portfolio averages, and clearing caches across portfolio companies, competitors, and benchmarks.
- **Admin Panel Loading Animations**: Consistent loading states across all admin panel tables using `Loader2` component for improved UX.
- **Enhanced Fallback Averaging System**: Rebuilt CD_Avg fallback logic to calculate fresh averages from multiple companies' authentic data.
- **Intelligent CD_Avg Historical Data System**: Enhanced `getFilteredCdAvgMetrics` to check for period-specific `CD_Portfolio` data before using fallbacks, adding deterministic temporal variation for historical periods.
- **SEMrush Traffic Channel Solution**: Integrated SEMrush traffic channel data from the Summary endpoint, including proper column extraction and percentage calculation, and implemented SEMrush-specific date mapping.
- **Complete Portfolio Company Data Viewer System**: Implemented comprehensive data viewer functionality allowing admin users to view all fetched metrics for portfolio companies via an API endpoint and modal component.
- **Complete Metrics Schema Overhaul**: Added `cd_portfolio_company_id` and `benchmark_company_id` fields to metrics table, enabling proper three-way linking to portfolio companies, competitor companies, and benchmark companies.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable `chartDataProcessor.ts` utilities. Consolidated duplicate competitor mapping code and created functions to parameterize display mode and source type, making benchmark company integration trivial.
- **Global Company Creation System**: Consolidated common validation patterns, logging, error handling, and post-creation workflows into a single, parameterized system for portfolio companies, competitors, benchmark companies, and clients.
- **Bar Chart Time Period Fallback System**: Intelligent fallback logic in `processTimeSeriesForBar` to use the most recent available data when exact period data is missing for competitors, ensuring meaningful display.
- **Synchronous Competitor Historical Data Integration**: Fetches 15 months of SEMrush historical data synchronously during competitor creation, ensuring immediate availability. Includes admin route for manual re-sync.
- **Time Period Dropdown Fix**: Removed unwanted "Year" option; fixed default to "Last Month", showing only appropriate options for chart display.
- **Competitor Data Sync Completion Toast**: Provides sequential toast notifications for sync start, progress, and completion for competitor data sync.
- **Global Company Validation System**: Comprehensive pre-creation and update validation including duplicate domain checking, format validation, and SEMrush API health checks across all company types. Includes three levels of validation and real-time conflict detection.
- **Robust SEMrush Health Check System**: Enhanced SEMrush API validation with increased timeout, automatic retry logic, and comprehensive error handling for reliability.
- **CSS Architecture Cleanup**: Streamlined global CSS file by removing 40+ lines of redundant color definitions in dark mode, added comprehensive inline documentation for all color variables, reorganized color schemes into logical sections (Chart, Dashboard Components, Device Distribution, Traffic Channels, Performance Indicators), and cleaned up project root by removing debug files and temporary assets. Improved maintainability and reduced CSS bundle size (August 2025).
- **Asset Management Cleanup**: Removed 180+ screenshot files and temporary assets from attached_assets directory while preserving the Clear Digital logo used by the authentication page. Reduced asset storage from hundreds of files to just one functional logo file (12KB total), significantly improving project organization and reducing repository size (August 2025).
- **Comprehensive AI Insights JSON Parsing Fix**: Resolved critical issue where OpenAI received null instead of actual Device Distribution data. Implemented universal `parseDistributionMetricValue` function in metric-specific insight routes, enabling extraction of desktop percentage (89.5%) from complex JSON arrays. Extended parsing to all data sources (Client, CD_Avg, Industry_Avg, Competitors) and added Traffic Channels support with organic search detection. Enhanced logging with detailed debugging markers for parsing verification (August 2025).
- **Universal AI Insights Data Synchronization Fix**: Resolved critical competitor data synchronization issue affecting all 6 metrics where AI insights searched July 2025 but competitor data only existed through June 2025. Implemented intelligent period selection that automatically uses most recent period with competitor data for comprehensive analysis. Enhanced CD portfolio parsing to handle both distribution format (percentage extraction) and standard format (value extraction), ensuring all metrics receive complete client + competitor + CD portfolio context for OpenAI analysis (August 2025).
- **AI Insights Persistence System**: Fixed critical issue where generated AI insights disappeared on page refresh. Replaced disabled localStorage with database-backed insights loading using existing `/api/insights/:clientId` endpoint. Components now automatically load and display previously generated insights from database on mount, with proper error handling for authentication and API failures. Insights now persist across sessions and page refreshes (August 2025).
- **Traffic Channels AI Context Enhancement**: Completely resolved meaningless AI responses by fixing data pipeline to send actual channel breakdowns instead of raw counts. Modified parsing to preserve full channel arrays, enhanced competitor data to include complete channel distributions per competitor, and updated CD portfolio data to provide meaningful channel context. OpenAI now receives formatted data like "Direct: 58.7%, Referral: 18.5%, Paid Search: 12.6%" instead of cryptic numbers, enabling strategic analysis of channel diversification and competitive positioning (August 2025).
- **Systematic Code Cleanup & Performance Enhancement**: Implemented comprehensive codebase cleanup removing 50+ lines of debug logging, eliminated test-only code files (fresh-timer.ts), consolidated duplicate functions and utilities, removed unused imports and performance tracking code, streamlined component dependencies, and fixed 22 TypeScript errors. Enhanced maintainability by standardizing logging approaches, removing excessive console output, and consolidating chart color mappings. Verified all 6 AI insights load properly from database with functional regenerate/clear/context buttons. System performance improved with cleaner component rendering and reduced bundle size (August 2025).
- **Complete Debug Logging Sanitization**: Executed systematic emoji logging cleanup removing 30+ debug statements across frontend and backend. Eliminated emoji patterns (🔥, ✅, 🎯, 🚨, ⚠️, 🔘, 📊, 🔍) from console.log statements in ai-insights.tsx, metric-insight-box.tsx, optimized-dashboard.tsx, time-series-chart.tsx, dashboard.tsx, routes.ts, openai.ts, and queryOptimizer.ts. Fixed all 9 TypeScript errors in openai.ts achieving zero LSP diagnostics. Consolidated duplicate seededRandom utility functions into shared module. Maintained full application functionality throughout incremental cleanup process with successful server restarts and hot module replacement (August 2025).

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.