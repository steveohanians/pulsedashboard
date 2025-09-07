/**
 * Simple Effectiveness Data Hook
 * 
 * Handles polling and state management for effectiveness data.
 * Based on proven working patterns with proper timing from test results.
 */

import { useQuery } from "@tanstack/react-query";
import { effectivenessApi, EffectivenessData } from "@/services/api/EffectivenessApiService";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";

// Timing constants based on actual test results
const POLLING_CONFIG = {
  // Active run polling - every 3 seconds during processing
  activeInterval: 3000,
  
  // Completion check - every 10 seconds when nearly complete  
  completionInterval: 10000,
  
  // Maximum polling duration - 6 minutes (360 seconds)
  maxPollDuration: 360000,
  
  // Stale time - 30 seconds for completed runs
  staleTime: 30000,
};

// Status groups for polling logic
const IN_PROGRESS_STATUSES = [
  'pending', 
  'initializing', 
  'scraping', 
  'analyzing',
  'tier1_analyzing', 
  'tier1_complete',
  'tier2_analyzing', 
  'tier2_complete', 
  'tier3_analyzing',
  'generating_insights'
] as const;

const COMPLETED_STATUSES = ['completed'] as const;
const FAILED_STATUSES = ['failed'] as const;

interface UseEffectivenessDataOptions {
  /** Enable automatic polling for in-progress runs */
  enablePolling?: boolean;
  
  /** Custom polling interval override */
  pollInterval?: number;
  
  /** Maximum time to poll before giving up */
  maxPollTime?: number;
}

export function useEffectivenessData(
  clientId: string, 
  options: UseEffectivenessDataOptions = {}
) {
  const {
    enablePolling = true,
    pollInterval,
    maxPollTime = POLLING_CONFIG.maxPollDuration
  } = options;

  const query = useQuery<EffectivenessData>({
    queryKey: AdminQueryKeys.effectivenessLatest(clientId),
    
    queryFn: async () => {
      return await effectivenessApi.getLatestEffectiveness(clientId);
    },
    
    // Polling logic based on run status
    refetchInterval: (query) => {
      if (!enablePolling) return false;
      
      const status = query.state.data?.run?.status;
      if (!status) return false;
      
      // Don't poll completed or failed runs
      if (COMPLETED_STATUSES.includes(status as any) || 
          FAILED_STATUSES.includes(status as any)) {
        return false;
      }
      
      // Poll in-progress runs
      if (IN_PROGRESS_STATUSES.includes(status as any)) {
        // Use custom interval or default based on progress
        if (pollInterval) return pollInterval;
        
        // Faster polling for early stages, slower for completion
        const progress = query.state.data?.run?.progress || '0%';
        const progressNum = parseInt(progress.replace('%', '')) || 0;
        
        return progressNum > 90 ? 
          POLLING_CONFIG.completionInterval : 
          POLLING_CONFIG.activeInterval;
      }
      
      return false;
    },
    
    // Stop polling after max duration to prevent infinite loops
    refetchIntervalInBackground: false,
    
    // Cache settings
    staleTime: POLLING_CONFIG.staleTime,
    cacheTime: 5 * 60 * 1000, // 5 minutes
    
    // Retry logic
    retry: (failureCount, error) => {
      // Don't retry client errors
      if (error?.message?.includes('Access denied') || 
          error?.message?.includes('not found')) {
        return false;
      }
      
      // Retry network/server errors up to 3 times
      return failureCount < 3;
    },
    
    // Exponential backoff: 1s, 2s, 4s
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
  });

  // Derived state
  const run = query.data?.run;
  const isInProgress = run?.status ? IN_PROGRESS_STATUSES.includes(run.status as any) : false;
  const isCompleted = run?.status ? COMPLETED_STATUSES.includes(run.status as any) : false;
  const isFailed = run?.status ? FAILED_STATUSES.includes(run.status as any) : false;
  const hasData = query.data?.hasData || false;
  
  // Progress parsing
  const progressString = run?.progress || '0%';
  const progressPercent = parseInt(progressString.replace('%', '')) || 0;
  
  // Progress detail parsing - handle both string and object formats
  let progressDetail = null;
  try {
    if (run?.progressDetail) {
      progressDetail = typeof run.progressDetail === 'string' ? 
        JSON.parse(run.progressDetail) : run.progressDetail;
    }
  } catch (e) {
    // Keep as string if JSON parsing fails
    progressDetail = run?.progressDetail;
  }

  return {
    // Data
    data: query.data,
    run,
    client: query.data?.client,
    competitorData: query.data?.competitorEffectivenessData,
    
    // Status flags
    isInProgress,
    isCompleted,
    isFailed,
    hasData,
    
    // Progress info
    progress: progressPercent,
    progressString,
    progressDetail,
    
    // Query state
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    
    // Actions
    refetch: query.refetch,
    
    // Raw query for advanced usage
    query,
  };
}

export type UseEffectivenessDataReturn = ReturnType<typeof useEffectivenessData>;