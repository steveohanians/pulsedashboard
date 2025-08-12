import { useQuery } from "@tanstack/react-query";

interface GA4StatusResponse {
  status: "processing" | "ready" | "error" | "not_ready";
}

export function useGA4Status(clientId: string, period: string, enabled: boolean) {
  return useQuery({
    queryKey: ["/api/ga4-data/status", clientId, period],
    queryFn: async (): Promise<GA4StatusResponse> => {
      const response = await fetch(
        `/api/ga4-data/status/${clientId}?period=${encodeURIComponent(period)}`
      );
      
      // If status is 404, return "not_ready" and don't retry
      if (response.status === 404) {
        return { status: "not_ready" };
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    },
    enabled,
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false),
    retry: (failureCount, err) => failureCount < 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    gcTime: 300000,
  });
}