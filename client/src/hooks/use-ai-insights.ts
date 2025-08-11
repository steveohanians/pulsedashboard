import { useQuery } from '@tanstack/react-query';

export function useAIInsights(clientId: string | undefined, canonicalPeriod: string | undefined) {
  const enabled = Boolean(clientId && canonicalPeriod);
  const key = ["/api/ai-insights", clientId, canonicalPeriod];

  return useQuery({
    queryKey: key,
    enabled,
    // prevent bursts:
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async () => {
      const res = await fetch(`/api/ai-insights/${clientId}?period=${canonicalPeriod}`);
      if (!res.ok) throw new Error(`AI insights ${res.status}`);
      return res.json();
    },
  });
}