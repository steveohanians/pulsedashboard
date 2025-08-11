import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    (InsightData & { isTyping?: boolean; isFromStorage?: boolean; hasCustomContext?: boolean }) | null
  >(null);
  const queryClient = useQueryClient();

  // Memoize the display month label for consistency
  const dataMonthLabel = useMemo(() => {
    const now = new Date();
    const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dataMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, []);

  useEffect(() => {
    const loadStoredInsight = async () => {
      if (preloadedInsight) {
        logger.component("MetricInsightBox", `Using preloaded insight for ${metricName}`);
        setInsight({
          contextText: preloadedInsight.contextText,
          insightText: preloadedInsight.insightText,
          recommendationText: preloadedInsight.recommendationText,
          status: preloadedInsight.status,
          isTyping: false,
          isFromStorage: true,
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

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/generate-metric-insight/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricName, timePeriod, metricData }),
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
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false });
      onStatusChange?.(data.insight.status);
      queryClient.invalidateQueries({ queryKey: QueryKeys.aiInsights(clientId, timePeriod) });
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
        body: JSON.stringify({ metricName, timePeriod, metricData, userContext }),
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
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false, hasCustomContext: true });
      onStatusChange?.(data.insight.status);
      queryClient.invalidateQueries({ queryKey: QueryKeys.aiInsights(clientId, timePeriod) });
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

  if (generateInsightMutation.isPending || generateInsightWithContextMutation.isPending) {
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
        context={insight.contextText || ""}
        insight={insight.insightText || ""}
        recommendation={insight.recommendationText || ""}
        status={insight.status}
        isTyping={insight.isTyping}
        hasCustomContext={insight.hasCustomContext || false}
        clientId={clientId}
        metricName={metricName}
        timePeriod={timePeriod}
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
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          generateInsightWithContextMutation.mutate(userContext);
        }}
        onClear={async () => {
          setInsight(null);
          onStatusChange?.(undefined);
          try {
            await Promise.all([
              fetch(`/api/insights/${clientId}/${encodeURIComponent(metricName)}`, {
                method: "DELETE",
              }),
              fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`, {
                method: "DELETE",
              }),
            ]);
            queryClient.invalidateQueries({ queryKey: QueryKeys.aiInsights(clientId, timePeriod) });
            logger.component("MetricInsightBox", "Successfully deleted insight and context");
          } catch (error) {
            logger.warn("Failed to delete insight or context", { error });
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
