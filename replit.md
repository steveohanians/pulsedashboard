# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard for Clear Digital's B2B clients. It provides comprehensive web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. The system integrates with Google Analytics 4, external data sources, and leverages AI for actionable recommendations. Its purpose is to deliver AI-powered insights for web analytics, enhancing client performance through competitive benchmarking.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.

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