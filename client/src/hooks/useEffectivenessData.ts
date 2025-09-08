/**
 * Simple Effectiveness Data Hook
 * 
 * Handles polling and state management for effectiveness data.
 * Based on proven working patterns with proper timing from test results.
 */

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { effectivenessApi, EffectivenessData } from "@/services/api/EffectivenessApiService";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { deriveEffectiveStatus, shouldContinuePolling, type EffectiveStatus } from "@/utils/status-utils";

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

// Status constants moved to status-utils.ts for centralized management

/**
 * Progress smoothing utility - prevents backward progress jumps
 * Ensures progress only moves forward and handles completion transitions properly
 */
function useSmoothProgress(currentProgress: number, status: EffectiveStatus, runId?: string) {
  const progressRef = useRef<{lastProgress: number, lastRunId?: string}>({
    lastProgress: 0,
    lastRunId: undefined
  });

  // Reset if this is a new run
  if (runId !== progressRef.current.lastRunId) {
    progressRef.current = {
      lastProgress: 0,
      lastRunId: runId
    };
  }

  // For completed/failed runs, show 100%
  if (status === 'completed' || status === 'failed') {
    progressRef.current.lastProgress = 100;
    return 100;
  }

  // Ensure progress never goes backward (unless resetting for new run)
  const smoothedProgress = Math.max(currentProgress, progressRef.current.lastProgress);
  
  // Update our reference for next time
  progressRef.current.lastProgress = smoothedProgress;
  
  return smoothedProgress;
}

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
    
    // Polling logic based on effective status
    refetchInterval: (query) => {
      if (!enablePolling) return false;
      
      const run = query.state.data?.run;
      const effectiveStatus = deriveEffectiveStatus(run);
      
      // Use status utility to determine if polling should continue
      if (!shouldContinuePolling(effectiveStatus)) {
        return false;
      }
      
      // Use custom interval or default based on progress
      if (pollInterval) return pollInterval;
      
      // Faster polling for early stages, slower for completion
      const progress = run?.progress || '0%';
      const progressNum = parseInt(progress.replace('%', '')) || 0;
      
      return progressNum > 90 ? 
        POLLING_CONFIG.completionInterval : 
        POLLING_CONFIG.activeInterval;
    },
    
    // Stop polling after max duration to prevent infinite loops
    refetchIntervalInBackground: false,
    
    // Cache settings
    staleTime: POLLING_CONFIG.staleTime,
    gcTime: 5 * 60 * 1000, // 5 minutes (renamed from cacheTime in React Query v5)
    
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

  // Derived state using status utility
  const run = query.data?.run;
  const effectiveStatus = deriveEffectiveStatus(run);
  
  // Legacy compatibility flags (derived from effective status)
  const isInProgress = effectiveStatus === 'running';
  const isCompleted = effectiveStatus === 'completed';
  const isFailed = effectiveStatus === 'failed';
  const isPartial = effectiveStatus === 'partial';
  
  const hasData = query.data?.hasData || false;
  
  // Progress parsing with smoothing to prevent backward jumps
  const progressString = run?.progress || '0%';
  const rawProgressPercent = parseInt(progressString.replace('%', '')) || 0;
  const smoothedProgress = useSmoothProgress(rawProgressPercent, effectiveStatus, run?.id);
  
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
    
    // Enhanced status system
    effectiveStatus,
    
    // Legacy status flags (for backward compatibility)
    isInProgress,
    isCompleted,
    isFailed,
    isPartial,
    hasData,
    
    // Progress info (smoothed to prevent backward jumps)
    progress: smoothedProgress,
    progressString,
    progressDetail,
    rawProgress: rawProgressPercent, // Keep raw progress for debugging
    
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