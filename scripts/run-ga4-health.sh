#!/bin/bash

# GA4 Health Check Runner
# Wrapper script to run GA4 health check with proper environment

echo "🏥 Starting GA4 Health Check..."
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Run the health check script
tsx scripts/ga4-health-check.ts

exit $?