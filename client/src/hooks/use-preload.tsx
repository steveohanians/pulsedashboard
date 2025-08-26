/**
 * Custom hook for preloading critical application data
 * Prefetches frequently-used data to improve navigation performance
 */
import { useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';

/**
 * Preloads critical data on component mount for faster navigation
 * Should be used at the app level to warm up the query cache
 */
export function usePreloadData(): void {
  useEffect(() => {
    // Preload user data (ignore 401 errors for unauthenticated users)
    queryClient.prefetchQuery({
      queryKey: ['/api/user'],
      staleTime: 2 * 60 * 1000, // 2 minutes
    }).catch(() => {
      // Silently ignore preload errors (likely 401 for unauthenticated users)
    });

    // Preload filters (ignore 401 errors for unauthenticated users)
    queryClient.prefetchQuery({
      queryKey: ['/api/filters'],
      staleTime: 5 * 60 * 1000, // 5 minutes
    }).catch(() => {
      // Silently ignore preload errors (likely 401 for unauthenticated users)
    });
  }, []);
}