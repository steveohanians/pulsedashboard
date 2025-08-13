import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAIInsights } from "@/hooks/use-ai-insights";
import { useGA4Status } from "@/hooks/useGA4Status";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AIInsights } from "@/components/ai-insights";
import { logger } from "@/utils/logger";
import { QueryKeys } from "@/lib/queryKeys";



interface InsightData {
  contextText?: string;
  insightText?: string;
  recommendationText?: string;
  status?: "success" | "needs_improvement" | "warning";
  hasContext?: boolean;
}

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
  onStatusChange?: (
    status?: "success" | "needs_improvement" | "warning",
  ) => void;
  preloadedInsight?: InsightData;
}

export const MetricInsightBox = React.memo(function MetricInsightBox({
  metricName,
  clientId,
  timePeriod,
  metricData,
  onStatusChange,
  preloadedInsight,
}: MetricInsightBoxProps) {
  const [insight, setInsight] = useState<
    | (InsightData & {
        isTyping?: boolean;
        isFromStorage?: boolean;
        hasContext?: boolean;
      })
    | null
  >(null);
  const [forcedEmpty, setForcedEmpty] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const shouldAnimateRef = useRef(false);
  const queryClient = useQueryClient();

  // Guards / flags
  const suppressHydrationRef = useRef(false);

  // Container ref
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Confirmed delete flag (set only after DELETE + refetch)
  const deleteConfirmRef = useRef(false);

  // Tombstone pattern: track deleted items to prevent flashback
  const deletedRef = useRef<string | null>(null);

  // Canonical YYYY-MM
  const canonicalPeriod = useMemo(() => {
    const convertToCanonical = (period: string): string => {
      if (/^\d{4}-\d{2}$/.test(period)) return period;
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    };
    return convertToCanonical(timePeriod);
  }, [timePeriod]);

  // Use GA4 Status hook to prevent 404 polling storm
  const ga4 = useGA4Status(clientId, canonicalPeriod, true);



  const monthLabel = useMemo(() => {
    const now = new Date();
    const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dataMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);



  // Query
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    isFetching,
    error,
  } = useAIInsights(clientId, canonicalPeriod);

  const metricInsight = useMemo(() => {
    if (!insightsData?.insights) return null;
    return (
      insightsData.insights.find((ins: any) => ins.metricName === metricName) ||
      null
    );
  }, [insightsData, metricName]);

  const isGenerating =
    insightsData?.status === "generating" ||
    metricInsight?.status === "generating";

  // Create stable keys for preloaded insight to prevent infinite loops
  const preloadedInsightKey = useMemo(() => {
    if (!preloadedInsight) return null;
    return `${preloadedInsight.contextText || ''}:${preloadedInsight.insightText || ''}:${preloadedInsight.status || ''}:${preloadedInsight.hasContext || false}`;
  }, [preloadedInsight]);

  // Preload (props) when allowed
  useEffect(() => {
    if (suppressHydrationRef.current || forcedEmpty) return;
    if (deletedRef.current === metricName) return;
    if (!metricInsight) return; // prevent repopulating from stale props
    if (!preloadedInsight) return;

    setInsight({
      contextText: preloadedInsight.contextText,
      insightText: preloadedInsight.insightText,
      recommendationText: preloadedInsight.recommendationText,
      status: preloadedInsight.status,
      isTyping: false,
      isFromStorage: false,
      hasContext: preloadedInsight?.hasContext === true,
    });
    if (preloadedInsight.status && onStatusChange)
      onStatusChange(preloadedInsight.status);
  }, [
    clientId,
    metricName,
    preloadedInsightKey,
    forcedEmpty,
  ]);

  // Create stable key for metric insight to prevent infinite loops
  const metricInsightKey = useMemo(() => {
    if (!metricInsight) return null;
    return `${metricInsight.contextText || ''}:${metricInsight.insightText || ''}:${metricInsight.status || ''}:${metricInsight.hasContext || false}`;
  }, [metricInsight]);

  // Hydrate from server when allowed
  useEffect(() => {
    if (suppressHydrationRef.current || forcedEmpty) return;
    if (deletedRef.current === metricName) return;
    if (!metricInsight) return;

    setInsight({
      contextText: metricInsight.contextText,
      insightText: metricInsight.insightText,
      recommendationText: metricInsight.recommendationText,
      status: metricInsight.status,
      isTyping: false,
      isFromStorage: false,
      hasContext: metricInsight?.hasContext === true,
    });
    if (metricInsight.status && onStatusChange)
      onStatusChange(metricInsight.status);
  }, [metricInsightKey, forcedEmpty]);

  // Define renderInsight early so it can be used in shouldShowEmpty
  const renderInsight = insight ?? metricInsight;

  // Typewriter effect for insight text
  useEffect(() => {
    if (!renderInsight?.insightText) return;

    if (!shouldAnimateRef.current) {
      setDisplayedText(renderInsight.insightText);
      return;
    }

    let i = 0;
    const text = renderInsight.insightText;
    setDisplayedText("");
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text[i]);
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        shouldAnimateRef.current = false;
      }
    }, 20); // adjust typing speed if needed

    return () => clearInterval(timer);
  }, [renderInsight?.insightText]);

  const shouldShowEmpty =
    forcedEmpty ||
    deletedRef.current === metricName ||
    (!isLoadingInsights &&
      !isFetching &&
      !metricInsight?.insightText &&
      !renderInsight?.insightText);

  // Release delete lock only after confirmed + no fetch + item gone
  useEffect(() => {
    if (deleteConfirmRef.current && !isFetching && !metricInsight) {
      deleteConfirmRef.current = false;
      suppressHydrationRef.current = false;
      setForcedEmpty(false);
      setInsight(null);
      // Don't clear tombstone here - let it persist to prevent any flashback
    }

    // Clear tombstone only when truly empty
    if (deletedRef.current === metricName && !isFetching && !metricInsight && !preloadedInsight) {
      deletedRef.current = null;
    }
  }, [metricInsight, isFetching, metricName, preloadedInsight]);

  const versionStatus = useMemo(() => {
    if (!insightsData) return null;
    return {
      status: insightsData.status || "available",
      isGenerating:
        insightsData.status === "generating" ||
        insightsData.status === "pending",
    };
  }, [insightsData]);

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/generate-metric-insight/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricName,
          timePeriod: canonicalPeriod,
          metricData,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    },
    onSuccess: async (metricInsightFromServer) => {
      suppressHydrationRef.current = false; // Allow hydration after generate
      // Set insight state immediately for instant display
      setInsight(metricInsightFromServer);
      await queryClient.invalidateQueries({
        queryKey: ["/api/ai-insights", clientId, canonicalPeriod],
      });
    },
    onError: (error) => {
      suppressHydrationRef.current = false;
      logger.warn("Failed to generate insight", {
        error,
        clientId,
        metricName,
      });
    },
  });

  const generateInsightWithContextMutation = useMutation({
    mutationFn: async (userContext: string) => {
      const response = await fetch(
        `/api/generate-metric-insight-with-context/${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metricName,
            timePeriod: canonicalPeriod,
            metricData,
            userContext,
          }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    },
    onSuccess: async (metricInsightFromServer) => {
      suppressHydrationRef.current = false; // Allow hydration after generate
      // Set insight state immediately for instant display
      setInsight(metricInsightFromServer);
      await queryClient.invalidateQueries({
        queryKey: ["/api/ai-insights", clientId, canonicalPeriod],
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.insightContext(
          clientId,
          metricName,
          canonicalPeriod,
        ),
      });
    },
    onError: (error) => {
      suppressHydrationRef.current = false;
      logger.warn("Failed to generate insight with context", {
        error,
        clientId,
        metricName,
      });
      try {
        shouldAnimateRef.current = true;
        generateInsightMutation.mutate();
      } catch {}
    },
  });

  const [manualBusy, setIsBusy] = useState(false);
  
  const isBusy =
    manualBusy ||
    isLoadingInsights ||
    isFetching ||
    insightsData?.status === "pending" ||
    generateInsightMutation.isPending ||
    generateInsightWithContextMutation.isPending ||
    versionStatus?.isGenerating;

  if (isBusy) {
    return (
      <div ref={containerRef} className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
            {generateInsightMutation.isPending ||
            generateInsightWithContextMutation.isPending ||
            versionStatus?.isGenerating ? (
              <>
                Get strategic competitive intelligence and actionable
                recommendations for{" "}
                <span className="font-medium text-primary">{metricName}</span>{" "}
                for {monthLabel}
              </>
            ) : (
              <>
                Loading insights for{" "}
                <span className="font-medium text-primary">{metricName}</span>…
              </>
            )}
          </p>
          <Button
            disabled
            size="sm"
            className="bg-gradient-to-r from-primary to-primary/90 text-white font-medium px-6 py-2.5"
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {generateInsightMutation.isPending ||
            generateInsightWithContextMutation.isPending ||
            versionStatus?.isGenerating
              ? "Generating Insights..."
              : "Loading..."}
          </Button>
        </div>
      </div>
    );
  }

  // TOMBSTONE PATTERN: ABSOLUTE FIRST CHECK - Completely block any content when deleted
  if (deletedRef.current === metricName) {
    return (
      <div ref={containerRef} className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
            Get strategic competitive intelligence and actionable recommendations
            for <span className="font-medium text-primary">{metricName}</span> for{" "}
            {monthLabel}
          </p>
          <Button
            onClick={() => {
              shouldAnimateRef.current = true;
              suppressHydrationRef.current = true;
              setForcedEmpty(false);
              deletedRef.current = null; // Clear tombstone when user wants to generate new
              setInsight((cur) =>
                cur ? { ...cur, insightText: "", recommendationText: "" } : cur,
              );
              generateInsightMutation.mutate();
            }}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary/90 text-white font-medium px-6 py-2.5"
          >
            Generate AI Insights
          </Button>
        </div>
      </div>
    );
  }

  const displayInsightText = renderInsight?.insightText ?? "";

  if (renderInsight && !shouldShowEmpty) {
    return (
      <div ref={containerRef}>
        <AIInsights
        context={renderInsight.contextText || ""}
        insight={displayedText}
        recommendation={renderInsight.recommendationText || ""}
        status={renderInsight.status}
        isTyping={false}
        hasCustomContext={renderInsight.hasContext === true}
        clientId={clientId}
        metricName={metricName}
        timePeriod={canonicalPeriod}
        metricData={metricData}
        onRegenerate={async () => {
          shouldAnimateRef.current = true;
          try {
            const contextResponse = await fetch(
              `/api/insight-context/${clientId}/${encodeURIComponent(metricName)}?period=${encodeURIComponent(canonicalPeriod)}`,
            );
            if (contextResponse.ok) {
              const contextData = await contextResponse.json();
              const existingContext = contextData.userContext?.trim();
              if (existingContext) {
                suppressHydrationRef.current = true;
                setForcedEmpty(false);
                setInsight((cur) =>
                  cur
                    ? {
                        ...cur,
                        insightText: "",
                        recommendationText: "",
                        hasContext: true,
                      }
                    : cur,
                );
                generateInsightWithContextMutation.mutate(existingContext);
                return;
              }
            }
          } catch {}
          suppressHydrationRef.current = true;
          setForcedEmpty(false);
          setInsight((cur) =>
            cur ? { ...cur, insightText: "", recommendationText: "" } : cur,
          );
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          shouldAnimateRef.current = true;
          suppressHydrationRef.current = true;
          setForcedEmpty(false);
          setInsight((cur) =>
            cur
              ? {
                  ...cur,
                  insightText: "",
                  recommendationText: "",
                  hasContext: true,
                }
              : cur,
          );
          generateInsightWithContextMutation.mutate(userContext);
        }}
        onClear={async () => {
          setIsBusy(true);
          suppressHydrationRef.current = true;
          setForcedEmpty(true);
          setInsight(null);
          deletedRef.current = metricName; // Mark as deleted to prevent flashback
          onStatusChange?.(undefined);

          // Prune cache for the matching key
          queryClient.setQueryData(["/api/ai-insights", clientId, canonicalPeriod], (oldData: any) => {
            if (!oldData?.insights) return oldData;
            return {
              ...oldData,
              insights: oldData.insights.filter((ins: any) => ins.metricName !== metricName)
            };
          });

          // Optimistic cache prune (optional)
          queryClient.setQueryData(
            ["/api/ai-insights", clientId, canonicalPeriod],
            (prev: any) => {
              if (!prev || !Array.isArray(prev.insights)) return prev;
              return {
                ...prev,
                insights: prev.insights.filter(
                  (it: any) => it.metricName !== metricName,
                ),
              };
            },
          );

          try {
            const response = await fetch(
              `/api/ai-insights/${clientId}/${encodeURIComponent(metricName)}?period=${encodeURIComponent(canonicalPeriod)}`,
              { method: "DELETE" },
            );
            if (!response.ok)
              throw new Error("Failed to delete insight and context");

            await queryClient.invalidateQueries({
              queryKey: ["/api/ai-insights", clientId, canonicalPeriod],
            });
            queryClient.invalidateQueries({
              queryKey: QueryKeys.insightContext(
                clientId,
                metricName,
                canonicalPeriod,
              ),
            });

            // Mark ready to release once refetch shows item is gone
            deleteConfirmRef.current = true;
            setIsBusy(false);
          } catch (error) {
            suppressHydrationRef.current = false;
            setForcedEmpty(false);
            setIsBusy(false);
            deletedRef.current = null; // Clear tombstone on error (immediate rollback)
            logger.warn(
              "Failed to delete insight and context via transactional operation",
              { error },
            );
          }
        }}
      />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
          Get strategic competitive intelligence and actionable recommendations
          for <span className="font-medium text-primary">{metricName}</span> for{" "}
          {monthLabel}
        </p>
        <Button
          onClick={() => {
            shouldAnimateRef.current = true;
            suppressHydrationRef.current = true;
            setForcedEmpty(false);
            setInsight((cur) =>
              cur ? { ...cur, insightText: "", recommendationText: "" } : cur,
            );
            generateInsightMutation.mutate();
          }}
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
});
