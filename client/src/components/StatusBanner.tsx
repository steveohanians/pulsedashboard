/**
 * GA4 Status Banner Component
 * 
 * Shows sync status with subtle banner and force refresh capability
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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

  // Poll status every 3 seconds when component is mounted  
  const { data: statusData, isLoading, error } = useQuery({
    queryKey: ['/api/ga4-data/status', clientId, canonicalPeriod],
    queryFn: () => apiRequest('GET', `/api/ga4-data/status/${clientId}${canonicalPeriod ? `?timePeriod=${canonicalPeriod}` : ''}`),
    refetchInterval: 3000, // Poll every 3 seconds
    refetchOnWindowFocus: true,
    retry: 2
  });

  // Force refresh mutation
  const forceRefreshMutation = useMutation({
    mutationFn: (params: { reason?: string }) =>
      apiRequest('POST', `/api/ga4-data/force-refresh/${clientId}`, {
        timePeriod: canonicalPeriod,
        reason: params.reason || 'Manual force refresh'
      }),
    onSuccess: () => {
      // Invalidate status query to get fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/ga4-data/status', clientId] });
      // Also invalidate dashboard data to refresh charts
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', clientId] });
    }
  });

  // Update last polled timestamp
  useEffect(() => {
    if (statusData) {
      setLastPolled(new Date());
    }
  }, [statusData]);

  // Handle force refresh
  const handleForceRefresh = () => {
    forceRefreshMutation.mutate({
      reason: `Admin force refresh - ${new Date().toISOString()}`
    });
  };

  // Don't render anything if loading or no data
  if (isLoading || !statusData?.data) {
    return null;
  }

  const status: GA4FetchStatus = timePeriod ? 
    statusData.data.status : 
    statusData.data.statuses?.[0]; // Get most recent status if no specific period

  // Don't show banner if no active status and no recent activity
  if (!status && (!statusData.data.stats?.lastActivity)) {
    return null;
  }

  // Determine display state
  const inProgress = status?.inProgress || false;
  const lastRefreshed = status?.lastRefreshedAt || statusData.data.stats?.lastActivity;
  const hasError = status?.error;
  const relativeTime = lastRefreshed ? 
    formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true }) : 
    'Never';

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
                Sync in progress… 
                {status?.startedAt && (
                  <span className="text-muted-foreground ml-1">
                    (started {formatDistanceToNow(new Date(status.startedAt), { addSuffix: true })})
                  </span>
                )}
              </span>
            ) : hasError ? (
              <span>
                Sync failed: {status.error}
              </span>
            ) : (
              <span>
                Last updated {relativeTime}
              </span>
            )}
          </AlertDescription>
          
          {/* Status indicators */}
          <div className="flex items-center gap-1 ml-2">
            {status?.dataType && (
              <Badge variant="outline" className="text-xs">
                {status.dataType}
              </Badge>
            )}
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
      {isAdmin && statusData.data.stats && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          Registry: {statusData.data.stats.inProgressCount} active, 
          {statusData.data.stats.totalFetches} total fetches
          {statusData.data.stats.oldestInProgress && (
            <span className="ml-2">
              (oldest: {formatDistanceToNow(new Date(statusData.data.stats.oldestInProgress), { addSuffix: true })})
            </span>
          )}
          <div className="mt-1">
            Last polled: {formatDistanceToNow(lastPolled, { addSuffix: true })}
          </div>
        </div>
      )}
    </Alert>
  );
}

export default StatusBanner;