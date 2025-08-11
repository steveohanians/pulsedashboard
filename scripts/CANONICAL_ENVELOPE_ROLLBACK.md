
# 📋 CANONICAL ENVELOPE ROLLBACK DOCUMENTATION

## Quick Rollback Instructions

### 1. Disable Feature Flag
```bash
# In .env file or environment variables
FEATURE_CANONICAL_ENVELOPE=false
```

### 2. Restart Application
```bash
# Restart the application to pick up new environment variable
npm run dev
```

### 3. Verify Legacy Reader Operation
```bash
# Test that readers fall back to legacy format
curl -H "Cookie: session_cookie" "http://localhost:3000/api/dashboard/demo-client-id?timePeriod=Last%20Month"
```

## Detailed Rollback Process

### Phase 1: Immediate Rollback (0-5 minutes)
1. **Stop New Canonical Writes**
   - Set `FEATURE_CANONICAL_ENVELOPE=false`
   - Restart application servers
   - Verify new metrics store only in legacy format

2. **Validate Legacy Reads**
   - Test dashboard endpoints return data
   - Check that chart components render correctly
   - Verify no null reference errors

### Phase 2: Data Cleanup (Optional)
If you want to remove canonical envelopes entirely:

```sql
-- Count metrics with canonical envelopes
SELECT COUNT(*) FROM metrics WHERE canonical_envelope IS NOT NULL;

-- Remove canonical envelopes (BACKUP FIRST!)
UPDATE metrics SET canonical_envelope = NULL 
WHERE canonical_envelope IS NOT NULL;
```

### Phase 3: Monitoring (1-24 hours)
- Monitor application logs for canonical envelope references
- Check dashboard performance metrics
- Verify chart rendering across all metric types

## Recovery Verification Commands

```bash
# Check feature flag status
echo "FEATURE_CANONICAL_ENVELOPE: $FEATURE_CANONICAL_ENVELOPE"

# Test legacy metric reading
npx tsx scripts/testCanonicalSystem.ts

# Validate database state
psql $DATABASE_URL -c "SELECT 
  COUNT(*) as total_metrics,
  COUNT(canonical_envelope) as with_canonical 
FROM metrics;"
```

## Emergency Contact
If rollback fails, check:
1. Application logs for canonical envelope parsing errors
2. Database connectivity
3. Environment variable propagation
4. Cache invalidation

## Notes
- The dual-read system should handle mixed legacy/canonical data gracefully
- Rollback does NOT require data migration - legacy readers work immediately
- Re-enabling canonical envelope will resume write-time canonicalization
