import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ButtonLoadingSpinner } from '@/components/loading';
import { useEffectivenessInsights } from '@/hooks/useEffectivenessInsights';
import { EffectivenessErrorBoundary } from './EffectivenessErrorBoundary';

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
  
  // Use the new insights hook
  const {
    generateInsights,
    canGenerateInsights,
    isGenerating,
    generateError,
    lastGenerated
  } = useEffectivenessInsights(clientId, runId);
  
  // Use stored insights if available, otherwise use generated insights
  const insights = aiInsights || lastGenerated?.insights;
  const isApiLoading = isGenerating;
  const hasError = generateError;

  if (isApiLoading) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-slate-600">
          <ButtonLoadingSpinner size="sm" />
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
            onClick={() => generateInsights()} 
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
    <EffectivenessErrorBoundary 
      clientName={clientName}
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">AI Insights Unavailable</span>
          </div>
          <p className="text-xs text-red-500">Unable to load AI insights. The analysis data is still available.</p>
        </div>
      }
    >
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
    </EffectivenessErrorBoundary>
  );
}