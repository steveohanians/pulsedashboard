import { useState, useEffect, useMemo, useRef } from "react";
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
  const [forcedEmpty, setForcedEmpty] = useState(false);
  const [typing, setTyping] = useState({ active: false, text: "" });
  const queryClient = useQueryClient();

  // A) Add suppression flag to block hydration while generating
  const suppressHydrationRef = useRef(false);
  const lastTypedRef = useRef<string>(""); // track last fully-typed server text

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

  // Real typewriter that only starts when new server text arrives
  function startTypewriter(full: string) {
    // Cancel any previous run
    clearInterval((startTypewriter as any)._id);

    setTyping({ active: true, text: "" });
    let i = 0;

    (startTypewriter as any)._id = setInterval(() => {
      i++;
      setTyping((t) => (t.active ? { active: true, text: full.slice(0, i) } : t));
      if (i >= full.length) {
        clearInterval((startTypewriter as any)._id);
        setTyping({ active: false, text: full });
        // After done typing, copy into local insight so it persists
        setInsight((cur) => cur ? { ...cur, insightText: full } : { insightText: full } as any);
        lastTypedRef.current = full;
      }
    }, 12);
  }

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
    // Guard hydration during delete/regenerate operations and typing states
    if (suppressHydrationRef.current) return;   // don't hydrate during delete/regenerate
    if (forcedEmpty) return;                    // don't hydrate while we've forced empty
    if (typing.active) return;                  // don't hydrate while typewriter is running
    
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
          hasContext: preloadedInsight?.hasContext === true,
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
  }, [clientId, metricName, onStatusChange, preloadedInsight, insight?.isTyping]);

  // C) Guard the hydration-from-server effect
  useEffect(() => {
    if (suppressHydrationRef.current) return;   // don't hydrate during delete/regenerate
    if (forcedEmpty) return;                    // don't hydrate while we've forced empty
    if (typing.active) return;                  // don't hydrate while typewriter is running
    
    if (metricInsight) {
      setInsight({
        contextText: metricInsight.contextText,
        insightText: metricInsight.insightText,
        recommendationText: metricInsight.recommendationText,
        status: metricInsight.status,
        isTyping: false,
        // treat as server data; no blocking flag
        isFromStorage: false,
        hasContext: metricInsight?.hasContext === true,
      });
      if (metricInsight.status && onStatusChange) {
        onStatusChange(metricInsight.status);
      }
    }
  }, [metricInsight, onStatusChange, insight?.isTyping]);

  // D) Start typewriter when new server text arrives
  useEffect(() => {
    if (suppressHydrationRef.current) return;
    if (forcedEmpty) return;

    const serverText = (metricInsight?.insightText || "").trim();
    if (!serverText) return;

    // Only type when server text changed
    if (serverText === lastTypedRef.current) return;

    // Don't let hydration clobber while we type
    suppressHydrationRef.current = true;
    startTypewriter(serverText);

    // Release hydration when typing finishes
    const estMs = Math.max(200, (serverText.length + 2) * 12);
    const done = setTimeout(() => {
      suppressHydrationRef.current = false;
    }, estMs + 20);
    return () => clearTimeout(done);
  }, [metricInsight?.insightText]);  // only when server text actually changes

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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
      await queryClient.refetchQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod], type: "active" });
      // do NOT set suppressHydrationRef=false here — we flip it off in the typewriter effect after the new text finishes animating
    },
    onError: (error) => {
      suppressHydrationRef.current = false;
      setTyping({ active: false, text: "" });
      logger.warn("Failed to generate insight", {
        error: error instanceof Error ? error.message : "Unknown error",
        clientId,
        metricName,
      });
    },
    onSettled: () => {
      // No-op for suppressHydrationRef (let the typing effect decide when to release)
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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
      await queryClient.refetchQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod], type: "active" });
      queryClient.invalidateQueries({ queryKey: QueryKeys.insightContext(clientId, metricName) });
      // do NOT set suppressHydrationRef=false here — we flip it off in the typewriter effect after the new text finishes animating
    },
    onError: (error) => {
      suppressHydrationRef.current = false;
      setTyping({ active: false, text: "" });
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
    onSettled: () => {
      // No-op for suppressHydrationRef (let the typing effect decide when to release)
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
          hasContext: matchingInsight?.hasContext === true,
        });
        if (matchingInsight.status && onStatusChange) {
          onStatusChange(matchingInsight.status);
        }
      }
    }
  }, [canonicalInsights, metricName, onStatusChange]);

  // D) Robust typewriter trigger (works even if status wording differs)
  useEffect(() => {
    if (suppressHydrationRef.current) return;
    const serverText = (metricInsight?.insightText || "").trim();
    if (!serverText) return;

    // Only run when text truly changed (prevents loops)
    if (serverText === lastTypedRef.current) return;

    // Start typewriter
    setInsight(cur => cur ? { ...cur, isTyping: true } : { isTyping: true } as any);
    runTypewriter(serverText, t =>
      setInsight(cur => cur ? { ...cur, insightText: t } : { insightText: t } as any)
    );

    // Mark this version as typed and schedule isTyping=false at the end
    lastTypedRef.current = serverText;
    const ms = Math.max(200, (serverText.length + 2) * 12);
    const done = setTimeout(() => {
      setInsight(cur => cur ? { ...cur, isTyping: false } : { isTyping: false } as any);
    }, ms);
    return () => clearTimeout(done);
  }, [metricInsight?.insightText]);
  
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

  // Decide what to render using single "display text" source
  // Critical: while typing.active, use typing.text only (not metricInsight.insightText)
  const displayInsightText = 
    typing.active ? typing.text : (insight?.insightText ?? metricInsight?.insightText ?? "");

  // Empty state wins if forced or there is no text at all
  const shouldShowEmpty = 
    forcedEmpty ||
    (
      !typing.active &&
      !isLoadingInsights &&
      !isFetching &&
      (!metricInsight?.insightText && !insight?.insightText)
    );

  if (insight && !shouldShowEmpty) {
    return (
      <AIInsights
        context={insight.contextText || ""}
        insight={displayInsightText}
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
              `/api/insight-context/${clientId}/${encodeURIComponent(metricName)}?period=${encodeURIComponent(canonicalPeriod)}`
            );
            if (contextResponse.ok) {
              const contextData = await contextResponse.json();
              const existingContext = contextData.userContext?.trim();
              if (existingContext) {
                logger.component("MetricInsightBox", "Found existing context, regenerating with context");
                suppressHydrationRef.current = true;
                setForcedEmpty(false); // we want to show the typing region, not empty
                setTyping({ active: true, text: "" });
                setInsight((cur) => cur ? { ...cur, insightText: "", recommendationText: "", hasContext: true } : cur);
                generateInsightWithContextMutation.mutate(existingContext);
                return;
              }
            }
          } catch {}
          suppressHydrationRef.current = true;
          setForcedEmpty(false); // we want to show the typing region, not empty
          setTyping({ active: true, text: "" });
          setInsight((cur) => cur ? { ...cur, insightText: "", recommendationText: "" } : cur);
          generateInsightMutation.mutate();
        }}
        onRegenerateWithContext={(userContext: string) => {
          suppressHydrationRef.current = true;
          setForcedEmpty(false); // we want to show the typing region, not empty
          setTyping({ active: true, text: "" });
          setInsight((cur) => cur ? { ...cur, insightText: "", recommendationText: "", hasContext: true } : cur);
          generateInsightWithContextMutation.mutate(userContext);
        }}
        onClear={async () => {
          // Block hydration and force empty immediately
          suppressHydrationRef.current = true;
          setForcedEmpty(true);
          setInsight(null);                  // immediate clear
          setTyping({ active: false, text: "" });
          onStatusChange?.(undefined);

          // Optimistically remove this metric from the list cache
          queryClient.setQueryData(
            ["/api/ai-insights", clientId, canonicalPeriod],
            (prev: any) => {
              if (!prev || !Array.isArray(prev.insights)) return prev;
              return {
                ...prev,
                insights: prev.insights.filter((it: any) => it.metricName !== metricName),
              };
            }
          );

          try {
            // Call delete endpoint
            const response = await fetch(`/api/ai-insights/${clientId}/${encodeURIComponent(metricName)}?period=${encodeURIComponent(canonicalPeriod)}`, {
              method: "DELETE",
            });
            
            if (!response.ok) {
              throw new Error("Failed to delete insight and context");
            }
            
            const result = await response.json();
            
            // On success: invalidate and refetch, then allow hydration
            await queryClient.invalidateQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod] });
            await queryClient.refetchQueries({ queryKey: ["/api/ai-insights", clientId, canonicalPeriod], type: "active" });
            queryClient.invalidateQueries({ queryKey: QueryKeys.insightContext(clientId, metricName) });

            // Allow hydration again (refetch has completed)
            suppressHydrationRef.current = false;
            setForcedEmpty(false);
            
            logger.component("MetricInsightBox", "Truly optimistic delete completed successfully");
          } catch (error) {
            // On error: allow hydration again so it can rehydrate from server
            suppressHydrationRef.current = false;
            setForcedEmpty(false);
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
          onClick={() => {
            suppressHydrationRef.current = true;
            setForcedEmpty(false); // we want to show the typing region, not empty
            setTyping({ active: true, text: "" });
            setInsight((cur) => cur ? { ...cur, insightText: "", recommendationText: "" } : cur);
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
