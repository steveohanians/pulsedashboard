export const APP_CONFIG = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  // Polling & Timing
  polling: {
    semrushIntegration: 8000, // 8 seconds
    ga4Sync: 5000, // 5 seconds
    maxPollDuration: 5 * 60 * 1000, // 5 minutes
    dashboardRefresh: 30000, // 30 seconds
    eventPoll: 30000, // 30 seconds for event polling (was 500ms - too aggressive!)
  },

  // Toast Durations
  toast: {
    default: 3000,
    success: 4000,
    error: 5000,
    important: 10000,
  },

  // Feature Flags
  features: {
    enableGA4AutoSync: false, // Set to true when ready
    enableWebSocket: false,
    enableAdvancedFilters: true,
    enableBulkOperations: false,
    maxCSVImportRows: 1000,
  },

  // Default Values
  defaults: {
    clientId: 'demo-client-id',
    companyName: 'Demo Company',
    timePeriod: 'Last Month',
    pageSize: 25,
    maxHistorySize: 100,
  },

  // Cache Configuration
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50,
    staleWhileRevalidate: true,
  },

  // UI Configuration
  ui: {
    mobileBreakpoint: 768,
    tabletBreakpoint: 1024,
    animationDuration: 200,
    debounceDelay: 300,
  },

  // Validation
  validation: {
    minPasswordLength: 8,
    maxNameLength: 100,
    maxUrlLength: 255,
    ga4PropertyPattern: /^\d+$/,
  },

  // SEMrush Integration
  semrush: {
    historicalMonths: 15,
    metricsToFetch: [
      'Organic Traffic',
      'Paid Traffic', 
      'Organic Keywords',
      'Paid Keywords',
      'Backlinks',
      'Traffic Cost'
    ],
  },

  // Admin Panel
  admin: {
    tabs: [
      { value: 'users', label: 'User Management' },
      { value: 'clients', label: 'Client Management' },
      { value: 'cd-clients', label: 'CD Portfolio' },
      { value: 'benchmark', label: 'Benchmark Companies' },
      { value: 'filters', label: 'Filter Management' },
      { value: 'ga4-accounts', label: 'GA4 Accounts' },
      { value: 'prompts', label: 'AI Prompts' },
    ],
  },

  // Messages
  messages: {
    errors: {
      generic: 'An error occurred. Please try again.',
      network: 'Network error. Please check your connection.',
      unauthorized: 'You are not authorized to perform this action.',
      validation: 'Please check your input and try again.',
    },
    success: {
      saved: 'Changes saved successfully.',
      deleted: 'Item deleted successfully.',
      created: 'Item created successfully.',
    },
  },
} as const;

// Type-safe config getter
export function getConfig<T extends keyof typeof APP_CONFIG>(
  key: T
): typeof APP_CONFIG[T] {
  return APP_CONFIG[key];
}