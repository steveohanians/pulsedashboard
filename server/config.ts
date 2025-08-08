// Centralized environment configuration with type safety
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

export const APP_CONFIG = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: isProduction,
  IS_DEVELOPMENT: isDevelopment,
  
  // Server Configuration
  PORT: parseInt(process.env.PORT || '5000', 10),
  SESSION_SECRET: process.env.SESSION_SECRET || (() => {
    if (isProduction) throw new Error('SESSION_SECRET is required in production');
    return 'dev-session-secret-not-for-production';
  })(),
  
  // Demo/Sample Data Configuration
  DEMO_CLIENT_ID: process.env.DEMO_CLIENT_ID || "demo-client-id",
  DEMO_ADMIN_USER_ID: process.env.DEMO_ADMIN_USER_ID || "admin-user-id",
  
  // Company Branding
  COMPANY_NAME: process.env.COMPANY_NAME || "Clear Digital",
  COMPANY_LEGAL_NAME: process.env.COMPANY_LEGAL_NAME || "Clear Digital, Inc.",
  
  // External API Keys
  SEMRUSH_API_KEY: process.env.SEMRUSH_API_KEY || null,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || null,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || null,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  
  // DISABLED: All sample data generation permanently disabled to ensure authentic data only
  ENABLE_SAMPLE_DATA: false,
  AUTO_GENERATE_SAMPLE_DATA: false,
  
  // Metric Ranges (can be overridden via environment)
  METRICS: {
    BOUNCE_RATE: {
      CLIENT_RANGE: [25, 40] as [number, number],
      INDUSTRY_RANGE: [35, 55] as [number, number],
      CD_RANGE: [30, 45] as [number, number]
    },
    SESSION_DURATION: {
      CLIENT_RANGE: [120, 240] as [number, number],
      INDUSTRY_RANGE: [90, 180] as [number, number], 
      CD_RANGE: [140, 220] as [number, number]
    },
    PAGES_PER_SESSION: {
      CLIENT_RANGE: [2.5, 4.5] as [number, number],
      INDUSTRY_RANGE: [1.8, 3.2] as [number, number],
      CD_RANGE: [2.8, 4.2] as [number, number]
    },
    SESSIONS_PER_USER: {
      CLIENT_RANGE: [1.8, 3.5] as [number, number],
      INDUSTRY_RANGE: [1.2, 2.8] as [number, number],
      CD_RANGE: [2.0, 3.2] as [number, number]
    }
  },
  
  // Time Period Configuration
  TIME_PERIODS: {
    DEFAULT_LOOKBACK_MONTHS: 3,
    INCLUDE_YEAR_OVER_YEAR: true,
    INCLUDE_QUARTERLY_COMPARISON: true
  },
  
  // Production Safety
  PRODUCTION_SAFETY: {
    DISABLE_SAMPLE_DATA_IN_PROD: isProduction && !process.env.FORCE_SAMPLE_DATA,
    REQUIRE_EXPLICIT_PROD_OVERRIDE: true
  },
  
  // Security Settings
  SECURITY: {
    COOKIE_SECURE: isProduction,
    TRUST_PROXY: isProduction,
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Helper functions for dynamic configuration
export function getDefaultClientId(): string {
  return APP_CONFIG.DEMO_CLIENT_ID;
}

export function getDefaultAdminUserId(): string {
  return APP_CONFIG.DEMO_ADMIN_USER_ID;
}

export function getCompanyName(): string {
  return APP_CONFIG.COMPANY_NAME;
}

export function getCompanyLegalName(): string {
  return APP_CONFIG.COMPANY_LEGAL_NAME;
}

export function getBrandedLabel(suffix: string = "Avg"): string {
  return `${APP_CONFIG.COMPANY_NAME} Clients ${suffix}`;
}

// Type-safe config getters for external services
export function requireSemrushApiKey(): string {
  if (!APP_CONFIG.SEMRUSH_API_KEY) {
    throw new Error('SEMRUSH_API_KEY environment variable is required');
  }
  return APP_CONFIG.SEMRUSH_API_KEY;
}

export function requireSessionSecret(): string {
  return APP_CONFIG.SESSION_SECRET;
}

// Environment validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (APP_CONFIG.PORT < 1000 || APP_CONFIG.PORT > 65535) {
    errors.push("Invalid port number. Must be between 1000-65535");
  }
  
  if (!APP_CONFIG.COMPANY_NAME?.trim()) {
    errors.push("Company name cannot be empty");
  }
  
  if (APP_CONFIG.IS_PRODUCTION && !APP_CONFIG.SESSION_SECRET) {
    errors.push("SESSION_SECRET is required in production");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}