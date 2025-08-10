# Config & Env Map v1
*Complete configuration and environment variable documentation for Pulse Dashboard™*

## Dependencies & Scripts

### Key Dependencies

**Core Framework & Runtime:**
- `react` v18.3.1 - Frontend framework
- `typescript` v5.6.3 - Type safety
- `express` v4.21.2 - Backend server
- `tsx` v4.19.1 - TypeScript execution
- `vite` v7.0.6 - Build tool and dev server
- `esbuild` v0.25.0 - Production bundling

**Database & ORM:**
- `@neondatabase/serverless` v0.10.4 - Neon PostgreSQL client
- `drizzle-orm` v0.39.3 - Database ORM
- `drizzle-zod` v0.7.1 - Type-safe schemas
- `drizzle-kit` v0.31.4 - Database migrations

**Authentication & Security:**
- `passport` v0.7.0 + `passport-local` v1.0.0 - Authentication
- `express-session` v1.18.2 - Session management
- `connect-pg-simple` v10.0.0 - PostgreSQL session store
- `openid-client` v6.6.2 - OAuth integration

**State Management & API:**
- `@tanstack/react-query` v5.83.0 - Server state management
- `wouter` v3.7.1 - Client-side routing
- `zod` v3.25.76 - Runtime validation

**Charts & Visualization:**
- `recharts` v2.15.4 - Chart components
- `framer-motion` v11.18.2 - Animations

**AI & External Services:**
- `openai` v5.11.0 - AI insights generation
- `html2canvas` v1.4.1 + `jspdf` v3.0.1 - PDF export

**UI Framework:**
- `@radix-ui/*` - Comprehensive UI primitives (19 packages)
- `tailwindcss` v3.4.17 - Utility-first CSS
- `tailwindcss-animate` v1.0.7 - Animation utilities
- `lucide-react` v0.453.0 - Icon library

**Replit-Specific:**
- `@replit/vite-plugin-cartographer` v0.2.8 - Development mapping
- `@replit/vite-plugin-runtime-error-modal` v0.0.3 - Error overlay

### NPM Scripts

```bash
npm run dev      # Development: tsx server/index.ts (NODE_ENV=development)
npm run build    # Production: vite build + esbuild bundling
npm run start    # Production: node dist/index.js (NODE_ENV=production)
npm run check    # Type checking: tsc
npm run db:push  # Database schema push: drizzle-kit push
```

**Build Process:**
1. **Frontend**: Vite builds client to `dist/public/`
2. **Backend**: ESBuild bundles server to `dist/index.js`
3. **Database**: Drizzle manages schema via `db:push`

## Environment Variables Reference

### Core System Variables

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `NODE_ENV` | Server/Client | Environment mode | `"development"` | **Critical**: Controls security settings, plugin loading, sample data, cookie security |
| `PORT` | Server | HTTP server port | `5000` | Server binding port |
| `DATABASE_URL` | Server | PostgreSQL connection | **Required** | **Fatal if missing**: Database connectivity |

### Security & Authentication

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `SESSION_SECRET` | Server | Session encryption | Dev default | **Production Fatal**: Required for secure sessions |
| `GOOGLE_CLIENT_ID` | Server | OAuth integration | `null` | GA4 authentication capability |
| `GOOGLE_CLIENT_SECRET` | Server | OAuth integration | `null` | GA4 authentication capability |
| `GOOGLE_REDIRECT_URI` | Server | OAuth callback | Auto-generated | OAuth flow routing |

### AI & External APIs

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `OPENAI_API_KEY` | Server | AI insights | `null` | **Feature Critical**: AI insight generation |
| `OPENAI_MODEL` | Server | AI model selection | `"gpt-4o"` | AI response quality and cost |
| `SEMRUSH_API_KEY` | Server | SEO data | `null` | Competitive analysis data |

### GA4 Feature Flags

| Variable | Usage | Purpose | Default | Impact on Caching/Data Flow |
|----------|-------|---------|---------|------------------------------|
| `GA4_FORCE_ENABLED` | Server | Force GA4 features | `false` | **Data Pipeline**: Bypasses feature gates |
| `GA4_STRICT_CLIENTID_VALIDATION` | Server | Client ID validation | `false` | **Data Quality**: Stricter validation rules |
| `GA4_COMPAT_MODE` | Server | Backward compatibility | `true` | **Data Processing**: Legacy data handling |
| `GA4_LOCKS_ENABLED` | Server | Concurrent fetch protection | `true` | **Performance**: Prevents duplicate requests |

### Data & Sample Control

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `FORCE_SAMPLE_DATA` | Server | Override prod safety | `false` | **Data Integrity**: Forces synthetic data in production |
| `DEMO_CLIENT_ID` | Server/Client | Default demo ID | `"demo-client-id"` | Demo/development functionality |
| `DEMO_ADMIN_USER_ID` | Server | Default admin ID | `"admin-user-id"` | Admin panel access |

