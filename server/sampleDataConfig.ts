// Sample data configuration and control system
import logger from "./utils/logger";

interface SampleDataConfig {
  enabled: boolean;
  autoGenerate: boolean;
  modes: {
    development: boolean;
    production: boolean;
  };
  generateForNewCompanies: boolean;
  generateForNewClients: boolean;
}

// Configuration - Easy to disable sample data generation
const SAMPLE_DATA_CONFIG: SampleDataConfig = {
  enabled: process.env.NODE_ENV === "development", // Only enabled in development by default
  autoGenerate: process.env.GENERATE_SAMPLE_DATA === "true", // Can be explicitly enabled
  modes: {
    development: true,  // Always allowed in development
    production: false   // Disabled in production unless explicitly enabled
  },
  generateForNewCompanies: true,  // Generate when new CD Portfolio/benchmark companies are added
  generateForNewClients: true     // Generate when new clients are added
};

// Override configuration based on environment variables
export function getSampleDataConfig(): SampleDataConfig {
  const config = { ...SAMPLE_DATA_CONFIG };
  
  // Environment overrides
  if (process.env.SAMPLE_DATA_ENABLED !== undefined) {
    config.enabled = process.env.SAMPLE_DATA_ENABLED === "true";
  }
  
  if (process.env.AUTO_GENERATE_SAMPLE_DATA !== undefined) {
    config.autoGenerate = process.env.AUTO_GENERATE_SAMPLE_DATA === "true";
  }
  
  // Safety check: disable in production unless explicitly enabled
  if (process.env.NODE_ENV === "production" && !process.env.FORCE_SAMPLE_DATA) {
    config.enabled = false;
    config.autoGenerate = false;
    logger.info("Sample data generation disabled in production (use FORCE_SAMPLE_DATA=true to override)");
  }
  
  return config;
}

// Check if sample data generation is allowed
export function isSampleDataEnabled(): boolean {
  const config = getSampleDataConfig();
  return config.enabled;
}

// Check if auto-generation should occur for new companies
export function shouldGenerateForNewCompanies(): boolean {
  const config = getSampleDataConfig();
  return config.enabled && config.generateForNewCompanies;
}

// Check if auto-generation should occur for new clients
export function shouldGenerateForNewClients(): boolean {
  const config = getSampleDataConfig();
  return config.enabled && config.generateForNewClients;
}

// Log current configuration
export function logSampleDataConfig(): void {
  const config = getSampleDataConfig();
  logger.info("Sample data configuration", {
    enabled: config.enabled,
    autoGenerate: config.autoGenerate,
    environment: process.env.NODE_ENV,
    generateForNewCompanies: config.generateForNewCompanies,
    generateForNewClients: config.generateForNewClients
  });
}

// Configuration display for admin interface
export function getSampleDataStatus() {
  const config = getSampleDataConfig();
  return {
    enabled: config.enabled,
    environment: process.env.NODE_ENV,
    autoGenerate: config.autoGenerate,
    canDisable: true,
    recommendation: process.env.NODE_ENV === "production" 
      ? "Disable sample data in production" 
      : "Sample data helps with development testing"
  };
}