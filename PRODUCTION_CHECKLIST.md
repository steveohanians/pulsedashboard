# Production Deployment Checklist

## ✅ Critical Security Items (COMPLETED)
- [x] **Session Security**: httpOnly, sameSite, secure cookies
- [x] **Password Security**: Scrypt hashing with salt + timing-safe comparison
- [x] **Rate Limiting**: Authentication, file upload, admin action limits
- [x] **Security Headers**: CSP, HSTS, XSS protection, frame options
- [x] **Input Validation**: Zod schemas, SQL injection prevention
- [x] **Development Secrets**: Removed fallback values from production code
- [x] **Health Checks**: /health, /ready, /live endpoints
- [x] **Structured Logging**: Replaced console.log with proper logger

## 🔧 Environment Setup
- [ ] Set `SESSION_SECRET` environment variable (32+ characters)
- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Set `DATABASE_URL` for production database
- [ ] Configure email service (SendGrid/AWS SES/Mailgun)
- [ ] Set `NODE_ENV=production`

## 🔑 Google OAuth 2.0 Configuration

### OAuth Credentials Setup
- [ ] Verify Google Cloud Console project is configured
- [ ] Confirm required APIs are enabled:
  - Google Analytics Reporting API v4
  - Google Analytics Data API v1
  - Google Analytics Admin API v1
- [ ] OAuth consent screen configured with proper scopes
- [ ] OAuth 2.0 client credentials created
- [ ] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET added to production secrets

### Production Redirect URI Update
- [ ] **CRITICAL**: Update Google Cloud Console OAuth client with production redirect URI
  - Go to Google Cloud Console → APIs & Services → Credentials
  - Edit your OAuth 2.0 client
  - Add production redirect URI: `https://YOUR_PRODUCTION_DOMAIN/api/oauth/google/callback`
  - Keep the development URI for testing: `https://e74fcffb-82e3-4375-a72b-e621ccc03f8e-00-30he2hiv708v4.janeway.replit.dev/api/oauth/google/callback`
  - Save changes
- [ ] Test OAuth flow on production domain
- [ ] Verify GA4 service account authorization works in production

## 📱 Application Configuration
- [ ] Configure domain name in environment
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up database connection pooling
- [ ] Configure CORS for production domain

## 🚀 Performance & Monitoring
- [ ] Set up application monitoring (New Relic, DataDog, or similar)
- [ ] Configure error tracking (Sentry, Bugsnag)
- [ ] Set up log aggregation (ELK stack, CloudWatch)
- [ ] Monitor health endpoints with load balancer
- [ ] Configure auto-scaling policies

## 💾 Database & Backup
- [ ] Set up automated database backups
- [ ] Test backup restoration procedure
- [ ] Configure database monitoring
- [ ] Set up database connection limits
- [ ] Plan disaster recovery strategy

## 🧪 Testing & Quality
- [ ] Run load testing with realistic user scenarios
- [ ] Test CSV import with large files (>1MB)
- [ ] Verify cross-browser compatibility
- [ ] Test mobile responsiveness on actual devices
- [ ] Validate API rate limits under load

## 🔒 Security Audit
- [ ] Run security scanner (npm audit, Snyk, OWASP ZAP)
- [ ] Penetration testing for authentication flows
- [ ] Review file upload security
- [ ] Validate all environment variables are secure
- [ ] Ensure no sensitive data in logs

## 📋 Compliance & Legal
- [ ] Privacy policy and terms of service
- [ ] GDPR compliance documentation
- [ ] Data retention policy
- [ ] User consent mechanisms
- [ ] Data export/deletion procedures

## 🚨 Incident Response
- [ ] Document escalation procedures
- [ ] Set up alerting for critical errors
- [ ] Create runbook for common issues
- [ ] Test rollback procedures
- [ ] Plan maintenance windows

## 📊 Business Continuity
- [ ] Load balancer health checks configured
- [ ] Auto-restart policies for application crashes
- [ ] Database failover strategy
- [ ] CDN configuration for static assets
- [ ] Backup deployment strategy

---

## Quick Deploy Commands

### Build Application
```bash
npm run build
```

### Start Production Server
```bash
NODE_ENV=production npm start
```

### Database Migration
```bash
npm run db:push
```

### Health Check
```bash
curl https://yourdomain.com/health
```

---

## Emergency Contacts
- **DevOps Team**: [contact info]
- **Database Administrator**: [contact info]  
- **Security Team**: [contact info]
- **Product Owner**: [contact info]

---

*Last Updated: $(date)*
*Checklist Version: 1.0*