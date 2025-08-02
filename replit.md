# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. It provides comprehensive web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. The system integrates with Google Analytics 4, external data sources, and leverages AI for actionable recommendations. Its purpose is to deliver AI-powered insights for web analytics, enhancing client performance through competitive benchmarking.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.

## System Architecture

Pulse Dashboard™ follows a modern full-stack architecture with clear separation between frontend, backend, and data layers.

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

### Key Components
- **Authentication & Authorization**: JWT-based session auth, role-based access control (Admin/Viewer), protected routes.
- **Data Models**: Clients, Users, Competitors, BenchmarkCompanies, Metrics, Benchmarks, AIInsights.
- **API Architecture**: Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Dashboard, Admin Panel, Authentication forms, Charts, Modals.

### Data Flow
- **Data Collection**: Automated ingestion via n8n from GA4, SEMrush, DataForSEO; external data pushed via API webhooks; data processing and normalization.
- **Analytics Pipeline**: Raw metrics from GA4, benchmark calculation, OpenAI AI analysis for insights, dashboard rendering.
- **User Interaction**: Session-based authentication, data filtering (time, industry, size), real-time updates via TanStack Query, administrative actions.

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: GPT-4o for AI-powered insights.
- **n8n**: Workflow automation for data collection.

### Data Sources
- **Google Analytics 4**: Client website performance metrics.
- **SEMrush**: SEO and competitive intelligence data.
- **DataForSEO**: Additional search engine optimization metrics.

### Development Tools
- **Vite**: Frontend build tooling.
- **Drizzle Kit**: Database migration management.
- **ESBuild**: Backend bundling.

## Security & Production Features

### Security Enhancements (Completed)
- **Session Security**: httpOnly cookies, sameSite: 'strict', secure flag in production
- **Rate Limiting**: Authentication (5/15min), uploads (10/hour), admin actions (50/5min), general API (100/15min)
- **Security Headers**: CSP, HSTS, XSS protection, frame options, MIME sniffing prevention
- **Authentication Logging**: Security events logged with structured format
- **Input Validation**: Zod schemas prevent injection attacks
- **Password Security**: Scrypt hashing with salt and timing-safe comparison

### Production Readiness (Completed)
- **Health Checks**: /health, /ready, /live endpoints for monitoring
- **Structured Logging**: Replaced all console.log with winston-style logger
- **Error Handling**: Comprehensive error tracking with structured metadata
- **Email Service**: Template ready for SendGrid/AWS SES integration
- **Environment Configuration**: Production-ready .env template
- **TypeScript Compliance**: All type errors resolved

### Application Cleanup (August 2025)
- **Password Reset Flow**: Complete implementation with secure token-based reset system
  - Backend routes for `/api/forgot-password` and `/api/reset-password`
  - Database table `password_reset_tokens` with expiration and usage tracking
  - Frontend pages at `/forgot-password` and `/reset-password/:token`
  - Integrated "Forgot Password" link in main auth page
- **Last Login Tracking**: Authentication system now updates `lastLogin` timestamp on successful login
- **AI Insights Integration**: OpenAI service connected to `aiInsights` table with endpoint `/api/generate-insights/:clientId`
- **Field Utilization**: Description field added to CD Portfolio forms (create and edit) with Textarea components
- **Database Schema**: All tables properly utilized with clean separation of concerns
- **Statistics Consistency**: Benchmark coverage correctly shows 0% when no companies exist
- **Sample Data Management**: Complete configuration system for controlling sample data generation
  - Environment-based controls (SAMPLE_DATA_ENABLED, AUTO_GENERATE_SAMPLE_DATA)
  - Auto-generation when new CD Portfolio or benchmark companies are added
  - Dynamic benchmark calculation based on actual company data
  - Production safety controls to disable sample data by default
- **Complete Configuration System**: Eliminated ALL hardcoded values for full deployment flexibility
  - Centralized configuration in `server/config.ts` with environment variable support
  - Dynamic company branding throughout application (charts, footer, UI components)
  - Configurable demo client IDs and admin user IDs via environment variables
  - Frontend environment variables (VITE_*) for client-side branding
  - Comprehensive `.env.example` template with deployment instructions
  - Production-ready white-label deployment capability
