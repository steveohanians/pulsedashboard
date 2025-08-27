import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';

interface EffectivenessAIInsightsProps {
  clientId: string;
  runId: string;
  clientName: string;
  overallScore: string;
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
  overallScore: string;
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
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-sm">Loading insights...</span>
        </div>
      </div>
    );
  }

  if (error || !insightsData?.success) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unable to load insights</span>
        </div>
      </div>
    );
  }

  const { insights } = insightsData;

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Main Insight - match other metric card text sizes */}
      <div className="text-sm text-gray-700 leading-relaxed">
        <div dangerouslySetInnerHTML={{ 
          __html: insights.insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
        }} />
      </div>

      {/* Recommendations - match other recommendations styling */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Recommended Actions</h4>
          <div className="space-y-1">
            {insights.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="flex-shrink-0 w-4 h-4 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                  {index + 1}
                </span>
                <div 
                  className="flex-1 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rec.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence indicator - smaller and subtle */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
          <span>Analysis confidence: {Math.round(insights.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}