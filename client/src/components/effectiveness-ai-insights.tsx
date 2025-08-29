import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface EffectivenessAIInsightsProps {
  clientId: string;
  runId: string;
  clientName: string;
  overallScore: number;
  className?: string;
  // New props to support stored insights
  aiInsights?: {
    insight: string;
    recommendations: string[];
    confidence: number;
    key_pattern: string;
  } | null;
  insightsGeneratedAt?: string | null;
}

interface InsightsResponse {
  success: boolean;
  insights: {
    insight: string;
    recommendations: string[];
    confidence: number;
    key_pattern: string;
  };
  clientName: string;
  overallScore: number;
  runId: string;
  cached?: boolean;
}

export function EffectivenessAIInsights({
  clientId,
  runId,
  clientName,
  overallScore,
  className,
  aiInsights,
  insightsGeneratedAt
}: EffectivenessAIInsightsProps) {
  // Only fetch insights if not provided (fallback for missing/failed insights)
  const shouldFetchInsights = !aiInsights;
  
  const { data: insightsData, isLoading, error, refetch } = useQuery<InsightsResponse>({
    queryKey: ['effectiveness-insights', clientId, runId],
    queryFn: async () => {
      const response = await fetch(`/api/effectiveness/insights/${clientId}/${runId}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }
      
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    enabled: shouldFetchInsights // Only run query if no insights provided
  });

  // Use stored insights if available, otherwise use API data
  const insights = aiInsights || insightsData?.insights;
  const isApiLoading = shouldFetchInsights && isLoading;
  const hasError = shouldFetchInsights && (error || !insightsData?.success);

  if (isApiLoading) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-xs">Loading insights...</span>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">Unable to load insights</span>
          <button 
            onClick={() => refetch()} 
            className="ml-2 p-1 hover:bg-red-50 rounded"
            title="Retry"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // No insights available
  if (!insights) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">No insights available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Main Insight - match AI insights font size */}
      <div className="text-sm text-slate-600 leading-relaxed">
        <div dangerouslySetInnerHTML={{ 
          __html: insights.insight.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') 
        }} />
      </div>

      {/* Recommendations - match AI insights style exactly */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div className="space-y-3">
          {insights.recommendations.map((rec, index) => (
            <div key={index} className="text-sm text-slate-600 flex items-start gap-1">
              <span className="text-primary font-medium mt-0.5">{index + 1}.</span>
              <div 
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: rec.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Confidence indicator - match AI insights style */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">AI Confidence</span>
          <span className="text-xs font-medium text-slate-600">
            {Math.round(insights.confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}