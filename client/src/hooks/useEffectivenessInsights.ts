/**
 * Simple Effectiveness Insights Hook
 * 
 * Handles AI insights generation and caching.
 * Direct API calls matching working test patterns.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { effectivenessApi, InsightsResponse } from "@/services/api/EffectivenessApiService";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { useToast } from "@/hooks/use-toast";

interface UseEffectivenessInsightsOptions {
  /** Show toast notifications */
  showToasts?: boolean;
  
  /** Auto-generate insights for completed runs */
  autoGenerate?: boolean;
  
  /** Callback when insights are generated */
  onInsightsGenerated?: (insights: InsightsResponse) => void;
  
  /** Callback when insights generation fails */
  onInsightsError?: (error: Error) => void;
}

export function useEffectivenessInsights(
  clientId: string,
  runId: string | null,
  options: UseEffectivenessInsightsOptions = {}
) {
  const { 
    showToasts = true, 
    autoGenerate = false,
    onInsightsGenerated,
    onInsightsError
  } = options;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate insights mutation
  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      if (!runId) {
        throw new Error('No run ID available');
      }
      return await effectivenessApi.generateInsights(clientId, runId);
    },
    
    onSuccess: (data) => {
      // Cache the generated insights
      queryClient.setQueryData(
        AdminQueryKeys.effectivenessInsights(runId!),
        data
      );
      
      // Also invalidate latest data to pick up insights
      queryClient.invalidateQueries({
        queryKey: AdminQueryKeys.effectivenessLatest(clientId)
      });
      
      if (showToasts) {
        toast({
          title: "Insights Generated",
          description: "AI insights have been generated for your effectiveness analysis.",
        });
      }
      
      onInsightsGenerated?.(data);
    },
    
    onError: (error) => {
      if (showToasts) {
        toast({
          title: "Failed to Generate Insights",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
      
      onInsightsError?.(error instanceof Error ? error : new Error('Unknown error'));
    },
  });

  // Query for cached insights (optional - insights are usually embedded in main data)
  const insightsQuery = useQuery<InsightsResponse>({
    queryKey: AdminQueryKeys.effectivenessInsights(runId!),
    
    queryFn: async () => {
      // This endpoint might not exist - insights are usually embedded
      // This is here for potential future caching scenarios
      throw new Error('Direct insights query not implemented - use embedded insights from main data');
    },
    
    enabled: false, // Disabled by default - insights come from main data
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Helper functions
  const generateInsights = () => {
    if (!runId) {
      if (showToasts) {
        toast({
          title: "Cannot Generate Insights",
          description: "No completed run available.",
          variant: "destructive",
        });
      }
      return;
    }
    
    generateInsightsMutation.mutate();
  };

  const canGenerateInsights = !!runId && !generateInsightsMutation.isPending;

  return {
    // Actions
    generateInsights,
    canGenerateInsights,
    
    // State
    isGenerating: generateInsightsMutation.isPending,
    generateError: generateInsightsMutation.error,
    lastGenerated: generateInsightsMutation.data,
    
    // Query state (if using direct insights query)
    isLoading: insightsQuery.isLoading,
    isError: insightsQuery.isError,
    error: insightsQuery.error,
    
    // Raw mutation for advanced usage
    generateInsightsMutation,
    insightsQuery,
  };
}

export type UseEffectivenessInsightsReturn = ReturnType<typeof useEffectivenessInsights>;