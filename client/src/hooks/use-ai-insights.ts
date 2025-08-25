import { useQuery } from '@tanstack/react-query';

// Helper to normalize period to YYYY-MM format
export function toYYYYMM(period: string | undefined): string {
  if (!period || period === "Last Month") {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  }
  return period;
}

export function useAIInsights(clientId: string | undefined, period: string | undefined) {
  const canonicalPeriod = toYYYYMM(period ?? "Last Month");
  const enabled = Boolean(clientId) && Boolean(canonicalPeriod);
  
  // Guard warning for disabled queries  
  if (!enabled && (clientId || period)) {
  }

  return useQuery({
    queryKey: ["/api/ai-insights", clientId, canonicalPeriod],
    enabled,
    retry: 0,
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 0,
    queryFn: async () => {
      const url = `/api/ai-insights/${encodeURIComponent(clientId!)}` +
                  `?period=${encodeURIComponent(canonicalPeriod!)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`AI insights ${res.status}`);
      }
      const data = await res.json();
      return data;
    },
  });
}