import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AIInsights } from "@/components/ai-insights";
import { logger } from "@/utils/logger";

/** AI-generated insight data structure with performance status */
interface InsightData {
  /** Contextual information about the metric */
  contextText?: string;
  /** AI-generated insight analysis */
  insightText?: string;
  /** Actionable recommendations */
  recommendationText?: string;
  /** Performance status indicator */
  status?: 'success' | 'needs_improvement' | 'warning';
}

/** Metric data structure for competitive analysis */
interface MetricData {
  /** Name of the metric being analyzed */
  metricName: string;
  /** Client's current metric value */
  clientValue: number | null;
  /** Industry benchmark average */
  industryAverage: number | null;
  /** Clear Digital portfolio average */
  cdAverage: number | null;
  /** Array of competitor metric values */
  competitorValues: number[];
  /** Array of competitor names for context */
  competitorNames: string[];
}

interface MetricInsightBoxProps {
  /** Name of the metric for insight generation */
  metricName: string;
  /** Client identifier for targeted analysis */
  clientId: string;
  /** Time period for metric analysis */
  timePeriod: string;
  /** Comprehensive metric data for AI analysis */
  metricData: MetricData;
  /** Optional callback for status change notifications */
  onStatusChange?: (status?: 'success' | 'needs_improvement' | 'warning') => void;
  /** Pre-loaded insight to prevent redundant API calls */
  preloadedInsight?: InsightData;
}

/**
 * Advanced metric insight box component with AI-powered analysis and recommendations.
 * Integrates with AI insight generation system, handles preloaded insights for performance,
 * manages mutation states, and provides interactive insight generation with visual feedback.
 * 
 * Key features:
 * - AI-powered competitive metric analysis
 * - Preloaded insight support for performance optimization
 * - Interactive insight generation with loading states
 * - Performance status classification (success/needs_improvement/warning)
 * - TanStack Query integration for cache management
 * - Typewriter animation for engaging user experience
 * - Comprehensive error handling with fallback states
 * - Status change notifications to parent components
 * - Database persistence for generated insights
 * 
 * The component prioritizes preloaded insights to minimize API calls and improve
 * dashboard load times, falling back to on-demand generation when needed.
 * 
 * @param metricName - Metric identifier for insight targeting
 * @param clientId - Client context for personalized analysis
 * @param timePeriod - Temporal context for metric analysis
 * @param metricData - Complete metric dataset for AI processing
 * @param onStatusChange - Optional callback for parent status updates
 * @param preloadedInsight - Performance optimization with cached insights
 */
