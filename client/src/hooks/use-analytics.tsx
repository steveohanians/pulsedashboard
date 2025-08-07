/**
 * Custom hook for automatic Google Analytics page tracking
 * Tracks page views whenever the route changes in the SPA
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { trackPageView } from '../lib/analytics';

/**
 * Automatically tracks page views when location changes
 * Should be used once at the app level for global tracking
 */
export const useAnalytics = (): void => {
  const [location] = useLocation();
  const prevLocationRef = useRef<string>(location);
  
  useEffect(() => {
    if (location !== prevLocationRef.current) {
      trackPageView(location);
      prevLocationRef.current = location;
    }
  }, [location]);
};