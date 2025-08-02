# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. This system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking. The project aims to provide a robust solution for understanding and improving digital performance.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.

## Recent Changes
**August 2, 2025**: Enhanced AI system with Clear Digital service integration and critical data architecture fixes, MAJOR TRAFFIC CHANNELS FIX, AI INSIGHTS CRITICAL FIX, CLIENT NAME SUBSTITUTION FIX
- **CRITICAL FILTERING FIX**: Resolved multi-period filtering issue where Quarter/Year views didn't show filter changes
  - Root cause: Chart component used `.find()` for first match instead of averaging multiple filtered metrics per period
  - Fixed chart data processing to properly average Industry_Avg values across multiple records per time period
  - Enhanced business size differentiation with dramatic seed variations (5000-20000) for visual impact
  - All time periods now properly respond to filter changes: Last Month, Last Quarter, Last Year
  - Industry Average lines now show significant visual differences when business size/industry filters change
  - CD Portfolio Average correctly remains constant (unfiltered) as designed
- Updated global prompt template to subtly reflect Clear Digital's expertise areas (UX optimization, brand strategy, visual identity, content strategy, analytics, conversion design, responsive design, CMS implementation, interactive content, motion graphics, research, campaigns, custom development) in AI recommendations without direct service naming or sales language
- **CRITICAL ARCHITECTURE FIX**: Resolved major data integrity issue where clients, benchmark companies, and CD portfolio companies used hardcoded text fields instead of referencing filter_options table
  - Normalized all existing business size and industry vertical data to match filter_options exactly
  - Fixed data inconsistencies (em-dash vs hyphen formatting issues)
  - Added comprehensive server-side validation to ensure all new/updated entities validate against filter_options
  - Created FilterValidator utility class with database-level validation functions
  - Updated all admin routes (create/update for clients, benchmark companies, CD portfolio companies) with filter validation
  - Added PostgreSQL validation functions for business sizes and industry verticals
- Fixed business size editing "Save Changes" functionality in admin panel by implementing proper state management for shadcn Select components
- Completed comprehensive data generation consolidation
- Fixed dual generation systems: All data generation now uses centralized 15-month system
- Removed legacy individual generators (bounceRate, sessionDuration, etc.) that only generated 5 months
- All new company functions now generate consistent 15-month datasets
- Eliminated function naming inconsistencies and clarified architecture documentation
- **CSS Consolidation**: Removed 95%+ duplicate color values, consolidated into semantic variables (--brand-primary, --neutral-light, etc.), added missing sidebar variables, improved maintainability
- **Variable Consolidation**: Created centralized utilities for time periods, traffic/device generation, eliminated duplicate functions across multiple files, established single source of truth for core utilities
- **Advanced Consolidation**: Created 8 shared modules eliminating 20+ duplicate patterns:
  - Backend: databaseUtils.ts (CRUD repository), requestLogger.ts (enhanced logging), errorHandling.ts (error patterns), timePeriodsGenerator.ts, channelDataGenerator.ts  
  - Frontend: useApiRequest.ts (API patterns), formValidation.ts (validation schemas), sharedUtilities.ts (common utilities), DiamondDot.tsx (chart components)
  - Achieved enterprise-level code organization with centralized patterns for database operations, API requests, form validation, and component reuse
- **MAJOR TRAFFIC CHANNELS FIX**: Resolved complete traffic channel display failure that showed empty gray bars across all time periods
  - Root cause: CSS variable color format ('hsl(var(--color-competitor-1))') not rendering as valid CSS background colors
  - Fixed StackedBarChart component to use actual hex colors from CHANNEL_COLORS mapping
  - Enhanced data processing with consistent channel ordering: Organic Search → Direct → Social Media → Paid Search → Email → Other
  - All traffic channel charts now display proper colored bars with correct percentages and consistent visual hierarchy
- **CRITICAL AI INSIGHTS FIX**: Resolved major issue where OpenAI insights were based on user-selected time periods instead of last month data only
  - Root cause: Both insight generation routes (`/api/generate-metric-insight/` and `/api/generate-insights/`) used user's selected time period for AI analysis, and client/benchmark values used frontend averaged data instead of July 2025 specific values
  - Fixed to force dashboard's "Last Month" period (July 2025) for all AI insights regardless of user's time period selections
  - Fixed to fetch actual client, industry, CD, and competitor values from July 2025 database records instead of frontend averaged data
  - Added comprehensive logging to track AI analysis periods vs user dashboard selections and DB values vs frontend values
  - Ensures consistent AI insights based solely on July 2025 data as required, regardless of Quarter/Year dashboard selections
- **CLIENT NAME SUBSTITUTION FIX**: Resolved critical bug where {{clientName}} variable was hardcoded as "Current Client" instead of using actual client names
  - Root cause: generateInsightsWithCustomPrompt function had hardcoded string replacement instead of dynamic client name parameter
  - Updated all AI insight generation functions to properly pass and substitute actual client names from database
  - Enhanced global prompt template to include {{clientName}} placeholder in multiple strategic locations
  - AI insights now correctly reference "Demo Company" instead of generic "Current Client" text
  - Verified fix working through database testing - insights now show proper client name personalization


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
- **Authentication & Authorization**: Utilizes JWT-based session authentication with role-based access control (Admin/Viewer) for protected routes.
- **Data Models**: Structured around distinct entities:
  - **Clients**: Actual customers using the dashboard
  - **CD Portfolio Companies**: Clear Digital's client portfolio (generates CD_Avg benchmarks)
  - **Benchmark Companies**: Industry reference companies (generates Industry_Avg benchmarks)
  - **Competitors**: Client-specific competitor companies (generates Competitor data)
  - **Users, Metrics, Benchmarks, AIInsights**: Supporting entities
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion from various sources, processing, normalization, and an analytics pipeline that includes benchmark calculations and AI analysis for insights. User interactions are managed through session-based authentication, data filtering, and real-time updates.
- **Security Features**: Includes robust session security (httpOnly, sameSite, secure cookies), rate limiting for various actions, comprehensive security headers (CSP, HSTS, XSS protection), structured authentication logging, Zod schema-based input validation, and Scrypt hashing for password security.
- **Production Readiness**: Features health checks, structured logging (Winston-style), comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management architecture via a `global_prompt_template` database table and admin interface, ensuring consistent AI personality and formatting across all insight generation paths. All AI generation paths leverage this global template, eliminating hardcoded prompts and ensuring a unified expert persona (sr. web analytics strategist and UX strategist). Enhanced with executive-optimized output formatting (max 120 words) structured for CMO/marketing leadership consumption with concise context, punchy insights, and actionable recommendations.
- **Input Sanitization**: Implemented server-side input sanitization for prompt injection detection, HTML/script removal, and content quality validation, ensuring only clean and relevant user context is passed to the AI.

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights (GPT-4o).
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.