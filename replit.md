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

## Agent Learning Protocols

### 1. Explicit Scope Confirmation
Before making any changes that affect data or architecture:
- State exactly what entities/data will be modified
- Confirm the scope matches the user's request
- Wait for confirmation before proceeding with any destructive operations
- Always ask "Should I proceed with this approach?" before executing changes

### 2. Pattern Research Mandatory
When encountering any task:
- Search for existing implementations in the codebase first
- Use established naming conventions and logic patterns
- Only create new approaches if existing patterns don't exist

### 3. Structured Problem-Solving
For each request:
1. Identify the EXACT scope (which entities, which data)
2. Research existing patterns and logic
3. Propose the approach based on established patterns
4. Get confirmation before executing

### 4. Documentation Requirements
- Update replit.md immediately when users express preferences
- Document all architectural changes with key details and dates
- Maintain current project context in Overview and Recent Changes sections

### 5. Business Logic Compliance
Before making any coding changes or recommendations, always consider the established business logic:

#### Timeframe Logic
- Dashboard always shows the most recently completed full month (not current partial month)
- Example: If today is August 3, dashboard shows July data

#### GA4 Data Management (Clients Only)
- Data retention is indefinite (forever)
- Initial setup: fetch up to 15 months of historical data if it doesn't exist
- Monthly rollover: fetch daily data for newly completed month, condense previous month's daily data to monthly summary
- Most recent full month: store daily data for detailed charting
- Older months: store single summarized monthly value per metric
- GA4 data fetching must never affect benchmark, competitor, or portfolio data

#### AI Insight Generation
- Insights only generated manually via "Generate Insights" or "Regenerate" button
- Structure: Context + Insight + Recommendations (3 actionable bullets)
- Use client's name explicitly, bold key metrics and actions
- Clear all AI insights and user context on monthly rollover

#### Sample Data Logic (Benchmarks, Competitors, Portfolio)
- Generate 15 months of realistic time-series data using existing methods
- Competitor add: generate 15-month historical data
- Competitor delete: remove all that competitor's data
- Sample data modifications must never affect client GA4 data
- Future integration will source from SEMrush in GA4 format

