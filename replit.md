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

**Navigation Enhancement Updates (July 30, 2025 - Late Evening)**
✓ Implemented sticky left navigation with active section highlighting
✓ Added smooth scrolling to metric sections when clicking navigation items
✓ Fixed scroll positioning to account for sticky header (64px + 20px padding)
✓ Resolved string matching issues between navigation items and metric IDs
✓ Replaced complex intersection observer with reliable scroll-based detection
✓ Added debounced scroll handling (100ms) for smooth performance
✓ Navigation now accurately highlights current section without flashing
✓ All navigation items work correctly including "Pages per Session" and "Sessions per User"

**Final Navigation Stability Updates (July 31, 2025 - Early Morning)**
✓ Converted navigation from sticky to fixed positioning to eliminate jumping
✓ Added manual click protection to prevent scroll handler interference
✓ Implemented 400ms throttled scroll detection with distance-based section matching
✓ Added proper TypeScript interfaces and cleaned up code architecture
✓ Eliminated all visual flashing and navigation instability issues
✓ Navigation now provides perfect stability with accurate real-time highlighting

**Chart Optimization and Data Enhancement (July 31, 2025 - Very Early Morning)**
✓ Changed Pages per Session from bar chart to line chart for better trend visualization
✓ Added comprehensive sample data for Pages per Session (2.4 client, 2.1 industry avg, 2.3 CD avg)
✓ Added Sessions per User sample data across multiple time periods
✓ Fixed Session Duration chart hover colors (50% lighter grey)
✓ Implemented transparent bottom borders for all bar chart types
✓ Added stable Y-axis domains to prevent label jumping when toggling data
✓ Disabled animations after first user interaction for smoother experience
✓ Enhanced tooltip consistency with proper colored indicators for all chart entries

**Enhanced User Experience Improvements (July 31, 2025 - Late Morning)**
✓ Fixed client name display in dashboard header - now shows actual client name instead of blank
✓ Added website URL next to client name with pink link and external icon hover effect
✓ Implemented admin-only display for users without specific client assignment
✓ Enhanced custom date range functionality with proper American date format
✓ Added smart period display showing actual dates (June 2025, Q2 2025, June 2024 - June 2025)
✓ Applied consistent light grey background styling to all AI insight boxes
✓ Cleaned up header layout by removing duplicate URL display

**Final Chart and Data Improvements (July 31, 2025 - Early Night)**
✓ Changed Sessions per User to line chart matching Pages per Session visualization
✓ Added "sessions" unit display for Sessions per User performance values and tooltips
✓ Added comprehensive sample data for Sessions per User across all time periods
✓ Added competitor data for both Pages per Session and Sessions per User metrics
✓ Added filter information display below metric headers with clock and filter icons
✓ Made filter text smaller (text-xs) and icons smaller (h-3 w-3) for better fit
✓ Both line chart metrics now show proper trend data with realistic engagement values

**Traffic Channels Horizontal Stacked Bar Implementation (July 31, 2025 - Late Night)**
✓ Implemented horizontal stacked percentage bar chart for Traffic Channels
✓ Each row shows Client, CD Client Avg, Industry Avg, and competitors with percentage breakdown
✓ Added comprehensive traffic channel data (Organic Search, Direct, Social Media, Paid Search, Email)
✓ Company names display on left side of bars with Client name in bold primary color styling
✓ Fixed competitor data duplication issues with channel-based deduplication logic
✓ Added colored legend with proper channel identification
✓ Removed performance display for Traffic Channels section
✓ Clean horizontal layout with proper spacing and no overlapping elements
✓ Applied deduplication logic to all data sources (Client, CD_Avg, Industry_Avg, Competitors)
✓ Fixed database duplicate entries causing repeated percentage displays in chart bars

**Comprehensive Code Cleanup and Optimization (July 31, 2025 - Very Early Morning)**
✓ Created shared utility files for better code organization and reusability
✓ Added chartDataProcessing.ts with color constants, data parsing helpers, and formatting utilities
✓ Implemented ErrorBoundary component for better error handling across the application
✓ Created reusable ChartContainer component for consistent chart layout and styling
✓ Added PerformanceIndicator component for standardized metric comparisons
✓ Added LoadingSpinner component for consistent loading states
✓ Optimized dashboard data processing with useMemo and useCallback hooks for better performance
✓ Fixed all TypeScript compilation errors and improved type safety throughout the codebase
✓ Consolidated chart color constants into centralized CHART_COLORS configuration
✓ Enhanced code maintainability by extracting repetitive data processing logic into reusable functions

