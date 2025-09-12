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
    queryKey: QueryKeys.dashboard(effectiveClientId, effectiveTimePeriod, businessSize, industryVertical),
    queryFn: async () => {
      try {
        const result = await apiRequest(
          'GET',
          `/api/dashboard/${effectiveClientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod)}&businessSize=${encodeURIComponent(businessSize)}&industryVertical=${encodeURIComponent(industryVertical)}`
        );
        
        // Debug logging removed for cleaner console
        
        // Check for different possible company data structures
        const possibleCompanyKeys = [
          'cdPortfolioCompanies',
          'cd_portfolio_companies',
          'portfolioCompanies',
          'benchmarkCompanies',
          'benchmark_companies',
          'industryBenchmarkCompanies'
        ];
        
        // Company data structure and metrics verification - debug logs removed for cleaner console
        
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
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data doesn't change frequently
    refetchOnMount: 'always',
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnReconnect: true,
    refetchOnWindowFocus: false, // Disable to prevent unnecessary tab switching refetches
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
      // Force invalidate ALL queries to ensure UI updates
      queryClient.invalidateQueries();
      
      // Also specifically invalidate dashboard queries
      queryClient.invalidateQueries({
        queryKey: QueryKeys.dashboard(effectiveClientId, effectiveTimePeriod)
      });
      
      // Force refetch with a slight delay to ensure server state is consistent
      setTimeout(() => {
        dashboardQuery.refetch();
        insightsQuery.refetch();
      }, 500);
      
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
export function useDashboardFilters(useDynamic = false) {
  const endpoint = useDynamic ? '/api/filters/dynamic' : '/api/filters';
  const queryKey = useDynamic ? ['/api/filters/dynamic'] : QueryKeys.filters();
  
  const filtersQuery = useQuery<{
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
    dataSourceInfo?: {
      companiesWithMetrics: number;
      totalCompanies: number;
    };
  }>({
    queryKey,
    queryFn: async () => {
      return apiRequest('GET', endpoint);
    },
  });

  return {
    businessSizes: filtersQuery.data?.businessSizes || [],
    industryVerticals: filtersQuery.data?.industryVerticals || [],
    timePeriods: filtersQuery.data?.timePeriods || [],
    dataSourceInfo: filtersQuery.data?.dataSourceInfo,
    isLoading: filtersQuery.isLoading,
  };
}

export function useSmartFilterCombinations(businessSize?: string, industryVertical?: string) {
  const params = new URLSearchParams();
  if (businessSize && businessSize !== 'All') params.append('businessSize', businessSize);
  if (industryVertical && industryVertical !== 'All') params.append('industryVertical', industryVertical);
  
  const endpoint = `/api/filters/combinations${params.toString() ? '?' + params.toString() : ''}`;
  
  const combinationsQuery = useQuery<{
    availableBusinessSizes?: string[];
    availableIndustryVerticals?: string[];
    selectedBusinessSize?: string;
    selectedIndustryVertical?: string;
    disabledCount?: {
      businessSizes?: number;
      industries?: number;
    };
    totalCombinations?: number;
  }>({
    queryKey: ['/api/filters/combinations', businessSize, industryVertical],
    queryFn: async () => {
      return apiRequest('GET', endpoint);
    },
    enabled: !!(businessSize !== undefined && industryVertical !== undefined), // Only run when filters are provided
  });

  return {
    availableBusinessSizes: combinationsQuery.data?.availableBusinessSizes || [],
    availableIndustryVerticals: combinationsQuery.data?.availableIndustryVerticals || [],
    selectedBusinessSize: combinationsQuery.data?.selectedBusinessSize,
    selectedIndustryVertical: combinationsQuery.data?.selectedIndustryVertical,
    disabledCount: combinationsQuery.data?.disabledCount,
    totalCombinations: combinationsQuery.data?.totalCombinations,
    isLoading: combinationsQuery.isLoading,
  };
}