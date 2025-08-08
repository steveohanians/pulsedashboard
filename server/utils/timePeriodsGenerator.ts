/**
 * Time Periods Generator - Centralized utility for consistent time period calculations.
 * Provides Pacific Time-based period generation and date parsing for dashboard analytics.
 * 
 * Core Features:
 * - Pacific Time-based calculations for consistent cross-timezone analytics
 * - Standardized 15-month historical data generation
 * - Consolidated date formatting to eliminate code duplication
 * - Single source of truth for time period logic across the application
 * 
 * Time Zone Logic:
 * - Uses America/Los_Angeles timezone for consistent Pacific Time calculations
 * - Handles daylight saving time transitions automatically via Intl.DateTimeFormat
 * - Provides reliable date parsing for multi-timezone deployment scenarios
 * 
 * Historical Data Strategy:
 * - Generates 15 months of historical periods for comprehensive analytics
 * - Starts from 1 month before current date to ensure complete month data
 * - Eliminates duplicate periods for data integrity
 * 
 * @module TimePeriodsGenerator
 */

// ============================
// CONSTANTS
// ============================

/** Number of months of historical data to generate for comprehensive analytics */
const HISTORICAL_MONTHS_COUNT = 15;

// ============================
// INTERNAL HELPER FUNCTIONS
// ============================

/**
 * Creates a standardized Pacific Time date formatter for consistent timezone handling.
 * Encapsulates Intl.DateTimeFormat configuration to eliminate code duplication.
 * 
 * @returns Configured DateTimeFormat instance for Pacific Time
 */
function createPacificTimeFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  });
}

// ============================
// TIME PERIOD GENERATION FUNCTIONS
// ============================

/**
 * Generates comprehensive historical time periods based on Pacific Time for dashboard analytics.
 * Creates standardized YYYY-MM period strings for consistent data aggregation and display.
 * 
 * Features:
 * - Pacific Time-based calculations for reliable cross-timezone analytics
 * - 15 months of historical data for comprehensive trend analysis
 * - Automatic duplicate elimination for data integrity
 * - Chronological ordering starting from most recent complete month
 * - Single source of truth for all time period generation across the application
 * 
 * Period Logic:
 * - Starts from 1 month before current Pacific Time date (last complete month)
 * - Generates exactly 15 months of historical periods
 * - Uses YYYY-MM format for consistent database storage and retrieval
 * - Handles month/year boundaries and timezone transitions automatically
 * 
 * @returns Array of period strings in YYYY-MM format, ordered from most recent to oldest
 */
export function generateTimePeriods(): string[] {
  const ptFormatter = createPacificTimeFormatter();
  
  // Get current date in Pacific Time using standardized formatter
  const ptParts = ptFormatter.formatToParts(new Date());
  const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // Convert to 0-indexed
  
  const periods: string[] = [];
  
  // Start from 1 month before current PT date to ensure complete month data
  const latestDate = new Date(ptYear, ptMonth - 1, 1);
  
  // Generate historical periods using constant for maintainability
  for (let i = 0; i < HISTORICAL_MONTHS_COUNT; i++) {
    const date = new Date(latestDate);
    date.setMonth(latestDate.getMonth() - i);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    periods.push(period);
  }
  
  // Remove duplicates and return (Set ensures data integrity)
  return Array.from(new Set(periods));
}

// ============================
// DATE PARSING UTILITIES
// ============================

/**
 * Parses current Pacific Time into standardized year/month components for consistent date handling.
 * Consolidates the repeated date parsing pattern found across multiple application modules.
 * 
 * Features:
 * - Automatic timezone conversion to Pacific Time (America/Los_Angeles)
 * - Standardized date part extraction using Intl.DateTimeFormat
 * - Consistent 0-indexed month format for JavaScript Date compatibility
 * - Handles daylight saving time transitions seamlessly
 * - Eliminates code duplication across time-sensitive modules
 * 
 * Return Format:
 * - year: 4-digit year (e.g., 2025)
 * - month: 0-indexed month (0 = January, 11 = December)
 * 
 * @returns Object containing parsed Pacific Time year and month components
 */
export function parsePacificTimeDate(): { year: number; month: number } {
  const ptFormatter = createPacificTimeFormatter();
  const ptParts = ptFormatter.formatToParts(new Date());
  
  const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // Convert to 0-indexed
  
  return { year: ptYear, month: ptMonth };
}