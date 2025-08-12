/**
 * GA4 Status Banner Component
 * 
 * Shows sync status with subtle banner and force refresh capability
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useGA4Status } from '@/hooks/useGA4Status';

/**
 * Convert time period labels to canonical YYYY-MM format
 */
function canonicalizePeriod(timePeriod: string): string {
  if (timePeriod === "Last Month") {
    // Convert "Last Month" to current canonical format (2025-07)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  }
  return timePeriod;
}

interface GA4FetchStatus {
  clientId: string;
  timePeriod: string;
  inProgress: boolean;
  lastRefreshedAt: string | null;
  startedAt?: string | null;
  error?: string | null;
  dataType?: 'daily' | 'monthly' | null;
  lockKey: string;
}

interface StatusBannerProps {
  clientId: string;
  timePeriod?: string;
  isAdmin?: boolean;
}

export function StatusBanner({ clientId, timePeriod, isAdmin = false }: StatusBannerProps) {
  const [lastPolled, setLastPolled] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  // Convert time period to canonical format (Last Month -> 2025-07)
  const canonicalPeriod = useMemo(() => {
    return timePeriod ? canonicalizePeriod(timePeriod) : undefined;
  }, [timePeriod]);

  // Use centralized GA4 status hook with proper 404 handling  
  const { data: ga4Status, isLoading, error } = useGA4Status(
    clientId, 
    canonicalPeriod || '', 
    !!canonicalPeriod
  );

  // Force refresh mutation
  const forceRefreshMutation = useMutation({
    mutationFn: (params: { reason?: string }) =>
      apiRequest('POST', `/api/ga4-data/force-refresh/${clientId}`, {
        timePeriod: canonicalPeriod,
        reason: params.reason || 'Manual force refresh'
      }),
    onSuccess: () => {
      // Invalidate status query to get fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/ga4-data/status", clientId] });
      // Also invalidate dashboard data to refresh charts
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', clientId] });
    }
  });

  // Update last polled timestamp
  useEffect(() => {
    if (ga4Status) {
      setLastPolled(new Date());
    }
  }, [ga4Status]);

  // Handle force refresh
  const handleForceRefresh = () => {
    forceRefreshMutation.mutate({
      reason: `Admin force refresh - ${new Date().toISOString()}`
    });
  };

  // Don't render anything if loading or no GA4 status
  if (isLoading || !ga4Status) {
    return null;
  }

  // Map GA4 status to banner display format
  const inProgress = ga4Status.status === "processing";
  const hasError = ga4Status.status === "error";
  const isReady = ga4Status.status === "ready";
  const isNotReady = ga4Status.status === "not_ready";

  // Don't show banner if not ready (404 case)
  if (isNotReady) {
    return null;
  }

  // Determine display state based on GA4 status
  const lastRefreshed = null; // GA4 status doesn't include timestamp data
  const relativeTime = lastRefreshed ? 
    formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true }) : 
    'Status checked';

  // Choose banner variant based on state
  let variant: 'default' | 'destructive' = 'default';
  let icon = <CheckCircle className="h-4 w-4" />;
  
  if (hasError) {
    variant = 'destructive';
    icon = <AlertCircle className="h-4 w-4" />;
  } else if (inProgress) {
    variant = 'default'; // Use default for in-progress state
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
  } else {
    icon = <Clock className="h-4 w-4" />;
  }

  return (
    <Alert variant={variant} className="mb-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {icon}
          <AlertDescription className="mb-0">
            {inProgress ? (
              <span>
                GA4 data sync in progress…
              </span>
            ) : hasError ? (
              <span>
                GA4 sync failed
              </span>
            ) : isReady ? (
              <span>
                GA4 data ready
              </span>
            ) : (
              <span>
                GA4 status: {ga4Status.status}
              </span>
            )}
          </AlertDescription>
          
          {/* Status indicators */}
          <div className="flex items-center gap-1 ml-2">
            <Badge variant="outline" className="text-xs">
              {ga4Status.status}
            </Badge>
            {inProgress && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceRefresh}
              disabled={forceRefreshMutation.isPending}
              className="text-xs"
            >
              {forceRefreshMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Force Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Additional details for admins */}
      {isAdmin && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          GA4 Status: {ga4Status.status}
          <div className="mt-1">
            Last polled: {formatDistanceToNow(lastPolled, { addSuffix: true })}
          </div>
        </div>
      )}
    </Alert>
  );
}

export default StatusBanner;