#!/bin/bash

# Enable Canonical Metric Envelope System
# This script enables the canonical envelope feature and runs migration

echo "🚀 Enabling Canonical Metric Envelope System..."

# Set the feature flag
export FEATURE_CANONICAL_ENVELOPE=true

echo "✅ Feature flag FEATURE_CANONICAL_ENVELOPE set to true"

# Run migration in dry-run mode first
echo "📋 Running migration dry-run..."
tsx migrateMetrics.ts --dry-run

echo ""
echo "🔄 To run actual migration:"
echo "  FEATURE_CANONICAL_ENVELOPE=true tsx migrateMetrics.ts"
echo ""
echo "📊 To test the system:"
echo "  tsx testCanonicalSystem.ts"
echo ""
echo "🎯 System is ready! New metrics will automatically use canonical envelope format."