export function MetricInsightBox({ metricName, clientId, timePeriod, metricData, onStatusChange, preloadedInsight }: MetricInsightBoxProps) {
  /** Enhanced insight state with typing animation and storage metadata */
  const [insight, setInsight] = useState<InsightData & { 
    isTyping?: boolean; 
    isFromStorage?: boolean;
    hasCustomContext?: boolean;
  } | null>(null);
  const queryClient = useQueryClient();
  
  /**
   * Effect hook for loading stored insights with preloaded optimization.
   * Prioritizes preloaded insights to minimize API calls and improve performance.
   * Handles status reporting to parent components for dashboard coordination.
   * Responds to preloadedInsight changes to reset component when insights are cleared.
   */
  useEffect(() => {
    const loadStoredInsight = async () => {
      // Check if preloadedInsight was cleared (null/undefined)
      if (!preloadedInsight) {
        logger.component('MetricInsightBox', `No preloaded insight for ${metricName} - resetting to generate state`);
        setInsight(null);
        if (onStatusChange) {
          onStatusChange(undefined);
        }
        return;
      }

      // Use preloaded insights for performance optimization
      logger.component('MetricInsightBox', `Using preloaded insight for ${metricName}`);

      setInsight({
        contextText: preloadedInsight.contextText,
        insightText: preloadedInsight.insightText,
        recommendationText: preloadedInsight.recommendationText,
        status: preloadedInsight.status,
        isTyping: false,
        isFromStorage: true
      });
      
      // Notify parent component of performance status for dashboard coordination
      if (preloadedInsight.status && onStatusChange) {
        onStatusChange(preloadedInsight.status);
      }
    };
    
    loadStoredInsight();
  }, [clientId, metricName, onStatusChange, preloadedInsight]);

  /**
   * TanStack Query mutation for on-demand AI insight generation.
   * Integrates with backend AI processing pipeline and handles comprehensive
   * error states, loading management, and cache invalidation.
   */
  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/generate-metric-insight/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metricName,
          timePeriod,
          metricData
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Enable typing animation for engaging user experience
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false });
      onStatusChange?.(data.insight.status);
      
      // Delay cache invalidation until after typewriter effect completes (~4 seconds)
      setTimeout(() => {
        queryClient.removeQueries({ queryKey: [`/api/insights/${clientId}`] });
        queryClient.invalidateQueries({ 
          queryKey: [`/api/insights/${clientId}`],
          refetchType: 'active'
        });
        logger.component('MetricInsightBox', `Cache invalidated after typewriter effect for ${metricName}`);
      }, 4500);
      
      logger.component('MetricInsightBox', `Generated insight for ${metricName}, typewriter effect enabled`);
    },
    onError: (error) => {
      // Graceful error handling without breaking user experience
      logger.warn('Failed to generate insight', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId,
        metricName
      });
    }
  });

  /**
   * Advanced mutation for context-aware insight generation.
   * Allows users to provide additional business context for more targeted
   * AI analysis. Includes automatic fallback to standard generation on failure.
   */
  const generateInsightWithContextMutation = useMutation({
    mutationFn: async (userContext: string) => {
      const response = await fetch(`/api/generate-metric-insight-with-context/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metricName,
          timePeriod,
          metricData,
          userContext
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Mark context-enhanced insights with special metadata
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false, hasCustomContext: true });
      onStatusChange?.(data.insight.status);
      
      // Delay cache invalidation until after typewriter effect completes (~4 seconds)
      setTimeout(() => {
        queryClient.removeQueries({ queryKey: [`/api/insights/${clientId}`] });
        queryClient.invalidateQueries({ 
          queryKey: [`/api/insights/${clientId}`],
          refetchType: 'active'
        });
        logger.component('MetricInsightBox', `Cache invalidated after typewriter effect for ${metricName} with context`);
      }, 4500);
      
      logger.component('MetricInsightBox', `Generated insight with context for ${metricName}, typewriter effect enabled`);
    },
    onError: (error) => {
      // Comprehensive error handling with intelligent fallback system
      logger.warn('Failed to generate insight with context', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        clientId,
        metricName
      });
      
      // Automatic fallback to standard generation for robust user experience
      try {
        generateInsightMutation.mutate();
      } catch (fallbackError) {
        logger.warn('Fallback insight generation also failed', {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error',
          clientId,
          metricName
        });
      }
    }
  });

  /** Render loading state during any active insight generation process */
  if (generateInsightMutation.isPending || generateInsightWithContextMutation.isPending) {
    return (
      <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
            Get strategic competitive intelligence and actionable recommendations for <span className="font-medium text-primary">{metricName}</span> for {(() => {
              const now = new Date();
              const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              return dataMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            })()}
          </p>
          <Button 
            disabled={true}
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-medium px-6 py-2.5"
            size="sm"
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Insights...
          </Button>
          <p className="text-xs text-slate-500 mt-3 animate-pulse">
            Analyzing competitive data and market trends...
          </p>
        </div>
      </div>
    );
  }

  if (insight) {
    return (
      <AIInsights
        context={insight.contextText || ''}
        insight={insight.insightText || ''}
        recommendation={insight.recommendationText || ''}
        status={insight.status}
        isTyping={insight.isTyping}
        hasCustomContext={insight.hasCustomContext || false}
        clientId={clientId}
        metricName={metricName}
        timePeriod={timePeriod}
        metricData={metricData}
        onRegenerate={async () => {
          logger.component('MetricInsightBox', 'Regenerate clicked - checking for existing context');
          
          // Check if there's existing context and use it for regeneration
          try {
            const contextResponse = await fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`);
            if (contextResponse.ok) {
              const contextData = await contextResponse.json();
              const existingContext = contextData.userContext?.trim();
              
              if (existingContext) {
                logger.component('MetricInsightBox', 'Found existing context, regenerating with context');
                generateInsightWithContextMutation.mutate(existingContext);
                return;
              }
            }
          } catch (error) {
            // No existing context found, proceeding with regular regeneration
          }
          
          // No context found, proceed with regular regeneration
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          // Start the mutation to trigger loading state and regenerate with context
          generateInsightWithContextMutation.mutate(userContext);
        }}
        onClear={async () => {
          // Clear insight state immediately for responsive UI
          setInsight(null);
          onStatusChange?.(undefined);
          
          // Delete from database and clear saved context
          try {
            await Promise.all([
              fetch(`/api/insights/${clientId}/${encodeURIComponent(metricName)}`, {
                method: 'DELETE'
              }),
              fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`, {
                method: 'DELETE'
              })
            ]);
            // Invalidate cache to ensure fresh data with correct key pattern
            queryClient.invalidateQueries({ queryKey: [`/api/insights/${clientId}`] });
            queryClient.invalidateQueries({ queryKey: ['/api/insights'] }); // Legacy key
            logger.component('MetricInsightBox', 'Successfully deleted insight and context');
          } catch (error) {
            logger.warn('Failed to delete insight or context', { error });
          }
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
          Get strategic competitive intelligence and actionable recommendations for <span className="font-medium text-primary">{metricName}</span> for {(() => {
            const now = new Date();
            const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return dataMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          })()}
        </p>
        <Button 
          onClick={() => generateInsightMutation.mutate()}
          disabled={generateInsightMutation.isPending}
          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-medium px-6 py-2.5"
          size="sm"
        >
          {generateInsightMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Insights...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Insights
            </>
          )}
        </Button>
        
        {generateInsightMutation.isPending && (
          <p className="text-xs text-slate-500 mt-3 animate-pulse">
            Analyzing competitive data and market trends...
          </p>
        )}
      </div>
    </div>
  );
}