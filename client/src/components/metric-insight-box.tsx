import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAIInsights } from "@/hooks/use-ai-insights";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AIInsights } from "@/components/ai-insights";
import { logger } from "@/utils/logger";
import { QueryKeys } from "@/lib/queryKeys";

/** AI-generated insight data structure with performance status */
interface InsightData {
  contextText?: string;
  insightText?: string;
  recommendationText?: string;
  status?: "success" | "needs_improvement" | "warning";
  hasContext?: boolean; // Server-computed badge state
}

/** Metric data structure for competitive analysis */
interface MetricData {
  metricName: string;
  clientValue: number | null;
  industryAverage: number | null;
  cdAverage: number | null;
  competitorValues: number[];
  competitorNames: string[];
}

interface MetricInsightBoxProps {
  metricName: string;
  clientId: string;
  timePeriod: string;
  metricData: MetricData;
  onStatusChange?: (status?: "success" | "needs_improvement" | "warning") => void;
  preloadedInsight?: InsightData;
}

export function MetricInsightBox({
  metricName,
  clientId,
  timePeriod,
  metricData,
  onStatusChange,
  preloadedInsight,
}: MetricInsightBoxProps) {
  const [insight, setInsight] = useState<
    (InsightData & { isTyping?: boolean; isFromStorage?: boolean; hasContext?: boolean }) | null
  >(null);
  const queryClient = useQueryClient();

  // Normalize time period to canonical YYYY-MM format
  const canonicalPeriod = useMemo(() => {
    // Convert to canonical YYYY-MM format for database consistency
    const convertToCanonical = (period: string): string => {
      // Already in YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(period)) {
        return period;
      }
      
      // Convert "Last Month" and other legacy formats
      if (period === "Last Month" || period === "last_month" || !period) {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      }
      
      // Handle other period formats if needed
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    };
    
    return convertToCanonical(timePeriod);
  }, [timePeriod]);

  // Memoize the display month label for consistency
  const dataMonthLabel = useMemo(() => {
    const now = new Date();
    const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dataMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, []);

  // Database-based insights query using centralized hook
  const { data: insightsData, isLoading: isLoadingInsights, isFetching, error } = useAIInsights(clientId, canonicalPeriod);

  // Find this metric's insight from the database response
  const metricInsight = useMemo(() => {
    if (!insightsData?.insights) return null;
    return insightsData.insights.find((insight: any) => insight.metricName === metricName) || null;
  }, [insightsData, metricName]);

  // Fix spinner logic - only show when actually generating
  const isGenerating = insightsData?.status === "generating" || 
                      metricInsight?.status === "generating";
                      
  console.info("[AI] MetricInsightBox render", {
    metricName,
    isLoading: isLoadingInsights, 
    isFetching, 
    isGenerating, 
    hasData: !!insightsData,
    hasMetricInsight: !!metricInsight,
    status: insightsData?.status
  });

  useEffect(() => {
    const loadStoredInsight = async () => {
      if (preloadedInsight) {
        logger.component("MetricInsightBox", `Using preloaded insight for ${metricName}`);
        
        // Use strict boolean check for server-computed hasContext field only
        
        setInsight({
          contextText: preloadedInsight.contextText,
          insightText: preloadedInsight.insightText,
          recommendationText: preloadedInsight.recommendationText,
          status: preloadedInsight.status,
          isTyping: false,
          isFromStorage: false, // was true
          hasContext: !!preloadedInsight.contextText?.trim(), // Badge based on actual context text presence
        });
        if (preloadedInsight.status && onStatusChange) {
          onStatusChange(preloadedInsight.status);
        }
        return;
      }
      logger.component(
        "MetricInsightBox",
        `No preloaded insight available for ${metricName} - will show generate button`
      );
    };

    loadStoredInsight();
  }, [clientId, metricName, onStatusChange, preloadedInsight]);

  // Update local state when fresh data arrives from the hook
  useEffect(() => {
    if (metricInsight) {
      setInsight({
        contextText: metricInsight.contextText,
        insightText: metricInsight.insightText,
        recommendationText: metricInsight.recommendationText,
        status: metricInsight.status,
        isTyping: false,
        // treat as server data; no blocking flag
        isFromStorage: false,
        hasContext: !!metricInsight.contextText?.trim(),
      });
      if (metricInsight.status && onStatusChange) {
        onStatusChange(metricInsight.status);
      }
    }
  }, [metricInsight, onStatusChange]);

  // Use the centralized insights hook
  const canonicalInsights = insightsData;
  
  // Extract status information from centralized data
  const versionStatus = useMemo(() => {
    if (!canonicalInsights) return null;
    return {
      status: canonicalInsights.status || 'available',
      isGenerating: canonicalInsights.status === 'generating' || canonicalInsights.status === 'pending'
    };
  }, [canonicalInsights]);
  
  const isCheckingVersion = isLoadingInsights;

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/generate-metric-insight/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricName, timePeriod: canonicalPeriod, metricData }),
      });
      if (!response.ok) {
        let detail = "";
        try {
          detail = await response.text();
        } catch {}
        throw new Error(`HTTP ${response.status} ${detail}`.trim());
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false, hasContext: false });
      onStatusChange?.(data.insight.status);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
    },
    onError: (error) => {
      logger.warn("Failed to generate insight", {
        error: error instanceof Error ? error.message : "Unknown error",
        clientId,
        metricName,
      });
    },
  });

  const generateInsightWithContextMutation = useMutation({
    mutationFn: async (userContext: string) => {
      const response = await fetch(`/api/generate-metric-insight-with-context/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricName, timePeriod: canonicalPeriod, metricData, userContext }),
      });
      if (!response.ok) {
        let detail = "";
        try {
          detail = await response.text();
        } catch {}
        throw new Error(`HTTP ${response.status} ${detail}`.trim());
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false, hasContext: true });
      onStatusChange?.(data.insight.status);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
    },
    onError: (error) => {
      logger.warn("Failed to generate insight with context", {
        error: error instanceof Error ? error.message : "Unknown error",
        clientId,
        metricName,
      });
      try {
        generateInsightMutation.mutate();
      } catch (fallbackError) {
        logger.warn("Fallback insight generation also failed", {
          error: fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
          clientId,
          metricName,
        });
      }
    },
  });

  // Treat both 'generating' and 'pending' as regenerating
  const isRegenerating = versionStatus?.isGenerating === true;

  // Use canonical insights if available, otherwise fall back to preloaded insight
  useEffect(() => {
    if (canonicalInsights?.status === 'available' && canonicalInsights.insights) {
      const matchingInsight = canonicalInsights.insights.find(
        (insight: any) => insight.metricName === metricName
      );
      
      if (matchingInsight) {
        logger.component("MetricInsightBox", `Using canonical insight for ${metricName}`);
        setInsight({
          contextText: matchingInsight.contextText,
          insightText: matchingInsight.insightText,
          recommendationText: matchingInsight.recommendationText,
          status: matchingInsight.status,
          isTyping: false,
          isFromStorage: false, // was true
          hasContext: !!matchingInsight.contextText?.trim(), // Badge based on actual context text presence
        });
        if (matchingInsight.status && onStatusChange) {
          onStatusChange(matchingInsight.status);
        }
      }
    }
  }, [canonicalInsights, metricName, onStatusChange]);
  
  // NEW: show loading while the initial query is in-flight
  if (isLoadingInsights || isFetching || insightsData?.status === 'pending') {
    return (
      <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
            Loading insights for <span className="font-medium text-primary">{metricName}</span>…
          </p>
          <Button disabled size="sm" className="bg-gradient-to-r from-primary to-primary/90 text-white font-medium px-6 py-2.5">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading…
          </Button>
        </div>
      </div>
    );
  }

  // Show loading only when mutation is pending or actually generating
  if (generateInsightMutation.isPending || generateInsightWithContextMutation.isPending || isRegenerating) {
    return (
      <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
            Get strategic competitive intelligence and actionable recommendations for{" "}
            <span className="font-medium text-primary">{metricName}</span> for {dataMonthLabel}
          </p>
          <Button
            disabled={true}
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-medium px-6 py-2.5"
            size="sm"
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isRegenerating ? "Regenerating Insights..." : "Generating Insights..."}
          </Button>
          <p className="text-xs text-slate-500 mt-3 animate-pulse">
            {isRegenerating ? "Updating insights with latest data..." : "Analyzing competitive data and market trends..."}
          </p>
        </div>
      </div>
    );
  }

  if (insight) {
    return (
      <AIInsights
        context={insight.contextText || ""}
        insight={insight.insightText || ""}
        recommendation={insight.recommendationText || ""}
        status={insight.status}
        isTyping={insight.isTyping}
        hasCustomContext={insight.hasContext === true}
        clientId={clientId}
        metricName={metricName}
        timePeriod={canonicalPeriod}
        metricData={metricData}
        onRegenerate={async () => {
          logger.component("MetricInsightBox", "Regenerate clicked - checking for existing context");
          try {
            const contextResponse = await fetch(
              `/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`
            );
            if (contextResponse.ok) {
              const contextData = await contextResponse.json();
              const existingContext = contextData.userContext?.trim();
              if (existingContext) {
                logger.component("MetricInsightBox", "Found existing context, regenerating with context");
                generateInsightWithContextMutation.mutate(existingContext);
                return;
              }
            }
          } catch {}
          // Clear hasContext if no context exists when regenerating
          setInsight(current => current ? { ...current, hasContext: false } : current);
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          generateInsightWithContextMutation.mutate(userContext);
        }}
        onClear={async () => {
          setInsight(null);
          onStatusChange?.(undefined);
          try {
            // SINGLE TRANSACTIONAL DELETE - as per specification requirement
            const response = await fetch(`/api/ai-insights/${clientId}/${encodeURIComponent(metricName)}?period=${encodeURIComponent(canonicalPeriod)}`, {
              method: "DELETE",
            });
            
            if (!response.ok) {
              throw new Error("Failed to delete insight and context");
            }
            
            const result = await response.json();
            
            // Invalidate centralized query keys with canonical period
            queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
            queryClient.invalidateQueries({ queryKey: QueryKeys.insightContext(clientId, metricName) });
            
            logger.component("MetricInsightBox", "Single transactional delete completed successfully");
          } catch (error) {
            logger.warn("Failed to delete insight and context via transactional operation", { error });
          }
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
          Get strategic competitive intelligence and actionable recommendations for{" "}
          <span className="font-medium text-primary">{metricName}</span> for {dataMonthLabel}
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
            <>Generate AI Insights</>
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
