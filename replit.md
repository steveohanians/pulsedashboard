# Pulse Dashboard™ - Analytics Benchmarking & AI Insights

## Overview

Pulse Dashboard™ is a full-stack analytics benchmarking dashboard designed for Clear Digital's B2B clients. The application provides comprehensive web analytics insights by comparing client performance against competitors, industry averages, and Clear Digital's client portfolio averages. The system integrates with Google Analytics 4, external data sources, and leverages AI-powered insights to deliver actionable recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

ClearSight™ follows a modern full-stack architecture with clear separation between frontend, backend, and data layers:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Charts**: Recharts for data visualization

### Backend Architecture  
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for database schema management

## Key Components

### Authentication & Authorization
- JWT-based session authentication using Passport.js
- Role-based access control (Admin/Viewer roles)
- Protected routes with middleware validation
- Session persistence with PostgreSQL store

### Data Models
The system uses a comprehensive schema with the following core entities:
- **Clients**: Business information and GA4 integration details
- **Users**: Account management with role-based permissions
- **Competitors**: Client-specific competitor tracking
- **BenchmarkCompanies**: Industry-wide comparison dataset
- **Metrics**: Time-series performance data from multiple sources
- **Benchmarks**: Aggregated industry and competitor averages
- **AIInsights**: OpenAI-generated analysis and recommendations

### API Architecture
- **Public Endpoints**: Dashboard data and competitor management
- **Admin Endpoints**: System configuration and user management  
- **Data Ingestion**: Webhook endpoints for automated data collection
- **AI Integration**: OpenAI GPT-4o for intelligent insights generation

### Frontend Components
- **Dashboard**: Main analytics interface with charts and insights
- **Admin Panel**: System management for administrators
- **Authentication**: Login/register forms with validation
- **Charts**: Responsive data visualizations using Recharts
- **Modals**: Competitor management and configuration dialogs

## Data Flow

### Data Collection
1. **Automated Ingestion**: n8n workflows pull data from GA4, SEMrush, and DataForSEO
2. **API Endpoints**: External data pushed via webhook endpoints
3. **Data Processing**: Metrics normalized and stored with source attribution

### Analytics Pipeline  
1. **Raw Metrics**: Client performance data from GA4
2. **Benchmark Calculation**: Industry and competitor averages computed
3. **AI Analysis**: OpenAI processes metrics to generate insights
4. **Dashboard Rendering**: Processed data visualized in React components

### User Interaction
1. **Authentication**: Session-based login with role validation
2. **Data Filtering**: Time period, industry, and business size filters
3. **Real-time Updates**: TanStack Query manages cache invalidation
4. **Administrative Actions**: Admin users manage system configuration

## External Dependencies

### Core Infrastructure
- **Neon PostgreSQL**: Serverless database hosting
- **OpenAI API**: GPT-4o for AI-powered insights
- **n8n**: Workflow automation for data collection

## Recent Changes

### July 30, 2025
✓ Renamed project from ClearSight™ to Pulse Dashboard™
✓ Complete database schema implemented with 7 core tables
✓ Authentication system setup with Passport.js and session management
✓ AI insights service integrated with OpenAI GPT-4o
✓ Full React dashboard with Recharts visualizations
✓ Admin panel for system management
✓ Sample data added for demo client "Acme Corporation"
✓ All TypeScript errors resolved
✓ Project successfully scaffolded and ready for testing

**Latest Updates (July 30, 2025 - Evening)**
✓ Fixed React state update warning in AuthPage with useEffect
✓ Updated filter options to match client requirements:
  - Business sizes: Medium Business through Large Enterprise
  - Industry verticals: Technology subcategories, Financial Services, Healthcare, etc.
  - Time periods: Last Month, Last Quarter, Last Year, Custom Date Range
✓ Fixed admin panel navigation with URL tab parameters
✓ Dashboard admin links now navigate to correct tabs
✓ Made all edit buttons functional with dialog modals
✓ Added debug mode for easy admin/user testing
✓ Fixed database login timestamp update error
✓ All authentication and navigation issues resolved

### Data Sources
- **Google Analytics 4**: Client website performance metrics
- **SEMrush**: SEO and competitive intelligence data  
- **DataForSEO**: Additional search engine optimization metrics

### Development Tools
- **Vite**: Frontend build tooling with hot reload
- **Drizzle Kit**: Database migration management
- **ESBuild**: Backend bundling for production builds

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express backend
- **Database**: Neon PostgreSQL connection via DATABASE_URL
- **Session Management**: In-memory sessions for development

### Production Deployment
- **Build Process**: 
  1. Frontend: `vite build` generates optimized static assets
  2. Backend: `esbuild` bundles Node.js application
- **Static Assets**: Served from `dist/public` directory
- **Database**: Production PostgreSQL with connection pooling
- **Session Storage**: PostgreSQL-backed persistent sessions
- **Environment Variables**: 
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Session encryption key
  - `OPENAI_API_KEY`: AI service authentication
  - `NODE_ENV`: Environment configuration

The application is designed for deployment on platforms supporting Node.js with PostgreSQL, such as Railway, Render, or similar PaaS providers. The monorepo structure allows for single-command deployments while maintaining clear separation between client and server code.