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
    primary_issue?: string;
    root_cause?: string;
    business_impact?: string;
    key_insight?: string;
    quick_wins?: Array<{
      action: string;
      priority: string;
      effort: string;
      expected_impact: string;
      rationale: string;
      timeline: string;
    }>;
    strategic_initiatives?: Array<{
      action: string;
      priority: string;
      effort: string;
      expected_impact: string;
      rationale: string;
      timeline: string;
      roi_potential: string;
    }>;
    interconnected_benefits?: string;
    industry_considerations?: string;
    confidence: number;
    // Fallback fields for backwards compatibility
    insight?: string;
    recommendations?: string[];
    key_pattern?: string;
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
          <span className="text-xs">Loading insights...</span>
        </div>
      </div>
    );
  }

  if (error || !insightsData?.success) {
    return (
      <div className={`flex items-center justify-center py-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">Unable to load insights</span>
        </div>
      </div>
    );
  }

  const { insights } = insightsData;
  
  // Handle both new structured format and legacy format
  const mainInsight = insights.key_insight || insights.insight || '';
  const recommendations = [];
  
  // Combine quick wins and strategic initiatives into recommendations
  if (insights.quick_wins) {
    insights.quick_wins.forEach(item => {
      recommendations.push(`**${item.action}** (${item.priority} priority, ${item.effort} effort) - ${item.expected_impact}`);
    });
  }
  
  if (insights.strategic_initiatives) {
    insights.strategic_initiatives.forEach(item => {
      recommendations.push(`**${item.action}** (${item.priority} priority, ${item.effort} effort, ${item.roi_potential} ROI) - ${item.expected_impact}`);
    });
  }
  
  // Fallback to legacy recommendations format
  if (recommendations.length === 0 && insights.recommendations) {
    recommendations.push(...insights.recommendations);
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Primary Issue */}
      {insights.primary_issue && (
        <div className="text-sm text-slate-600 leading-relaxed">
          <div className="font-medium text-slate-700 mb-1">Primary Issue:</div>
          <div dangerouslySetInnerHTML={{ 
            __html: insights.primary_issue.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') 
          }} />
        </div>
      )}

      {/* Main Insight */}
      <div className="text-sm text-slate-600 leading-relaxed">
        <div dangerouslySetInnerHTML={{ 
          __html: mainInsight.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') 
        }} />
      </div>

      {/* Business Impact */}
      {insights.business_impact && (
        <div className="text-sm text-slate-600 leading-relaxed">
          <div className="font-medium text-slate-700 mb-1">Business Impact:</div>
          <div dangerouslySetInnerHTML={{ 
            __html: insights.business_impact.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') 
          }} />
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="font-medium text-slate-700 text-sm">Recommended Actions:</div>
          {recommendations.map((rec, index) => (
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

      {/* Industry Considerations */}
      {insights.industry_considerations && (
        <div className="text-sm text-slate-600 leading-relaxed">
          <div className="font-medium text-slate-700 mb-1">Industry Considerations:</div>
          <div dangerouslySetInnerHTML={{ 
            __html: insights.industry_considerations.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-slate-800">$1</span>') 
          }} />
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