**Complete Competitor Data Integration (July 31, 2025 - Very Early Morning)**
✓ Fixed competitor data generation to include all 5 time periods (2024-01, 2024-10, 2025-04, 2025-05, 2025-06)
✓ Generated comprehensive traffic channel data with individual channel entries for competitors
✓ Added device distribution data for all time periods with realistic percentages
✓ Created varied session duration, bounce rate, pages per session, and sessions per user metrics
✓ Fixed inconsistent time period formatting from "2024-Q4" to "2024-10" across all components
✓ Updated frontend period mapping in time-series-chart.tsx and bar-chart.tsx
✓ Fixed server-side period arrays and data generation files
✓ Ensured consistent "Oct 24" display instead of confusing "Q4 24" format
✓ All charts now show competitor data dynamically across time periods

**Final Sample Data and Chart Improvements (July 31, 2025 - Very Late Morning)**
✓ Completely regenerated all sample data with realistic business metrics
✓ Session Duration now shows proper values (3-5 minutes) instead of unrealistic seconds
✓ Fixed Y-axis scaling for Pages per Session and Sessions per User for better data visualization
✓ Improved Y-axis labels with proper decimal formatting for engagement metrics
✓ Enhanced competitor data generation with seed-based algorithms for consistent variation
✓ All metrics now display with appropriate units and realistic business ranges

**Traffic Channel Data Complete Fix (July 31, 2025 - Early Morning)**
✓ Removed all competitor data from database (cleared 2 competitors and their metrics)
✓ Completely cleared and regenerated all traffic channel data with proper channel breakdown
✓ Fixed server-side data processing to preserve channel information instead of averaging values
✓ Generated clean traffic channel data with 5 channels per source (Organic Search, Direct, Social Media, Paid Search, Email)
✓ Traffic channels now show realistic percentage distributions: Client (45%/28%/18%/6%/3%), CD_Avg (46%/25%/16%/8%/5%), Industry_Avg (48%/22%/15%/10%/5%)
✓ Chart displays proper stacked bars with color-coded segments instead of uniform 20% bars
✓ Data flows correctly from database through API to frontend with channel-specific values

**Header and UI Improvements (July 31, 2025 - Late Morning)**
✓ Fixed client name display in dashboard header - now shows actual client name instead of blank
✓ Added website URL next to client name with pink link and external icon hover effect
✓ Implemented admin-only display for users without specific client assignment
✓ Enhanced custom date range functionality with proper American date format
✓ Added smart period display showing actual dates (June 2025, Q2 2025, June 2024 - June 2025)
✓ Applied consistent light grey background styling to all AI insight boxes
✓ Cleaned up header layout by removing duplicate URL display

**Competitor Management Enhancement (July 31, 2025 - Early Night)**
✓ Fixed competitor display - now shows clean URLs without protocols or icons
✓ Added delete functionality to competitor boxes with red hover effect
✓ Implemented 3-competitor maximum limit with dynamic manage button visibility
✓ Fixed cache invalidation issues in CompetitorModal for proper data refresh
✓ Added competitor count indicator (1/3, 2/3, 3/3) in manage modal
✓ Enhanced modal with maximum limit warning when 3 competitors reached
✓ Consistent height styling between competitor entries and manage button
✓ Replaced page reloads with React Query refetch for smooth data updates
✓ Time period changes, competitor management, and AI insights now update seamlessly

**Dynamic Competitor Chart Integration (July 31, 2025 - Very Late Night)**
✓ Fixed Traffic Channels to work dynamically with any competitors added/removed
✓ Fixed Device Distribution to work dynamically with any competitors added/removed
✓ Both charts generate realistic, varied data for each competitor using seed-based algorithms
✓ Competitors properly appear and disappear when added/removed from dashboard
✓ Implemented responsive grid layout for Device Distribution with max 3 items per row
✓ Enhanced chart spacing and alignment for consistent visual presentation across all scenarios

**Performance Calculation and Chart Data Accuracy (July 31, 2025 - Very Early Morning)**
✓ Fixed "Your Performance" calculation to properly average values across selected time periods
✓ Dashboard now calculates correct averages for "Last Quarter" (3 periods) and "Last Year" (5 periods)
✓ Fixed Session Duration display format from "255 min" to "4.3 min" (converting seconds to minutes)
✓ Removed artificial variance from all chart data generation functions
✓ Chart tooltips now show actual averaged database values instead of synthetic display data
✓ Fixed time-series-chart.tsx, bar-chart.tsx, and area-chart.tsx to use real data
✓ All charts now ready for real data integration with accurate tooltip displays
✓ Performance indicators and chart displays now show consistent, mathematically correct values

