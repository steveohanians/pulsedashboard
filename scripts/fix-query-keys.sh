#!/bin/bash

# Comprehensive script to replace all string-based query keys with tuple-based helpers
# Run from project root

echo "🔄 Fixing string-based query keys across codebase..."

cd client/src

# Replace all admin query patterns in admin-panel.tsx
echo "📝 Fixing admin-panel.tsx patterns..."

# Replace cd-portfolio patterns
sed -i 's/queryKey: \[\"\/api\/admin\/cd-portfolio\"\]/queryKey: AdminQueryKeys.cdPortfolio()/g' pages/admin-panel.tsx
sed -i 's/queryKey: \[\"\/api\/admin\/users\"\]/queryKey: AdminQueryKeys.users()/g' pages/admin-panel.tsx  
sed -i 's/queryKey: \[\"\/api\/admin\/benchmark-companies\"\]/queryKey: AdminQueryKeys.benchmarkCompanies()/g' pages/admin-panel.tsx
sed -i 's/queryKey: \[\"\/api\/admin\/metric-prompts\"\]/queryKey: AdminQueryKeys.metricPrompts()/g' pages/admin-panel.tsx

# Replace dashboard and filters patterns with admin helpers
sed -i 's/queryKey: \[\"\/api\/dashboard\"\]/queryKey: AdminQueryKeys.allDashboards()/g' pages/admin-panel.tsx
sed -i 's/queryKey: \[\"\/api\/filters\"\]/queryKey: AdminQueryKeys.allFilters()/g' pages/admin-panel.tsx

# Fix use-auth.tsx
echo "📝 Fixing use-auth.tsx patterns..."
sed -i 's/queryKey: \[\"\/api\/user\"\]/queryKey: [\"\/api\/user\"] as const/g' hooks/use-auth.tsx

# Fix GA4IntegrationPanel.tsx
echo "📝 Fixing GA4IntegrationPanel.tsx patterns..."
sed -i 's/queryKey: \[\"\/api\/admin\/ga4-service-accounts\"\]/queryKey: AdminQueryKeys.ga4ServiceAccounts()/g' components/admin/GA4IntegrationPanel.tsx

# Add AdminQueryKeys import to GA4IntegrationPanel if not present
if ! grep -q "import.*AdminQueryKeys" components/admin/GA4IntegrationPanel.tsx; then
    sed -i '1i import { AdminQueryKeys } from "@/lib/adminQueryKeys";' components/admin/GA4IntegrationPanel.tsx
fi

echo "✅ All string-based query keys have been replaced with tuple-based helpers!"

# Verify no remaining patterns
echo "🔍 Checking for any remaining string-based patterns..."
remaining=$(grep -r "queryKey: \[\"\/api\/" . || echo "")
if [ -z "$remaining" ]; then
    echo "✅ No remaining string-based query patterns found!"
else
    echo "⚠️  Still found patterns:"
    echo "$remaining"
fi