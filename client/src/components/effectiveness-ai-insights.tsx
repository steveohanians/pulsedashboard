import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface EffectivenessAIInsightsProps {
  clientId: string;
  runId: string;
  clientName: string;
  overallScore: number;
  className?: string;
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
}

export function EffectivenessAIInsights({
  clientId,
  runId,
  clientName,
  overallScore,
  className
}: EffectivenessAIInsightsProps) {
  // Fetch AI insights
  const { data: insightsData, isLoading, error } = useQuery<InsightsResponse>({
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
    staleTime: 30 * 60 * 1000, // 30 minutes - insights don't change often
    retry: 1 // Only retry once for AI insights
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-4 ${className || ''}`}>
        <div className="flex items-center gap-2 text-slate-600">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Generating AI insights...</span>
        </div>
      </div>
    );
  }

  if (error || !insightsData?.success) {
    // Fallback to generic summary if AI insights fail
    return (
      <div className={`space-y-3 ${className || ''}`}>
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">AI insights temporarily unavailable</span>
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-1">Performance Summary</h4>
          <p className="text-xs text-slate-600">
            Your website scored {overallScore}/10 overall. Review the detailed analysis below for specific recommendations.
          </p>
        </div>
      </div>
    );
  }

  const { insights } = insightsData;

  return (
    <div className={`space-y-3 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-medium text-blue-700">AI-Powered Insight</span>
      </div>
      
      <div>
        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
          {insights.insight}
        </p>
      </div>
      
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-medium text-slate-700 mb-2">Key Actions:</h4>
          <div className="space-y-1">
            {insights.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-600 flex items-start gap-1">
                <span className="text-primary font-medium mt-0.5">{index + 1}.</span>
                <span className="flex-1">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {insights.confidence && (
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">AI Confidence</span>
            <span className="text-xs font-medium text-slate-600">
              {Math.round(insights.confidence * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}