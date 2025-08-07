/**
 * Google Analytics integration utilities
 * Provides functions for GA4 initialization and event tracking
 */

// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Get the GA measurement ID from environment variables
 * @returns The measurement ID or null if not configured
 */
function getMeasurementId(): string | null {
  return import.meta.env.VITE_GA_MEASUREMENT_ID || null;
}

/**
 * Check if Google Analytics is available and configured
 * @returns True if GA is ready to use
 */
function isGAAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.gtag && !!getMeasurementId();
}

/**
 * Initialize Google Analytics by injecting the required scripts
 * Call this once when your application starts
 */
export const initGA = (): void => {
  const measurementId = getMeasurementId();

  if (!measurementId) {
    return;
  }

  // Add Google Analytics script to the head
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(gtagScript);

  // Initialize gtag
  const initScript = document.createElement('script');
  initScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(initScript);
};

/**
 * Track page views for single-page applications
 * @param url The page URL to track
 */
export const trackPageView = (url: string): void => {
  if (!isGAAvailable()) return;
  
  const measurementId = getMeasurementId()!;
  window.gtag('config', measurementId, {
    page_path: url
  });
};

/**
 * Track custom events
 * @param action The event action (required)
 * @param category The event category (optional)
 * @param label The event label (optional) 
 * @param value The event value (optional)
 */
export const trackEvent = (
  action: string, 
  category?: string, 
  label?: string, 
  value?: number
): void => {
  if (!isGAAvailable()) return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};