import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AIInsights from "@/components/ai-insights";
import { logger } from "@/utils/logger";

// Persistent insights storage using localStorage with month-based expiration
const INSIGHTS_STORAGE_KEY = 'pulse_dashboard_insights';

interface StoredInsight {
  data: {
    contextText?: string;
    insightText?: string;
    recommendationText?: string;
    status?: 'success' | 'needs_improvement' | 'warning';
  };
  month: string; // Format: "2025-07"
  timestamp: number;
}

const insightsStorage = {
  getCurrentMonth: () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },
  
  getKey: (clientId: string, metricName: string) => `${clientId}-${metricName}`,
  
  save: (clientId: string, metricName: string, insight: StoredInsight['data']) => {
    // Database operations handled by API - no client-side storage needed
    return;
  },
  
  load: async (clientId: string, metricName: string): Promise<StoredInsight['data'] | null> => {
    try {
      // Fetch existing insights from database
      const response = await fetch(`/api/insights/${clientId}`);
      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('Authentication required for loading insights');
          return null;
        }
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }
      
      const data = await response.json();
      const insights = data.insights || data; // Handle both response formats
      
      // Find insight for this specific metric
      const metricInsight = Array.isArray(insights) ? insights.find((insight: any) => 
        insight.metricName === metricName
      ) : null;
      
      if (metricInsight) {
        logger.info('Loaded stored insight from database', {
          clientId,
          metricName,
          hasInsight: !!metricInsight.insight,
          status: metricInsight.status
        });
        
        return {
          contextText: metricInsight.context,
          insightText: metricInsight.insight, 
          recommendationText: metricInsight.recommendation,
          status: metricInsight.status
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to load insights from database', { error: (error as Error).message, clientId, metricName });
      return null;
    }
  },
  
  remove: (clientId: string, metricName: string) => {
    // Database cleanup handled by API - no client-side storage to remove
    return;
  }
};

interface MetricInsightBoxProps {
  metricName: string;
  clientId: string;
  timePeriod: string;
  metricData: {
    metricName: string;
    clientValue: number | null;
    industryAverage: number | null;
    cdAverage: number | null;
    competitorValues: number[];
    competitorNames: string[];
  };
  onStatusChange?: (status?: 'success' | 'needs_improvement' | 'warning') => void;
  preloadedInsight?: any; // Pre-loaded insight to prevent API calls
}

export default function MetricInsightBox({ metricName, clientId, timePeriod, metricData, onStatusChange, preloadedInsight }: MetricInsightBoxProps) {
  const [insight, setInsight] = useState<StoredInsight['data'] & { 
    isTyping?: boolean; 
    isFromStorage?: boolean;
    hasCustomContext?: boolean;
  } | null>(null);
  const queryClient = useQueryClient();
  
  // Load stored insights from database on mount or use preloaded insight
  useEffect(() => {
    const loadStoredInsight = async () => {
      
      // If we have a preloaded insight, use it directly
      if (preloadedInsight) {
        logger.component('MetricInsightBox', `Using preloaded insight for ${metricName}`);
          hasContext: !!preloadedInsight.contextText,
          hasInsight: !!preloadedInsight.insightText,
          hasRecommendation: !!preloadedInsight.recommendationText,
          status: preloadedInsight.status
        });
        setInsight({
          contextText: preloadedInsight.contextText,
          insightText: preloadedInsight.insightText,
          recommendationText: preloadedInsight.recommendationText,
          status: preloadedInsight.status,
          isTyping: false,
          isFromStorage: true
        });
        
        // Report status to parent
        if (preloadedInsight.status && onStatusChange) {
          onStatusChange(preloadedInsight.status);
        }
        return;
      }

      
      // Fallback to loading from database if no preloaded insight
      try {
        const stored = await insightsStorage.load(clientId, metricName);
        if (stored) {
          logger.component('MetricInsightBox', `Loaded stored insight for ${metricName}`);
          setInsight({
            ...stored,
            isTyping: false,
            isFromStorage: true
          });
          
          // Report status to parent
          if (stored.status && onStatusChange) {
            onStatusChange(stored.status);
          }
        }
      } catch (error) {
        logger.error('Failed to load stored insight', { error: (error as Error).message, clientId, metricName });
      }
    };
    
    loadStoredInsight();
  }, [clientId, metricName, onStatusChange, preloadedInsight]);
  
  // Store insight in persistent storage when it changes (without typing state)
  useEffect(() => {
    if (insight && !insight.isFromStorage) {
      // Store without the typing state and storage flag to avoid restart issues
      const { isTyping, isFromStorage, ...insightToStore } = insight;
      insightsStorage.save(clientId, metricName, insightToStore);
    }
  }, [insight, clientId, metricName]);

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
      // Set insight with typing effect enabled
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false });
      onStatusChange?.(data.insight.status);
      // Invalidate insights cache
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    },
    onError: (error) => {
      // Failed to generate insight - error handled by UI
    }
  });

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
      // Set insight with typing effect enabled and mark as having custom context
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false, hasCustomContext: true });
      onStatusChange?.(data.insight.status);
      // Invalidate insights cache
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    },
    onError: (error) => {
      // Fallback to regular regeneration if context generation fails
      generateInsightMutation.mutate();
    }
  });

  // Show loading state during any generation process
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
          // Clear current insight and storage to force fresh generation with typewriter effect
          setInsight(null);
          insightsStorage.remove(clientId, metricName);
          onStatusChange?.(undefined);
          
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
          // Start the mutation first to trigger loading state
          generateInsightWithContextMutation.mutate(userContext);
          
          // Then clear current insight and storage
          setInsight(null);
          insightsStorage.remove(clientId, metricName);
          onStatusChange?.(undefined);
        }}
        onClear={async () => {
          // Clear insight and storage
          setInsight(null);
          insightsStorage.remove(clientId, metricName);
          onStatusChange?.(undefined);
          
          // Also delete the saved context
          try {
            await fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`, {
              method: 'DELETE'
            });
            // Successfully cleared insights and deleted saved context
          } catch (error) {
            // Failed to delete context - handled silently
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