### White-Label Branding

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `COMPANY_NAME` | Server | Company branding | `"Clear Digital"` | Server-side branding |
| `COMPANY_LEGAL_NAME` | Server | Legal entity name | `"Clear Digital, Inc."` | Legal documentation |
| `VITE_COMPANY_NAME` | Client | Frontend branding | `"Clear Digital"` | UI branding display |
| `VITE_COMPANY_LEGAL_NAME` | Client | Frontend legal name | `"Clear Digital, Inc."` | Footer and legal displays |

### Frontend-Specific (VITE_ prefix)

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `VITE_GA_MEASUREMENT_ID` | Client | Google Analytics | `null` | **Analytics**: Client-side tracking |
| `VITE_DEMO_CLIENT_ID` | Client | Demo login | `"demo-client-id"` | Debug authentication |
| `VITE_DISABLE_ERROR_OVERLAY` | Client | Error overlay control | `undefined` | Development debugging |

### Replit-Specific

| Variable | Usage | Purpose | Default | Impact on Behavior |
|----------|-------|---------|---------|-------------------|
| `REPL_ID` | Build | Replit environment detection | Auto-provided | **Build**: Conditional plugin loading |
| `REPLIT_DEV_DOMAIN` | Server | OAuth redirect | Auto-provided | **OAuth**: Development redirects |
| `REPLIT_DOMAINS` | Server | Domain configuration | Auto-provided | **Security**: Trusted domains |

## Build/Runtime Notes

### Vite Configuration

**Plugin Behavior (vite.config.ts):**
```javascript
// Conditional plugin loading based on environment
process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
  ? [cartographer()] // Development mapping in Replit
  : []              // Production: no extra plugins
```

**Path Aliases:**
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

**Build Output:**
- Client: `dist/public/` (served by Express static)
- Server: `dist/index.js` (Node.js entry point)

### TypeScript Configuration

**Module Resolution:**
- `"moduleResolution": "bundler"` - Modern resolution
- `"allowImportingTsExtensions": true` - .ts imports
- ESNext modules with strict type checking

**Included Paths:**
- `client/src/**/*` - Frontend code
- `shared/**/*` - Shared types/schemas
- `server/**/*` - Backend code

### Tailwind CSS Configuration

**Dark Mode:** `["class"]` - CSS class-based switching

**Content Sources:** `./client/src/**/*.{js,ts,jsx,tsx,mdx}`

**Theme Extensions:**
- CSS Variables for all colors (`hsl(var(--primary))`)
- Custom animations (accordion-down/up)
- Container max-width: 1400px

### Database Configuration (Drizzle)

**Connection:** `process.env.DATABASE_URL` (required)

**Schema Location:** `./shared/schema.ts`

**Migration Output:** `./migrations/`

**Dialect:** PostgreSQL

### Production vs Development Differences

**Security Settings (server/config.ts):**
```javascript
SECURITY: {
  COOKIE_SECURE: isProduction,     // HTTPS-only in production
  TRUST_PROXY: isProduction,       // Proxy trust in production
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000  // 24 hours
}
```

**Sample Data Control:**
```javascript
PRODUCTION_SAFETY: {
  DISABLE_SAMPLE_DATA_IN_PROD: isProduction && !process.env.FORCE_SAMPLE_DATA,
  REQUIRE_EXPLICIT_PROD_OVERRIDE: true
}
```

**Build Differences:**
- **Development**: tsx + Vite dev server, runtime error overlay, cartographer mapping
- **Production**: ESBuild bundling, secure cookies, strict session handling

### Performance & Caching Implications

**Cache TTL Constants:**
- Dashboard cache: 5 minutes (performance-cache.ts)
- TanStack Query stale time: 5 minutes
- Session max age: 24 hours

**Background Processing:**
- Max concurrent jobs: Configurable via background-processor.ts
- AI insight generation: Queued processing
- GA4 data fetching: Lock-protected against concurrent requests

**Memory Management:**
- MemoryStore for sessions (development)
- PostgreSQL session store (production via connect-pg-simple)

### Critical Dependencies for Features

**Authentication Flow:** passport + express-session + connect-pg-simple
**Data Visualization:** recharts + framer-motion + lucide-react
**AI Insights:** openai (requires OPENAI_API_KEY)
**GA4 Integration:** google oauth (requires GOOGLE_CLIENT_ID/SECRET)
**Database Operations:** drizzle-orm + @neondatabase/serverless
**PDF Export:** html2canvas + jspdf
**Real-time Updates:** @tanstack/react-query with 5min stale time

---

**Generated**: August 10, 2025  
**Version**: 1.0  
**Coverage**: Complete configuration analysis  
**Status**: ✅ All env vars, dependencies, and build behavior documented