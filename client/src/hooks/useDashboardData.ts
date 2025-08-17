/**
 * Custom hook for dashboard data fetching and processing
 * Centralizes all dashboard data logic in one place
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '@/lib/queryKeys';
import { apiRequest } from '@/lib/queryClient';
import { unifiedDataService } from '@/services/unifiedDataService';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { APIError } from '@/lib/queryClient';


interface DashboardHookOptions {
  timePeriod: string;
  businessSize?: string;
  industryVertical?: string;
  clientId?: string;
}

interface DashboardHookReturn {
  // Data
  data: any;
  processedData: any;
  isLoading: boolean;
  error: APIError | null;
  
  // Insights
  insights: any;
  insightsLoading: boolean;
  insightsError: any;
  
  // Competitors
  competitors: any[];
  deleteCompetitor: (id: string) => void;
  deletingCompetitorId: string | null;
  
  // Actions
  refetch: () => void;
  refetchInsights: () => void;
  clearInsights: () => void;
  
  // Metadata
  client: any;
  metrics: any[];
  periods: any;
  dataQuality: any;
}

export function useDashboardData({
  timePeriod = 'Last Month',
  businessSize = 'All',
  industryVertical = 'All',
  clientId
}: DashboardHookOptions): DashboardHookReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [deletingCompetitorId, setDeletingCompetitorId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<APIError | null>(null);

  // Compute effective time period for custom date ranges
  const effectiveTimePeriod = timePeriod;

  // Use the provided clientId or fallback to user's clientId
  const effectiveClientId = clientId || user?.clientId || '';

  // Main dashboard data query
  const dashboardQuery = useQuery<any>({
    queryKey: QueryKeys.dashboard(
      effectiveClientId,
      effectiveTimePeriod
    ),
    queryFn: async () => {
      try {
        const result = await apiRequest(
          'GET',
          `/api/dashboard/${effectiveClientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod)}&businessSize=${encodeURIComponent(businessSize)}&industryVertical=${encodeURIComponent(industryVertical)}`
        );
        
        // DEBUG: Log what we actually receive
        console.log('📦 DASHBOARD API RESPONSE KEYS:', Object.keys(result));
        console.log('📦 METRICS COUNT:', result.metrics?.length || 0);
        
        // Check for different possible company data structures
        const possibleCompanyKeys = [
          'cdPortfolioCompanies',
          'cd_portfolio_companies',
          'portfolioCompanies',
          'benchmarkCompanies',
          'benchmark_companies',
          'industryBenchmarkCompanies'
        ];
        
        possibleCompanyKeys.forEach(key => {
          if (result[key]) {
            console.log(`📦 Found ${key}:`, result[key].length, 'companies');
          }
        });
        
        // Check if CD_Avg and Industry_Avg exist in metrics
        const cdAvgMetrics = result.metrics?.filter((m: any) => m.sourceType === 'CD_Avg') || [];
        const industryAvgMetrics = result.metrics?.filter((m: any) => m.sourceType === 'Industry_Avg') || [];
        
        console.log('📦 CD_Avg metrics found:', cdAvgMetrics.length);
        console.log('📦 Industry_Avg metrics found:', industryAvgMetrics.length);
        
        // Check for averaged metrics
        if (result.averagedMetrics) {
          console.log('📦 AveragedMetrics structure:', Object.keys(result.averagedMetrics));
          Object.keys(result.averagedMetrics).forEach(metricName => {
            const sources = Object.keys(result.averagedMetrics[metricName]);
            console.log(`  - ${metricName}:`, sources);
          });
        }
        
        // TEMPORARY: Expose whatever company data we find
        if (typeof window !== 'undefined') {
          (window as any).__dashboardResult = result;
          (window as any).__cdPortfolioCompanies = result.cdPortfolioCompanies || result.cd_portfolio_companies || [];
          (window as any).__benchmarkCompanies = result.benchmarkCompanies || result.benchmark_companies || [];
        }
        
        return result;
      } catch (error) {
        if (error instanceof APIError) {
          setDashboardError(error);
        }
        throw error;
      }
    },
    enabled: !!user?.clientId,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Process dashboard data using UnifiedDataService
  const processedData = useMemo(() => {
    if (!dashboardQuery.data) return null;
    
    // Use the unified service to process ALL data
    return unifiedDataService.processDashboardData(
      dashboardQuery.data,
      effectiveTimePeriod
    );
  }, [dashboardQuery.data, effectiveTimePeriod]);

  // AI Insights query
  const insightsQuery = useQuery({
    queryKey: QueryKeys.aiInsights(
      effectiveClientId,
      effectiveTimePeriod
    ),
    queryFn: async () => {
      try {
        const result = await apiRequest(
          'GET',
          `/api/ai-insights/${effectiveClientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod)}`
        );
        return result;
      } catch (error) {
        if (error instanceof APIError) {
          console.error('AI Insights error:', error);
        }
        throw error;
      }
    },
    enabled: !!effectiveClientId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Delete competitor mutation
  const deleteCompetitorMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      const response = await fetch(`/api/competitors/${competitorId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete competitor: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: QueryKeys.dashboard(effectiveClientId, effectiveTimePeriod)
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.aiInsights(effectiveClientId, effectiveTimePeriod)
      });
      
      // Refetch data
      dashboardQuery.refetch();
      insightsQuery.refetch();
      
      setDeletingCompetitorId(null);
      
      toast({
        title: 'Competitor removed',
        description: 'The competitor has been successfully removed.',
        duration: 3000,
      });
    },
    onError: (error) => {
      setDeletingCompetitorId(null);
      toast({
        title: 'Failed to remove competitor',
        description: error.message,
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  // Clear insights mutation
  const clearInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/debug/clear-all-insights', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Clear localStorage
      try {
        localStorage.removeItem('pulse_dashboard_insights');
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: QueryKeys.dashboard(effectiveClientId, effectiveTimePeriod)
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.aiInsights(effectiveClientId, effectiveTimePeriod)
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.metricInsights(effectiveClientId)
      });
      
      // Refetch
      dashboardQuery.refetch();
      insightsQuery.refetch();
      
      toast({
        title: 'Insights cleared',
        description: 'All AI insights have been cleared successfully.',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to clear insights',
        description: error.message,
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  // Helper function to delete competitor
  const deleteCompetitor = (competitorId: string) => {
    setDeletingCompetitorId(competitorId);
    deleteCompetitorMutation.mutate(competitorId);
  };

  // Extract commonly used data
  const client = dashboardQuery.data?.client;
  const competitors = dashboardQuery.data?.competitors || [];
  const metrics = dashboardQuery.data?.metrics || [];
  const insights = insightsQuery.data?.insights || [];

  return {
    // Raw and processed data
    data: dashboardQuery.data,
    processedData,
    isLoading: dashboardQuery.isLoading || dashboardQuery.isRefetching,
    error: dashboardError,
    
    // Insights
    insights,
    insightsLoading: insightsQuery.isLoading,
    insightsError: insightsQuery.error,
    
    // Competitors
    competitors,
    deleteCompetitor,
    deletingCompetitorId,
    
    // Actions
    refetch: () => {
      dashboardQuery.refetch();
      insightsQuery.refetch();
    },
    refetchInsights: () => insightsQuery.refetch(),
    clearInsights: () => clearInsightsMutation.mutate(),
    
    // Metadata
    client,
    metrics,
    periods: processedData?.periods,
    dataQuality: processedData?.dataQuality,
  };
}

/**
 * Hook for dashboard filters data
 */
export function useDashboardFilters() {
  const filtersQuery = useQuery<{
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
  }>({
    queryKey: QueryKeys.filters(),
    queryFn: async () => {
      return apiRequest('GET', '/api/filters');
    },
  });

  return {
    businessSizes: filtersQuery.data?.businessSizes || [],
    industryVerticals: filtersQuery.data?.industryVerticals || [],
    timePeriods: filtersQuery.data?.timePeriods || [],
    isLoading: filtersQuery.isLoading,
  };
}