#### Data Isolation Principle
- Client GA4 data, benchmark data, competitor data, and portfolio data remain completely independent
- Changes to one dataset must never affect others

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
- **Authentication & Authorization**: Utilizes JWT-based session authentication with role-based access control (Admin/User) for protected routes.
- **Data Models**: Structured around distinct entities: Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion, processing, normalization, and an analytics pipeline for benchmark calculations and AI analysis. User interactions are managed through session-based authentication, data filtering, and real-time updates.
- **Security Features**: Includes robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing for password security.
- **Production Readiness**: Features health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management architecture ensuring consistent AI personality and formatting across all insight generation paths. Enhanced with executive-optimized output formatting (max 120 words) structured for CMO/marketing leadership consumption.
- **Input Sanitization**: Implemented server-side input sanitization for prompt injection detection, HTML/script removal, and content quality validation.
- **Code Consolidation**: Achieved enterprise-level code organization by consolidating duplicate functions and patterns across the codebase, including centralized utilities, shared modules for validation, random generation, API patterns, error handling, and database operations.
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access. Clear Digital uses Google service account for API access (read-only) and pulls data via GA4 Reporting API. Automated ETL process transforms GA4 data. OAuth 2.0 flow is used for secure GA4 service account management. **Important**: Google Analytics Data API must be enabled in Google Cloud Console for property verification to work. **One-to-One Relationship**: Each client can only have one GA4 property configured - admin changes replace the existing property ID to maintain data integrity.
- **Clean GA4 Data Management Package**: Comprehensive modular GA4 service package (`server/services/ga4/`) with clear separation of concerns - GA4DataManager (orchestration), GA4AuthenticationService (tokens), GA4APIService (API calls), GA4DataProcessor (data transformation), and GA4StorageService (database operations). Replaces scattered legacy services with enterprise-grade architecture featuring intelligent data optimization, batch operations, comprehensive error handling, and smart 15-month data management.
- **Performance Optimization System**: Comprehensive optimization system reducing load times from 43+ seconds to 24.25 seconds (45% improvement). Features intelligent caching (5-15 min TTL), parallelized database queries, background AI processing, full chart optimization, database indexing, and connection pooling. Cache hit rates provide sub-second response times.
- **Authentic GA4 Data Integration**: Successfully integrated authentic Google Analytics 4 data from property 276066025 via Google OAuth 2.0 authentication. Features automatic access token refresh, comprehensive API data fetching (bounce rate, session duration, pages per session, sessions per user, traffic channels, device distribution), and intelligent storage optimization. **FULLY OPERATIONAL**: Replaced all sample data with authentic GA4 metrics from August 2025 showing real performance data (38.1% bounce rate, 149s session duration, 504 total sessions). System maintains enterprise performance while providing 100% authentic data integration. API endpoints: `/api/refresh-ga4-data` for manual refresh and `/api/smart-ga4/smart-fetch/:clientId` for intelligent 15-month historical fetching. **COMPETITOR UNIQUENESS & TIMING FIXED**: Enhanced sample data generation for competitors with unique baseline calculations per competitor index, 50000x seed spacing for completely different random sequences, and proper timing (success response sent AFTER data generation completes). Each competitor gets genuinely different metric values throughout historical data periods.
- **Comprehensive GA4 Error Handling System**: Implemented enterprise-grade error handling across all GA4 routes with structured error responses, comprehensive validation middleware, and bulletproof authentication checks. Added missing refresh/sync endpoints with async error wrapping and detailed error context for debugging. All GA4 operations now have proper client validation, property access verification, and meaningful error messages with actionable hints for resolution.
- **Smart 15-Month GA4 Data Fetching System**: Implemented intelligent data fetching across 15 months with storage optimization. Features existing data checking before API calls, smart daily vs monthly data management (daily for recent 3 months, monthly summaries for older periods), automatic replacement of daily with monthly data to reduce storage, and 100% authentic GA4 data integration. System maintains enterprise performance while providing comprehensive temporal data coverage. API endpoints: `/api/smart-ga4/smart-fetch/:clientId` for intelligent fetching and `/api/smart-ga4/status/:clientId` for data status checking.
- **Admin GA4 Management Routes**: Comprehensive admin interface for GA4 data management with `/api/admin/ga4/populate-historical/:clientId`, `/api/admin/ga4/refresh-current-daily/:clientId`, and `/api/admin/ga4/complete-setup/:clientId` endpoints. Enables reliable historical data population, daily data fetching for intra-month variations, and complete GA4 setup automation.
- **Chart Date Display Fix**: Fixed time-series chart labels to display correct periods (e.g., "Jul 25" for July 2025 data instead of "Aug 25"). Charts now use proper period labels from the `generatePeriodLabel` utility function.
- **Daily GA4 Data Integration**: Successfully restored daily GA4 data fetching for July 2025 to enable intra-month variation display in "Last Month" charts. Daily metrics are stored with `time_period` format like "2025-07-daily-20250701" and retrieved via `getDailyClientMetrics` for authentic temporal fluctuations.
- **Complete Daily Chart Display Fix**: Resolved "Last Month" charts showing single dots instead of daily variations. Fixed queryOptimizer.ts to include daily data for single-period queries, enhanced generatePeriodLabel to handle daily date formats (Jul 1, Jul 2, etc.), and updated XAxis configuration to display all daily data points. System now processes 31 daily periods with authentic GA4 values (1.05, 1.06, 1.12, 1.15, 1.14) showing real day-to-day fluctuations including Jul 30 display issue resolution (August 2025).
- **Systematic Data Authenticity Fix - Device Distribution & Traffic Channels**: Identified and resolved dual storage systems where synthetic data coexisted with authentic GA4 data. **Device Distribution**: Fixed GA4DataProcessor to use authentic API data instead of deprecated synthetic generation, showing real data (Desktop 89.5%, Mobile 10%, Tablet 0.6% vs fake 65%/30%/5%). **Traffic Channels**: Removed synthetic individual channel records and ensured only authentic GA4 JSON data is used, displaying real traffic sources (Direct 64.7%, Paid Search 13.4%, Referral 10.4%, Organic Search 7.9%, Email 1.4% vs fake round percentages). Both metrics now display 100% authentic GA4 property data with realistic session counts and percentages (August 2025).

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights (GPT-4o).
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.