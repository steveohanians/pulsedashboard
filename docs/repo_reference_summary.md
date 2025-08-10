# Pulse Dashboard™ - Repository Summary

## **Quick Reference Guide**

**🎯 Purpose**: Full-stack analytics benchmarking dashboard for B2B clients with GA4 integration and AI-powered insights.

**📊 Architecture**: React 18 + TypeScript frontend, Node.js/Express backend, PostgreSQL database, 210 files total.

**🔧 Tech Stack**: TanStack Query, Wouter routing, shadcn/ui, Recharts, Drizzle ORM, Passport.js authentication.

---

## **🚀 Key Features**

- **GA4 Integration**: Smart 15-month data fetching with OAuth service accounts
- **AI Insights**: OpenAI-powered recommendations with persistent storage  
- **Benchmarking**: Client vs Industry vs Portfolio competitive analysis
- **Chart System**: 6 chart types with unified color management
- **Authentication**: Session-based auth with role-based access control
- **Performance**: Query optimization, caching, background processing

---

## **📁 Directory Structure**

```
├── server/           # Backend (50+ files)
│   ├── services/ga4/ # GA4 integration (15 files)
│   ├── utils/        # Utilities & middleware
│   └── routes/       # API endpoints
├── client/src/       # Frontend (80+ files)  
│   ├── components/   # UI components & charts
│   ├── pages/        # Route components
│   ├── hooks/        # React hooks
│   └── utils/        # Frontend utilities
├── shared/           # Database schema & types
├── docs/             # Documentation
└── [config files]    # TypeScript, Vite, Tailwind, etc.
```

---

## **🔗 Critical Endpoints**

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `GET /api/dashboard/:clientId` | Main dashboard data | ✅ |
| `POST /api/login` | User authentication | ❌ |
| `GET /api/ai-insights/:clientId` | AI recommendations | ✅ |
| `POST /api/ga4-data/fetch/:clientId` | Trigger GA4 sync | Admin |
| `GET /api/health` | System status | ❌ |

---

## **🔧 Essential Commands**

```bash
# Development
npm run dev              # Start full-stack dev server

# Database  
npm run db:push          # Apply schema changes

# Production
npm run build            # Build for production
```

---

## **🌍 Environment Setup**

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption  
- `OPENAI_API_KEY` - AI insights generation

**Feature Flags:**
- `GA4_COMPAT_MODE` - Backward compatibility (default: true)
- `NODE_ENV` - Environment mode

---

## **📊 Database Schema**

**17 Tables including:**
- `clients` - Customer data with GA4 properties
- `metrics` - Time-series analytics data (JSONB values)
- `users` - Authentication & role management
- `aiInsights` - Persistent AI recommendations
- `ga4PropertyAccess` - GA4 OAuth & sync status

---

## **🎨 Chart System**

**6 Active Chart Types:**
1. **Time Series** - Trend analysis with competitor comparison
2. **Metrics Bar** - Performance metric comparison  
3. **Area Chart** - Session duration visualization
4. **Stacked Bar** - Multi-dimensional data display
5. **Lollipop** - Value comparison with benchmarks
6. **Bar Chart** - Simple comparative metrics

**Color Management**: Unified system with specialized functions for channels, devices, competitors, and metrics.

---

## **🚦 Data Flow**

**GA4 Pipeline:**
```
GA4 Property → OAuth → API → SmartDataFetcher → Database → Charts
```

**Authentication:**
```  
Login → Passport → Session Store → Protected Routes → Dashboard
```

**AI Insights:**
```
Metrics → OpenAI API → Processing → Database → Real-time Display
```

---

## **⚡ Performance Features**

- **Query Caching**: 60s TTL on dashboard queries
- **Background Processing**: AI insights generated asynchronously  
- **Connection Pooling**: Neon serverless optimization
- **Parallel Queries**: Multiple database calls simultaneously
- **Chart Optimization**: Efficient data transformation

---

## **🔒 Security & Production**

- **Session Management**: Secure cookies with PostgreSQL store
- **Rate Limiting**: Authentication endpoint protection
- **Security Headers**: Comprehensive HTTP security
- **Health Monitoring**: System status & database connectivity
- **Error Handling**: Structured logging with context

---

## **🎯 Recent Optimizations**

**✅ Completed (August 2025):**
- Chart cleanup: Removed unused radial/gauge charts (~11KB reduction)
- Performance: Parallel query implementation  
- Data integrity: Eliminated synthetic fallback data
- Monitoring: GA4 health check infrastructure

**🔧 System Status:**
- Application: ✅ Operational
- GA4 Integration: ✅ Active with backward compatibility
- AI Insights: ✅ Functioning with persistent storage
- Performance: ✅ Optimized with sub-5s load times

---

**📅 Last Updated**: August 10, 2025  
**📈 Files Analyzed**: 210 across full-stack architecture  
**🎯 Focus**: Production-ready analytics dashboard with authentic data integration