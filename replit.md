# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. This system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking. The project aims to provide a robust solution for understanding and improving digital performance.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.

## Recent Changes
**August 2, 2025**: Enhanced AI system with Clear Digital service integration
- Updated global prompt template to subtly reflect Clear Digital's expertise areas (UX optimization, brand strategy, visual identity, content strategy, analytics, conversion design, responsive design, CMS implementation, interactive content, motion graphics, research, campaigns, custom development) in AI recommendations without direct service naming or sales language
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