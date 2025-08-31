# Competitor Effectiveness Scoring Issue Analysis

## Problem Statement
Competitor effectiveness scoring is not being triggered automatically after client effectiveness scoring completes. The system worked correctly at 5:49 PM → 5:50 PM but failed at 7:38 PM.

## Key Evidence

### Database Analysis (from check_all_runs.ts output)
```
Recent successful pattern:
5:49:11 PM | completed  | CLIENT     | ID: 7d5cab93...
5:50:04 PM | completed  | COMPETITOR | ID: 749ef8bf... (7549ccfa...)
5:50:09 PM | completed  | COMPETITOR | ID: 341987a8... (5949b14f...)

Recent failure pattern:
7:38:13 PM | completed  | CLIENT     | ID: 2b15c1c3...
(NO competitor runs triggered)
```

### Competitors in System
- demo-client-id (Clear Digital) has 2 competitors:
  - baunfire.com (094c04f3-5418-4e3a-a5b5-6353890c8e4c)
  - clay.global (2d7aeaaa-2402-4a0e-9c53-f45b17b9714c)

### API Testing Issues
- Curl requests without authentication hit frontend router (return HTML)
- Authenticated requests from dashboard should work but competitor trigger is broken

## Files Involved

### Core API Logic
- `effectivenessRoutes.ts` - Main refresh endpoint with competitor auto-trigger
- `storage.ts` - Database operations including getCompetitorsByClient()
- `db.ts` - Database connection and configuration

### Scoring System  
- `scorer.ts` - Website effectiveness scoring engine
- `screenshot.ts` - Screenshot capture (recently optimized timeouts)
- `speed.ts` - PageSpeed Insights integration (recently enhanced with retries)

### Database Schema
- `schema.ts` - Effectiveness runs table with competitorId field

### Frontend
- `effectiveness-radar-chart.tsx` - Displays competitor data on radar chart

## Recent Changes Made
1. Optimized screenshot timeouts (15s+25s+15s instead of 30s+70s+30s)
2. Enhanced PSI reliability with retry strategies and fallback scoring
3. Added debug logging (since removed)
4. Fixed endless loop issue with time-based safeguards

## Suspected Root Cause
The competitor auto-trigger logic in effectivenessRoutes.ts (lines ~410-640) is not being reached or is failing silently after client scoring completes. The async competitor block may have a bug or the client scoring may be exiting early.

## Next Steps for Review
1. Check if client scoring at 7:38 PM actually completed successfully
2. Verify the async competitor block in effectivenessRoutes.ts is being reached
3. Check for any errors in the competitor scoring logic
4. Test the getCompetitorsByClient() function
5. Verify no recent changes broke the competitor trigger flow