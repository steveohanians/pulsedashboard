// Environment-specific configuration
export const ENV_CONFIG = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL || '',
  appUrl: import.meta.env.VITE_APP_URL || window.location.origin,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  brandfetchApiKey: import.meta.env.VITE_BRANDFETCH_API_KEY,
  debug: import.meta.env.VITE_DEBUG === 'true',
} as const;

// Logger that respects debug mode
export const logger = {
  debug: (...args: any[]) => {
    if (ENV_CONFIG.debug) console.debug(...args);
  },
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};