- **Code Cleanup (August 2025)**: Comprehensive codebase cleanup completed
  - Replaced all console.log statements with proper structured logging using winston logger
  - Fixed TypeScript errors and LSP diagnostics across the entire codebase
  - Converted nested function declarations to arrow functions for ES5 compliance
  - Removed duplicate code references and cleaned up redundant implementations
  - Improved error handling with consistent logging patterns
  - Enhanced debugging information with comment-based debug messages in frontend
- **Competitor UX & Data Fix (August 2025)**: Enhanced competitor management experience
  - Added loading states for competitor deletion with smooth visual transitions
  - Fixed competitor deletion flash by persisting loading state until data refresh completes
  - **CRITICAL FIX**: Resolved sample data bug where new competitors only received sparse time periods
  - New competitors now generate complete 15-month historical data using same logic as main sample data
  - Ensured Pacific Time consistency across all time period calculations
  - Added comprehensive error handling and logging for competitor metric creation
  - **UX Enhancement**: Added loading spinner to "+ Add" button in competitor modal during data generation
- **AI Prompt System Fix (August 2025)**: Critical prompt system consolidation completed
  - Fixed inconsistent AI prompt usage where individual metric insights bypassed custom prompt templates
  - Updated `generateMetricSpecificInsights` to prioritize admin panel custom prompts over hardcoded prompts
  - Ensured all 6 active custom prompt templates (Bounce Rate, Traffic Channels, etc.) are used consistently
  - Enhanced Traffic Channels analysis to use actual channel distribution data instead of simple counts
  - Eliminated multiple competing system messages for unified AI personality and expertise
  - **Unified Expert Persona**: Added "sr. web analytics strategist and UX strategist" persona to all custom prompt templates for consistent AI expertise across all metric insights
  - **Enhanced Prompt Templates**: Added metric-specific nuances (time formats, percentages, counts), **bold formatting** for key insights, and numbered list format for exactly 3 recommendations per template
- **Typewriter Effect & Debug System (August 2025)**: Resolved critical typewriter animation and debugging infrastructure
  - **Typewriter Bug Fixed**: Resolved issue where typewriter effect wouldn't restart after regenerating insights - now works consistently for all new insight generations
  - **Debug Infrastructure**: Added comprehensive debug system with red "Clear Insights" button in header to clear all AI insights from database and localStorage
  - **localStorage Integration**: Fixed localStorage persistence issues by correctly clearing `pulse_dashboard_insights` key during debug operations
  - **Enhanced Debugging**: Added detailed console logging throughout typewriter animation process with faster 5ms typing speed for better user experience
  - **Component State Management**: Improved insight regeneration flow with proper state resets and cache invalidation for reliable typewriter effect restart
- **UI/UX Polish (August 2025)**: Enhanced interface consistency and user experience
  - **Enhanced Badge Styling**: Updated context-enhanced insights badge with primary pink branding, sparkle icon, and leftmost positioning
  - **Centralized Formatting**: Consolidated all AI formatting instructions into single source of truth to ensure consistent numbered lists and bold formatting across all generation paths
  - **Button Layout Optimization**: Reordered action buttons with Enhanced badge first, followed by Add Context, Copy, Regenerate, and Clear buttons
  - **Admin Security Enhancement**: Disabled delete action for AI metric prompts to prevent accidental removal of custom templates
  - **Known Issue**: Placeholder text flashing in context modal remains unresolved despite comprehensive CSS fixes across all browser prefixes and component approaches
- **Data Regeneration Fix (August 2025)**: Resolved critical data gap where demo client was missing historical Client metrics
  - Regenerated comprehensive sample data spanning 17 time periods (2024-03 to 2025-07)
  - Created 68 Client metric records across all historical periods for complete analytics coverage
  - Fixed sample data generation system to ensure consistent historical data for all core metrics
  - Verified data integrity with proper Client records for Bounce Rate, Session Duration, Pages per Session, and Sessions per User