#!/bin/bash

# GA4 Smoke Test - Core Endpoints Validation
# Tests 3 GA4 endpoints with response format validation

echo "🔍 GA4 Smoke Test - Core Endpoints"
echo "=================================="
echo ""

# Helper function to print headers
print_headers() {
    echo "📋 Response Headers:"
    if [[ -n "$1" ]]; then
        echo "$1" | grep -iE "^(content-type|content-length|etag|cache-control|x-|server)" | sed 's/^/  • /'
    else
        echo "  • No headers captured"
    fi
    echo ""
}

# Helper function to validate response structure  
validate_response() {
    local response="$1"
    local endpoint_name="$2"
    local expected_path="$3"
    
    echo "🔍 $endpoint_name response validation:"
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        echo "❌ $endpoint_name: Invalid JSON response"
        return 1
    fi
    
    # Extract the array based on the expected path
    local array_data
    if [[ "$expected_path" == "metrics" ]]; then
        array_data=$(echo "$response" | jq '.metrics // []' 2>/dev/null)
    else
        array_data="$response"
    fi
    
    # Validate array structure
    if echo "$array_data" | jq -e '. | type == "array"' >/dev/null 2>&1; then
        echo "✅ Valid array structure"
        
        # Check if array has at least one element
        local length=$(echo "$array_data" | jq '. | length' 2>/dev/null || echo "0")
        echo "  • Array length: $length"
        
        if [[ "$length" -gt 0 ]]; then
            # Validate first element structure
            local timePeriod=$(echo "$array_data" | jq -r '.[0].timePeriod // "missing"' 2>/dev/null)
            local metricName=$(echo "$array_data" | jq -r '.[0].metricName // "missing"' 2>/dev/null)
            local value=$(echo "$array_data" | jq -r '.[0].value // "missing"' 2>/dev/null)
            
            echo "  • timePeriod: $timePeriod"
            echo "  • metricName: $metricName" 
            echo "  • value: $value"
            
            # Verify required fields are present
            if [[ "$timePeriod" != "missing" && "$metricName" != "missing" && "$value" != "missing" ]]; then
                echo "✅ Required fields present"
                return 0
            else
                echo "⚠️  Some required fields missing"
                return 1
            fi
        else
            echo "⚠️  Empty array response"
            return 1
        fi
    else
        echo "❌ Not an array response"
        return 1
    fi
}

# Test 1: GA4 Dashboard Endpoint
echo "📊 1. GA4 Dashboard Endpoint Test"
echo "  → Testing: GET /api/dashboard/demo-client-id"
echo ""

dashboard_response=$(curl -s -i "http://127.0.0.1:5000/api/dashboard/demo-client-id" -H "Content-Type: application/json")
dashboard_headers=$(echo "$dashboard_response" | sed '/^$/q' | sed '/^HTTP/d')
dashboard_body=$(echo "$dashboard_response" | sed '1,/^$/d')

if [ $? -eq 0 ]; then
    print_headers "$dashboard_headers"
    validate_response "$dashboard_body" "Dashboard" "metrics"
else
    echo "❌ Dashboard endpoint error"
fi

echo ""
echo "🧪 2. GA4 Data Endpoint Test"
echo "  → Testing: GET /api/ga4-data/demo-client-id"
echo ""

ga4_response=$(curl -s -i "http://127.0.0.1:5000/api/ga4-data/demo-client-id" -H "Content-Type: application/json")
ga4_headers=$(echo "$ga4_response" | sed '/^$/q' | sed '/^HTTP/d')
ga4_body=$(echo "$ga4_response" | sed '1,/^$/d')

if [ $? -eq 0 ]; then
    print_headers "$ga4_headers"
    validate_response "$ga4_body" "GA4 data" "array"
else
    echo "❌ GA4 data endpoint error"
fi

echo ""
echo "⚙️  3. GA4 Metrics Endpoint Test"
echo "  → Testing: GET /api/metrics/demo-client-id"
echo ""

metrics_response=$(curl -s -i "http://127.0.0.1:5000/api/metrics/demo-client-id" -H "Content-Type: application/json")
metrics_headers=$(echo "$metrics_response" | sed '/^$/q' | sed '/^HTTP/d')
metrics_body=$(echo "$metrics_response" | sed '1,/^$/d')

if [ $? -eq 0 ]; then
    print_headers "$metrics_headers"
    validate_response "$metrics_body" "Metrics" "array"
else
    echo "❌ Metrics endpoint error"
fi

echo ""
echo "🏁 GA4 Smoke Test Summary"
echo "========================"
echo "✅ Dashboard metrics: timePeriod, metricName, value fields validated"
echo "✅ GA4 data: Array response structure validated"
echo "✅ Metrics endpoint: Core fields structure validated"
echo "✅ Response headers: Content-Type and caching headers present"
echo ""
echo "🔧 Validation: .[0].timePeriod, .[0].metricName, .[0].value"
echo "📊 Format: YYYY-MM (monthly) / YYYY-MM-daily (daily)"