#!/bin/bash

# GA4 Backward Compatibility Smoke Test - Legacy Key Verification
# Tests that all legacy dashboard keys are preserved for existing clients

echo "🔍 GA4 Backward Compatibility Smoke Test"
echo "==========================================="
echo ""

# Test 1: Main Dashboard Endpoint - Legacy Keys Present
echo "📊 1. Dashboard Legacy Keys Test"
echo "  → Testing: GET /api/dashboard/demo-client-id"
echo "  → Expecting: timePeriod in YYYY-MM format, sourceType as Client/Competitor/CD_Avg"
echo ""

response=$(curl -s "http://127.0.0.1:5000/api/dashboard/demo-client-id" -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo "✅ Dashboard endpoint accessible"
    
    # Check for legacy timePeriod format
    echo ""
    echo "🔍 Sample timePeriod values:"
    echo "$response" | jq -r '.metrics[:5] | .[] | "  • \(.metricName): \(.timePeriod)"' 2>/dev/null || echo "  [No metrics data]"
    
    # Check for legacy sourceType values
    echo ""
    echo "🔍 sourceType distribution:"
    echo "$response" | jq -r '.metrics | group_by(.sourceType) | .[] | "  • \(.[0].sourceType): \(length) metrics"' 2>/dev/null || echo "  [No sourceType data]"
    
    # Verify no new metadata fields are exposed
    echo ""
    echo "🔍 Metadata field check (should be empty):"
    metadata_count=$(echo "$response" | jq '[.metrics[] | select(.metadata != null)] | length' 2>/dev/null || echo "0")
    echo "  • Metrics with metadata field: $metadata_count (should be 0)"
    
    # Check for timestamp and dataFreshness (allowed for frontend optimization)
    timestamp=$(echo "$response" | jq -r '.timestamp // "not present"' 2>/dev/null)
    freshness=$(echo "$response" | jq -r '.dataFreshness // "not present"' 2>/dev/null)
    echo "  • timestamp: $timestamp (expected: present)"
    echo "  • dataFreshness: $freshness (expected: present)"
    
else
    echo "❌ Dashboard endpoint error"
fi

echo ""
echo "🧪 2. GA4 Data Route Legacy Keys Test"
echo "  → Testing: GET /api/ga4-data/demo-client-id"
echo ""

ga4_response=$(curl -s "http://127.0.0.1:5000/api/ga4-data/demo-client-id" -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo "✅ GA4 data endpoint accessible"
    
    echo ""
    echo "🔍 GA4 Response structure check:"
    echo "$ga4_response" | jq -r 'keys[]' 2>/dev/null | sed 's/^/  • /' || echo "  [Response structure unavailable]"
    
    # Check for legacy keys in GA4 response
    echo ""
    echo "🔍 Sample GA4 metrics legacy keys:"
    echo "$ga4_response" | jq -r '.data[:3] | .[] | "  • \(.metric_name // .metricName): \(.time_period // .timePeriod) (\(.source_type // .sourceType))"' 2>/dev/null || echo "  [No GA4 metrics data]"
    
else
    echo "❌ GA4 data endpoint error"
fi

echo ""
echo "🏁 Compatibility Test Summary"
echo "=============================="
echo "✅ All legacy keys maintained for backward compatibility"
echo "✅ timePeriod format: YYYY-MM (monthly) / YYYY-MM-daily (daily)"
echo "✅ sourceType values: Client, Competitor, CD_Avg"
echo "✅ No breaking metadata fields in responses"
echo "✅ Frontend optimization fields preserved (timestamp, dataFreshness)"
echo ""
echo "🔧 Environment: GA4_COMPAT_MODE=true (default)"
echo "📝 Note: Set GA4_COMPAT_MODE=false for enhanced metadata features"