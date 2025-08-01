// Application configuration constants
export const APP_CONFIG = {
  // Demo/Sample Data Configuration
  DEMO_CLIENT_ID: process.env.DEMO_CLIENT_ID || "demo-client-id",
  DEMO_ADMIN_USER_ID: process.env.DEMO_ADMIN_USER_ID || "admin-user-id",
  
  // Server Configuration
  DEFAULT_PORT: parseInt(process.env.PORT || '5000', 10),
  
  // Company Branding
  COMPANY_NAME: process.env.COMPANY_NAME || "Clear Digital",
  COMPANY_LEGAL_NAME: process.env.COMPANY_LEGAL_NAME || "Clear Digital, Inc.",
  
  // Application Features
  ENABLE_SAMPLE_DATA: process.env.NODE_ENV === "development" || process.env.ENABLE_SAMPLE_DATA === "true",
  AUTO_GENERATE_SAMPLE_DATA: process.env.AUTO_GENERATE_SAMPLE_DATA === "true",
  
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
    DISABLE_SAMPLE_DATA_IN_PROD: process.env.NODE_ENV === "production" && !process.env.FORCE_SAMPLE_DATA,
    REQUIRE_EXPLICIT_PROD_OVERRIDE: true
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

// Environment validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (APP_CONFIG.DEFAULT_PORT < 1000 || APP_CONFIG.DEFAULT_PORT > 65535) {
    errors.push("Invalid port number. Must be between 1000-65535");
  }
  
  if (!APP_CONFIG.COMPANY_NAME?.trim()) {
    errors.push("Company name cannot be empty");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}