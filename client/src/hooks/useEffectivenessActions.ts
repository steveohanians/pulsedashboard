/**
 * Simple Effectiveness Actions Hook
 * 
 * Handles starting new effectiveness runs and managing related actions.
 * Clean, simple implementation without complex state management.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { effectivenessApi } from "@/services/api/EffectivenessApiService";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { useToast } from "@/hooks/use-toast";

interface UseEffectivenessActionsOptions {
  /** Callback when analysis starts successfully */
  onStartSuccess?: (runId: string) => void;
  
  /** Callback when analysis fails to start */
  onStartError?: (error: Error) => void;
  
  /** Show toast notifications for actions */
  showToasts?: boolean;
}

export function useEffectivenessActions(
  clientId: string,
  options: UseEffectivenessActionsOptions = {}
) {
  const { onStartSuccess, onStartError, showToasts = true } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Start effectiveness analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      return await effectivenessApi.startEffectivenessAnalysis(clientId, force);
    },
    
    onSuccess: (data) => {
      // Invalidate and refetch latest data immediately
      queryClient.invalidateQueries({
        queryKey: AdminQueryKeys.effectivenessLatest(clientId)
      });
      
      if (showToasts) {
        toast({
          title: "Analysis Started",
          description: "Website effectiveness analysis is now running. This may take 3-5 minutes.",
        });
      }
      
      onStartSuccess?.(data.runId);
    },
    
    onError: (error) => {
      if (showToasts) {
        toast({
          title: "Failed to Start Analysis",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
      
      onStartError?.(error instanceof Error ? error : new Error('Unknown error'));
    },
  });

  // Helper function to start analysis
  const startAnalysis = (force = false) => {
    startAnalysisMutation.mutate({ force });
  };

  // Helper function to force restart analysis
  const forceRestartAnalysis = () => {
    startAnalysisMutation.mutate({ force: true });
  };

  // Helper function to refresh data without starting new analysis
  const refreshData = () => {
    queryClient.invalidateQueries({
      queryKey: AdminQueryKeys.effectivenessLatest(clientId)
    });
  };

  return {
    // Actions
    startAnalysis,
    forceRestartAnalysis,
    refreshData,
    
    // State
    isStarting: startAnalysisMutation.isPending,
    startError: startAnalysisMutation.error,
    
    // Raw mutation for advanced usage
    startAnalysisMutation,
  };
}

export type UseEffectivenessActionsReturn = ReturnType<typeof useEffectivenessActions>;