**CRITICAL BOUNCE RATE TIME-SERIES FIX (July 31, 2025 - Early Morning)**
✓ Fixed bounce rate time-series chart missing timeSeriesData and periods props
✓ Bounce rate now properly displays multi-period data for "Last Quarter" and "Last Year"
✓ Resolved persistent 0 values issue affecting bounce rate across all time periods
✓ All time-series charts now receive consistent data structure for proper chart rendering

**SESSION DURATION BAR CHART ENHANCEMENT (July 31, 2025 - Early Morning)**
✓ Added timeSeriesData and periods props support to MetricBarChart component
✓ Implemented processTimeSeriesForBar function for real multi-period data processing
✓ Session duration now displays actual database values for "Last Quarter" and "Last Year"
✓ Fixed function definition order to prevent runtime errors

**TRAFFIC CHANNELS MULTI-PERIOD DATA FIX (July 31, 2025 - Very Early Morning)**
✓ Identified critical issue: server was losing channel information in time-series responses
✓ Updated server routes to preserve channel data in multi-period queries
✓ Fixed frontend processTrafficChannelData to use timeSeriesData for multi-period views
✓ Resolved mixed data format issue (JSON arrays vs individual channel records)
✓ Cleaned up legacy JSON-format competitor data causing truncated bars
✓ Enhanced aggregation function to handle both data formats properly
✓ Competitor creation route now generates complete data for all 5 time periods
✓ All traffic channel charts now display correctly across all time period selections
✓ Multi-period data aggregation working perfectly for Client, CD Client Avg, Industry Avg, and competitors

**GA4 INTEGRATION PREPARATION (July 31, 2025 - Early Morning)**
✓ Added GA4 Property ID field to admin panel client management
✓ Implemented field in both "Add Client" and "Edit Client" forms
✓ Added GA4 Property ID column to client management table with proper display
✓ Used realistic 12-digit placeholder format (ex: 412345678901) matching actual GA4 property IDs
✓ Applied monospace font styling for better readability of numeric IDs
✓ Added helpful description text explaining the field's purpose
✓ System now ready for real GA4 data integration once service accounts are configured

**COMPREHENSIVE BRANDING UPDATE (July 31, 2025 - Early Morning)**
✓ Changed all instances of "CD Client Avg" to "Clear Digital Clients Avg" throughout entire codebase
✓ Updated frontend chart components: time-series-chart.tsx, bar-chart.tsx, area-chart.tsx
✓ Updated dashboard.tsx data processing for traffic channels and device distribution
✓ Updated gauge-chart.tsx comparison display labels
✓ Updated all chart color definitions and state initialization objects
✓ Updated checkbox labels and visibility controls across all chart types
✓ Updated tooltip references and data processing functions
✓ Maintained database sourceType as "CD_Avg" for data consistency while updating display labels
✓ Enhanced brand clarity with full company name in client-facing displays

**COMPREHENSIVE RESPONSIVE DESIGN OVERHAUL (July 31, 2025 - Morning)**
✓ Fixed authentication page layout with mobile-first flex column design for smaller screens
✓ Enhanced auth page marketing section to be visible on all screen sizes with responsive text and icon scaling
✓ Optimized dashboard header with improved mobile spacing, truncated text, and responsive button sizing
✓ Made admin panel header fully responsive with adaptive navigation and properly sized icons
✓ Enhanced admin panel tabs with stacked mobile layout and abbreviated labels for small screens
✓ Implemented horizontal scrolling tables with responsive column visibility (hidden on smaller screens)
✓ Created mobile-friendly table rows with stacked information and priority-based content display
✓ Enhanced stacked bar charts with mobile-responsive layout and improved label handling
✓ Optimized chart containers with responsive height scaling across all screen sizes
✓ Fixed footer padding and text sizing for consistent mobile experience
✓ Applied responsive design to password reset and forgot password pages with proper mobile layouts
✓ Enhanced 404 page with mobile-friendly flex layouts and responsive icon/text sizing
✓ All interactive elements now properly sized for touch interfaces with appropriate spacing

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