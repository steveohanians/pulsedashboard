import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Zap } from 'lucide-react';

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
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-sm font-medium">Generating insights...</span>
        </div>
      </div>
    );
  }

  if (error || !insightsData?.success) {
    return (
      <div className={`flex items-center justify-center py-4 ${className || ''}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unable to load insights</span>
        </div>
      </div>
    );
  }

  const { insights } = insightsData;

  return (
    <div className={`bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-gray-900" />
          <h3 className="text-lg font-semibold text-gray-900">
            Pulse AI Insights for {clientName}
          </h3>
        </div>
      </div>

      {/* Main Insight */}
      <div className="mb-6">
        <div 
          className="text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: insights.insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>

      {/* Recommendations */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">Recommended Actions</h4>
        <div className="space-y-3">
          {insights.recommendations.map((rec, index) => (
            <div key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                {index + 1}
              </span>
              <div 
                className="text-gray-700 text-sm leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: rec.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span>Analysis Confidence: {Math.round(insights.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}