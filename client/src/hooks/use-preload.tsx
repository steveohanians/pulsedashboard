import { useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';

// Preload critical data for faster navigation
export function usePreloadData() {
  useEffect(() => {
    // Preload user data
    queryClient.prefetchQuery({
      queryKey: ['/api/user'],
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

    // Preload filters
    queryClient.prefetchQuery({
      queryKey: ['/api/filters'],
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, []);
}