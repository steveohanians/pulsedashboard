# Pulse Dashboard™

## Overview
Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. Its primary purpose is to deliver AI-powered insights for web analytics by comparing client performance against competitors, industry averages, and Clear Digital's portfolio averages. This system integrates with Google Analytics 4 and other external data sources to provide comprehensive web analytics and actionable recommendations, ultimately enhancing client performance through competitive benchmarking. The project aims to provide a robust solution for understanding and improving digital performance with a focus on business vision and market potential.

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
- **Authentication & Authorization**: Utilizes JWT-based session authentication with role-based access control (Admin/User) for protected routes.
- **Data Models**: Structured around distinct entities: Clients, CD Portfolio Companies, Benchmark Companies, Competitors, Users, Metrics, Benchmarks, and AIInsights.
- **API Architecture**: Segregated into Public, Admin, Data Ingestion (webhooks), and AI Integration endpoints.
- **Frontend Components**: Core UI elements include Dashboard, Admin Panel, Authentication forms, Charts, and Modals.
- **Data Flow**: Automated data ingestion, processing, normalization, and an analytics pipeline for benchmark calculations and AI analysis. User interactions are managed through session-based authentication, data filtering, and real-time updates.
- **Security Features**: Includes robust session security, rate limiting, comprehensive security headers, structured authentication logging, Zod schema-based input validation, and Scrypt hashing for password security.
- **Production Readiness**: Features health checks, structured logging, comprehensive error handling, templated email service integration, and environment-driven configuration.
- **White-Label Capability**: Designed for flexible deployment with centralized configuration and dynamic company branding.
- **AI Prompt System**: Centralized AI prompt management architecture via a `global_prompt_template` database table and admin interface, ensuring consistent AI personality and formatting across all insight generation paths. Enhanced with executive-optimized output formatting (max 120 words) structured for CMO/marketing leadership consumption.
- **Input Sanitization**: Implemented server-side input sanitization for prompt injection detection, HTML/script removal, and content quality validation.
- **Code Consolidation**: Achieved enterprise-level code organization by consolidating duplicate functions and patterns across the codebase, including centralized utilities, shared modules for validation, random generation, API patterns, error handling, and database operations.

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting.
- **OpenAI API**: Utilized for AI-powered insights (GPT-4o).
- **n8n**: Workflow automation platform for data collection.

### Data Sources
- **Google Analytics 4**: Primary source for client website performance metrics.
  - **Integration Model**: Clients add Clear Digital as guest users to their GA4 properties
  - **Data Access**: Clear Digital pulls data via GA4 Reporting API using guest permissions
  - **Client Setup**: Clients only need to provide their GA4 Property ID and grant guest access
- **SEMrush**: Provides SEO and competitive intelligence data.
- **DataForSEO**: Supplies additional search engine optimization metrics.

## Future Enhancement Roadmap

### High-Impact Features for B2B Analytics

**1. Advanced Competitive Intelligence**
- Competitor Discovery Engine: Automatically identify new competitors based on industry, keywords, and market overlap
- Alert System: Real-time notifications when competitors launch campaigns, change pricing, or see traffic spikes
- Market Share Tracking: Visual representation of market position relative to competitors

**2. Executive Reporting Suite**
- Automated Executive Summaries: AI-generated weekly/monthly reports for C-suite consumption
- Performance Forecasting: Predictive analytics showing projected performance trends
- ROI Calculator: Connect analytics metrics to revenue impact and business outcomes

**3. Campaign Attribution & Journey Mapping**
- Multi-Touch Attribution: Track complete customer journeys across channels
- Campaign Performance Correlation: Link marketing campaigns to analytics performance
- Customer Lifetime Value Integration: Connect analytics to revenue metrics

**4. Industry-Specific Benchmarking**
- Vertical-Specific Insights: Tailored benchmarks for healthcare, finance, manufacturing, etc.
- Seasonal Trend Analysis: Industry-specific seasonal patterns and recommendations
- Regulatory Compliance Tracking: Monitor performance changes during regulatory shifts

**5. Advanced Data Visualization & Insights**
- Interactive Cohort Analysis: Track user behavior patterns over time
- Heat Map Analytics: Visual representation of user engagement across pages
- Conversion Funnel Analysis: Detailed breakdown of conversion paths and drop-off points

### Quick Wins (Low Effort, High Value)

**6. Enhanced Export & Sharing**
- White-Label Reports: Branded reports that clients can share with their stakeholders
- Scheduled Report Delivery: Automated email delivery of key insights
- API Access: Allow clients to integrate insights into their own systems

**7. Alert & Notification System**
- Performance Anomaly Detection: Automatic alerts for significant changes
- Goal Tracking: Set and monitor specific performance targets
- Custom Dashboard Alerts: User-defined triggers for important metrics

## GA4 Integration Architecture

### Client Onboarding Process
1. **Client Setup**: Client provides GA4 Property ID to Clear Digital
2. **Access Grant**: Client adds Clear Digital service account as guest user to their GA4 property
3. **Verification**: Clear Digital tests property access and confirms data availability
4. **Data Sync**: Automated daily/weekly data pulls via GA4 Reporting API

### Technical Implementation
- **Service Account**: Clear Digital uses Google service account for API access
- **Guest Permissions**: Read-only access to client GA4 properties
- **Data Pipeline**: Automated ETL process transforms GA4 data into Pulse Dashboard™ metrics
- **Error Handling**: Comprehensive logging and retry mechanisms for failed data pulls

### Client Benefits
- **Zero GA4 Admin Work**: Clients never need admin access or complex setup
- **Data Privacy**: Clients maintain full control over their GA4 properties
- **Seamless Integration**: Simple property ID sharing enables instant access
- **Real-Time Insights**: Fresh data automatically synced for benchmarking

*Documented: August 3, 2025*