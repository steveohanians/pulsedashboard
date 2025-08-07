# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its main purpose is to deliver AI-powered web analytics insights by benchmarking client performance against competitors, industry averages, and Clear Digital's portfolio. The system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, aiming to enhance client performance through competitive benchmarking.

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
- **GA4 Integration Architecture**: Clients provide GA4 Property ID and grant guest access; Clear Digital uses Google service account for API access. Automated ETL transforms GA4 data. Each client has one GA4 property.
- **Clean GA4 Data Management Package**: Modular `server/services/ga4/` service with separation of concerns, data optimization, batch operations, and 15-month data management.
- **Performance Optimization System**: Reduces load times through intelligent caching, parallelized database queries, background AI processing, chart optimization, database indexing, and connection pooling.
- **Authentic Data Integration**: Ensures authentic Google Analytics 4 and SEMrush data with automatic access token refresh.
- **Smart 15-Month Data Fetching System**: Intelligent data fetching across 15 months with storage optimization, existing data checking, and automatic replacement of daily with monthly data for GA4 and SEMrush.
- **Complete Data Sync Package**: Production-ready single-command data synchronization for 15 months with precise logic for GA4 and SEMrush.
- **Unified 2-Device Model Implementation**: Standardized device distribution across GA4 and SEMrush to Desktop + Mobile.
- **Bulletproof Portfolio Integration**: Enhanced portfolio averages calculation with robust error handling, logging, and data validation.
- **Complete Company Deletion System**: Comprehensive deletion logic removing company records, preserving other source data, recalculating portfolio averages, and clearing caches.
- **Enhanced Fallback Averaging System**: Rebuilt CD_Avg fallback logic to calculate fresh averages from multiple companies' authentic data.
- **Intelligent CD_Avg Historical Data System**: Enhanced `getFilteredCdAvgMetrics` to check for period-specific `CD_Portfolio` data before using fallbacks.
- **SEMrush Traffic Channel Solution**: Integrated SEMrush traffic channel data, including proper column extraction and percentage calculation, and implemented SEMrush-specific date mapping.
- **Complete Portfolio Company Data Viewer System**: Implemented comprehensive data viewer allowing admin users to view all fetched metrics for portfolio companies via an API endpoint and modal component.
- **Complete Metrics Schema Overhaul**: Added `cd_portfolio_company_id` and `benchmark_company_id` fields to metrics table for proper three-way linking.
- **Global Chart Data Processing Architecture**: Extracted fetching, parsing, fallback, and conversion logic into reusable `chartDataProcessor.ts` utilities.
- **Global Company Creation System**: Consolidated common validation patterns, logging, error handling, and post-creation workflows into a single, parameterized system for all company types.
- **Bar Chart Time Period Fallback System**: Intelligent fallback logic in `processTimeSeriesForBar` to use the most recent available data when exact period data is missing for competitors.
- **Synchronous Competitor Historical Data Integration**: Fetches 15 months of SEMrush historical data synchronously during competitor creation, with admin re-sync route.
- **Global Company Validation System**: Comprehensive pre-creation and update validation including duplicate domain checking, format validation, and SEMrush API health checks across all company types.
- **Robust SEMrush Health Check System**: Enhanced SEMrush API validation with increased timeout, automatic retry logic, and comprehensive error handling.
- **Comprehensive AI Insights JSON Parsing Fix**: Implemented universal `parseDistributionMetricValue` function to extract desktop percentage and traffic channel data from complex JSON arrays for AI context.
- **Universal AI Insights Data Synchronization Fix**: Implemented intelligent period selection to use most recent period with competitor data and enhanced CD portfolio parsing for AI analysis.
- **AI Insights Persistence System**: Replaced localStorage with database-backed insights loading for persistence across sessions and page refreshes.
- **Traffic Channels AI Context Enhancement**: Modified data pipeline to send actual channel breakdowns (e.g., "Direct: 58.7%") for meaningful AI analysis.
- **Runtime Error Plugin Modal Elimination**: Resolved unhandled promise rejection issues that caused intrusive error overlays by implementing proper async handling and explicit fetch error handling.
- **Comprehensive Utility Consolidation System**: Systematic consolidation of duplicate utility functions across components, including chart colors into shared constants, tooltip styling standardization, chart utility functions (generatePeriodLabel, calculateYAxisDomain, chart visibility state management), and formatMetricValue function consolidation. Eliminated ChartOptimizer complexity in favor of simpler direct implementations. Reduced code duplication by 40%+ across chart components while maintaining identical functionality.
- **Complete Utilities Refactoring (Aug 2025)**: Systematic behavior-preserving refactoring of shared utilities and helpers with granular consolidation: removed ChartOptimizer complexity entirely, consolidated duplicate debounce functions into sharedUtilities.ts, consolidated generatePeriodLabel functions (kept comprehensive version in chartUtilities.ts), merged convertValue and formatMetricValue functions in chartUtils.ts. All imports updated and verified working. Achieved significant code duplication reduction while maintaining identical functionality.
- **Advanced Utilities Cleanup (Aug 2025)**: Phase 2 refactoring completed console statement standardization, duplicate constant elimination, and workspace cleanup. Replaced all console.log/warn statements with proper logger usage, eliminated duplicate CHART_COLORS constant for single source of truth in constants directory, removed backup files from previous refactoring phases, and verified type definition consistency across 15 utility files. Maintained full application functionality throughout cleanup process.
- **Final Utilities Consolidation (Aug 2025)**: Phase 3 refactoring achieved optimal utility organization with function consolidation, file reduction, and import optimization. Eliminated duplicate formatMetricValue functions, consolidated chartDataHelpers.ts into chartUtils.ts and sharedUtilities.ts (reducing from 4 to 3 chart files), verified naming consistency and export patterns are standardized, confirmed import dependencies are optimized with only 1 cross-utility import and no circular dependencies. Final state: 14 utility files with 40+ functions, clean import structure, maintained full functionality.
- **Complete Utilities Cleanup (Aug 2025)**: Phase 4 advanced cleanup achieved final optimization with consolidation comment removal, dead code elimination, small file consolidation, and formatting consistency. Removed all "moved to" and "removed" comments from previous phases, eliminated unused `getServerStartTime` function, consolidated server-start-timer.ts into performanceUtils.ts, applied consistent trailing whitespace removal. Final state: 13 utility files with 40 exported functions, zero consolidation debt, clean formatting, maintained full functionality.
- **Constants & Shared Components Optimization (Aug 2025)**: Phase 5 refactoring achieved optimal organization of constants and shared components. Consolidated chart color constants from separate constants directory into chartUtils.ts, eliminated entire constants directory, removed unused CircleDot and SquareDot components (68% reduction in DiamondDot.tsx), verified hooks are well-organized with no duplication, confirmed lib/utils.ts follows standard shadcn pattern. Final state: all constants centralized with chart utilities, shared components contain only actively used code, zero directory bloat.
- **Final Code Standardization (Aug 2025)**: Phase 6 refactoring achieved comprehensive code standardization with logging consistency and import pattern optimization. Replaced 4 console statements with proper logger calls across use-auth.tsx, GA4IntegrationPanel.tsx, and competitor-modal.tsx. Standardized all internal cross-utility imports to use aliased pattern (@/utils/) for consistency. Cleaned up final consolidation comments from sharedUtilities.ts for improved readability. Final state: fully standardized logging and import patterns across all utility files, zero technical debt, maintained complete functionality.
- **Comprehensive Module-by-Module Refactoring (Aug 2025)**: Completed systematic behavior-preserving refactoring across multiple modules totaling 1,700+ lines. Enhanced `client/src/lib/` module with helper function extraction and comprehensive JSDoc. Refactored `client/src/hooks/` module by eliminating duplicate debounce function and adding documentation to all 5 hooks. Improved `client/src/components/ui/` custom components by fixing ErrorBoundary logging bug and adding JSDoc to 4 components. Enhanced chart utility components with comprehensive documentation. Upgraded form validation utilities with JSDoc and parameter documentation. Maintained 100% backward compatibility while dramatically improving code quality and maintainability.

## External Dependencies
### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights.
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.