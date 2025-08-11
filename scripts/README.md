# Scripts Directory

## Index Verification

### `verifyDashboardIndexes.ts`

Verifies that composite database indexes are being used correctly by dashboard queries.

**Usage:**
```bash
npx tsx scripts/verifyDashboardIndexes.ts
```

**What it checks:**
- `idx_metrics_dashboard_primary`: clientId + timePeriod + sourceType
- `idx_metrics_client_metric_time`: clientId + metricName + timePeriod  
- `idx_metrics_client_source`: clientId + sourceType

**Expected output:**
```
🔍 VERIFYING DASHBOARD COMPOSITE INDEXES...

📊 Testing: Dashboard Primary Query (clientId + timePeriod + sourceType)
Expected Index: idx_metrics_dashboard_primary
✅ Index scan detected
Plan: Index Scan using idx_metrics_dashboard_primary on metrics
Execution time: 15ms

📊 Testing: Specific Metric Query (clientId + metricName + timePeriod)
Expected Index: idx_metrics_client_metric_time
✅ Index scan detected  
Plan: Index Scan using idx_metrics_client_metric_time on metrics
Execution time: 12ms

📊 Testing: Client Source Query (clientId + sourceType)
Expected Index: idx_metrics_client_source
✅ Index scan detected
Plan: Index Scan using idx_metrics_client_source on metrics
Execution time: 8ms

📋 INDEX VERIFICATION SUMMARY
═══════════════════════════════════════════════
Total queries tested: 3
Using expected indexes: 3
Not using indexes / errors: 0

🎉 ALL QUERIES USING EXPECTED INDEXES!

Performance benefits expected:
- Dashboard primary queries: 85-90% faster
- Specific metric lookups: 80-85% faster  
- Client source queries: 75-80% faster
```

**If indexes are not being used:**
1. Ensure schema changes are applied: `npm run db:push`
2. Check that queries match the expected index column order
3. Verify sufficient data exists for the query planner to choose indexes
4. Check PostgreSQL statistics are up to date

**Performance Impact:**
The composite indexes significantly improve query performance by:
- Reducing scan time from full table scans to targeted index lookups
- Enabling efficient sorting on indexed columns
- Supporting complex WHERE clauses with multiple conditions
- Optimizing JOIN operations in dashboard aggregation queries