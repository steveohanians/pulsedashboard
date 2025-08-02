# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. This system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking. The project aims to provide a robust solution for understanding and improving digital performance.

## User Preferences
Preferred communication style: Simple, everyday language.
Filter ordering: Business sizes ordered small to large, industry verticals alphabetical.
Dynamic filtering: Industry filters reference each other - selecting a business size filters available industry verticals and vice versa.

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
- **Data Models**: Structured around entities like Clients, Users, Competitors, BenchmarkCompanies, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion from various sources, processing, normalization, and an analytics pipeline that includes benchmark calculations and AI analysis for insights. User interactions are managed through session-based authentication, data filtering, and real-time updates.
- **Security Features**: Includes robust session security (httpOnly, sameSite, secure cookies), rate limiting for various actions, comprehensive security headers (CSP, HSTS, XSS protection), structured authentication logging, Zod schema-based input validation, and Scrypt hashing for password security.
- **Production Readiness**: Features health checks, structured logging (Winston-style), comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management architecture via a `global_prompt_template` database table and admin interface, ensuring consistent AI personality and formatting across all insight generation paths. All AI generation paths leverage this global template, eliminating hardcoded prompts and ensuring a unified expert persona (sr. web analytics strategist and UX strategist).
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