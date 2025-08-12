import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAIInsights } from "@/hooks/use-ai-insights";
import { useGA4Status } from "@/hooks/useGA4Status";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AIInsights } from "@/components/ai-insights";
import { logger } from "@/utils/logger";
import { QueryKeys } from "@/lib/queryKeys";

/**
 * Persist typewriter progress across unmounts (e.g., list virtualization).
 * Keyed by clientId|metricName|period
 */
const typingState = new Map<string, { text: string; index: number }>();

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

export function MetricInsightBox({
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
  const [typing, setTyping] = useState({ active: false, text: "" });
  const queryClient = useQueryClient();

  // Guards / flags
  const suppressHydrationRef = useRef(false);
  const lastTypedRef = useRef<string>("");

  // Visibility tracking refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);

  // Typewriter engine refs
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const fullTextRef = useRef<string>("");
  const indexRef = useRef<number>(0);
  const keyRef = useRef<string>("");
  const doneRef = useRef<boolean>(false);

  // Confirmed delete flag (set only after DELETE + refetch)
  const deleteConfirmRef = useRef(false);

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

  // Visibility tracking effect
  useEffect(() => {
    const el = containerRef.current;
    let io: IntersectionObserver | null = null;
    if (typeof window !== "undefined" && "IntersectionObserver" in window && el) {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) isVisibleRef.current = entry.isIntersecting;
      }, { threshold: 0.01 });
      io.observe(el);
    }
    const onVis = () => (isTabVisibleRef.current = document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      if (io && el) io.unobserve(el);
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const monthLabel = useMemo(() => {
    const now = new Date();
    const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dataMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, []);

  /** rAF-based typewriter — smooth, catch-up on inactive, resilient to unmount/remount */
  function startTypewriter(full: string) {
    // Cancel any prior
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    doneRef.current = false;
    fullTextRef.current = full;
    keyRef.current = `${clientId}|${metricName}|${canonicalPeriod}`;

    // Resume if we have progress stored for the same text
    const saved = typingState.get(keyRef.current);
    const startIdx = saved && saved.text === full ? saved.index : 0;
    indexRef.current = startIdx;
    setTyping({ active: true, text: full.slice(0, startIdx) });

    // Hydration suppressed during animation
    suppressHydrationRef.current = true;
    lastTsRef.current = 0;

    const msPerChar = 14; // ~70 cps. Adjust if you want faster/slower.
    const batchChars = 3; // batch state updates for perf

    const step = (ts: number) => {
      if (doneRef.current) return;
      if (!isVisibleRef.current || !isTabVisibleRef.current) {
        rafIdRef.current = requestAnimationFrame(step);
        return;
      }
      if (!lastTsRef.current) lastTsRef.current = ts;
      let delta = ts - lastTsRef.current;
      if (delta > 200) delta = 200;

      let advance = Math.floor(delta / msPerChar);
      if (advance <= 0) { 
        rafIdRef.current = requestAnimationFrame(step); 
        return; 
      }
      if (advance > 3) advance = 3;

      lastTsRef.current += advance * msPerChar;
      indexRef.current = Math.min(
        indexRef.current + advance,
        fullTextRef.current.length,
      );

      const next = fullTextRef.current.slice(0, indexRef.current);
      setTyping((t) => (t.active ? { active: true, text: next } : t));

      // Persist progress so we can resume after unmount
      typingState.set(keyRef.current, {
        text: fullTextRef.current,
        index: indexRef.current,
      });

      if (indexRef.current >= fullTextRef.current.length) {
        // Done
        doneRef.current = true;
        setTyping({ active: false, text: fullTextRef.current });
        setInsight((cur) =>
          cur
            ? { ...cur, insightText: fullTextRef.current }
            : ({ insightText: fullTextRef.current } as any),
        );
        lastTypedRef.current = fullTextRef.current;
        typingState.delete(keyRef.current);
        suppressHydrationRef.current = false;
        rafIdRef.current = null;
        return;
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);
  }

  // Cleanup: cancel rAF & persist progress
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
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

  // Preload (props) when allowed
  useEffect(() => {
    if (suppressHydrationRef.current || forcedEmpty || typing.active) return;
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
    onStatusChange,
    preloadedInsight,
    forcedEmpty,
    typing.active,
  ]);

  // Hydrate from server when allowed (won't run while typing)
  useEffect(() => {
    if (suppressHydrationRef.current || forcedEmpty || typing.active) return;
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
  }, [metricInsight, onStatusChange, forcedEmpty, typing.active]);

  // Start (or resume) typewriter when server text changes
  useEffect(() => {
    if (forcedEmpty) return;
    const serverText = (metricInsight?.insightText || "").trim();
    if (!serverText) return;

    // If we already fully typed this exact text, skip
    if (serverText === lastTypedRef.current) return;

    // If we have saved progress for this key and text, resume from it
    keyRef.current = `${clientId}|${metricName}|${canonicalPeriod}`;
    const saved = typingState.get(keyRef.current);
    if (saved && saved.text === serverText && saved.index < serverText.length) {
      startTypewriter(serverText);
      return;
    }

    // Fresh start
    startTypewriter(serverText);
  }, [
    metricInsight?.insightText,
    forcedEmpty,
    clientId,
    metricName,
    canonicalPeriod,
  ]);

  // Release delete lock only after confirmed + no fetch + item gone
  useEffect(() => {
    if (deleteConfirmRef.current && !isFetching && !metricInsight) {
      deleteConfirmRef.current = false;
      suppressHydrationRef.current = false;
      setForcedEmpty(false);
      setInsight(null);
      setTyping({ active: false, text: "" });
    }
  }, [metricInsight, isFetching]);

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/ai-insights", clientId, canonicalPeriod],
      });
    },
    onError: (error) => {
      suppressHydrationRef.current = false;
      setTyping({ active: false, text: "" });
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
    onSuccess: async () => {
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
      setTyping({ active: false, text: "" });
      logger.warn("Failed to generate insight with context", {
        error,
        clientId,
        metricName,
      });
      try {
        generateInsightMutation.mutate();
      } catch {}
    },
  });

  const isBusy =
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

  const displayInsightText = typing.active
    ? typing.text
    : (insight?.insightText ?? "");
  const shouldShowEmpty =
    forcedEmpty ||
    (!typing.active &&
      !isLoadingInsights &&
      !isFetching &&
      !metricInsight?.insightText &&
      !insight?.insightText);

  if (insight && !shouldShowEmpty) {
    return (
      <div ref={containerRef}>
        <AIInsights
        context={insight.contextText || ""}
        insight={displayInsightText}
        recommendation={insight.recommendationText || ""}
        status={insight.status}
        isTyping={typing.active}
        hasCustomContext={insight.hasContext === true}
        clientId={clientId}
        metricName={metricName}
        timePeriod={canonicalPeriod}
        metricData={metricData}
        onRegenerate={async () => {
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
                setTyping({ active: true, text: "" });
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
          setTyping({ active: true, text: "" });
          setInsight((cur) =>
            cur ? { ...cur, insightText: "", recommendationText: "" } : cur,
          );
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          suppressHydrationRef.current = true;
          setForcedEmpty(false);
          setTyping({ active: true, text: "" });
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
          // Stop any typing animation
          if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
          typingState.delete(`${clientId}|${metricName}|${canonicalPeriod}`);

          suppressHydrationRef.current = true;
          setForcedEmpty(true);
          setInsight(null);
          setTyping({ active: false, text: "" });
          onStatusChange?.(undefined);

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
          } catch (error) {
            suppressHydrationRef.current = false;
            setForcedEmpty(false);
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
            suppressHydrationRef.current = true;
            setForcedEmpty(false);
            setTyping({ active: true, text: "" });
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
}
