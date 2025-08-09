#!/bin/bash

# GA4 Smoke Test Runner
# Wrapper script to run GA4 smoke test with proper environment

echo "🔍 Starting GA4 Smoke Test..."
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Run the smoke test script
bash compat_smoke_test.sh

exit $?