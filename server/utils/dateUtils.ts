/**
 * Date utilities for dashboard analytics with Pacific Time-based period calculations.
 * Handles edge cases for month/year boundaries and provides chronological ordering for charts.
 */

import logger from "./logger";
import { parsePacificTimeDate } from "./timePeriodsGenerator";

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

const QUARTER_MONTHS = 3;
const YEAR_MONTHS = 12;

function formatDateToPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Convert from 0-indexed to 1-indexed
  return `${year}-${String(month).padStart(2, '0')}`;
}

function createDateWithMonthOffset(baseDate: Date, monthOffset: number): Date {
  const offsetDate = new Date(baseDate);
  offsetDate.setMonth(offsetDate.getMonth() + monthOffset);
  return offsetDate;
}

function generatePeriodRange(targetDate: Date, monthCount: number): string[] {
  const periods: string[] = [];
  
  for (let i = monthCount - 1; i >= 0; i--) {
    const periodDate = createDateWithMonthOffset(targetDate, -i);
    periods.push(formatDateToPeriod(periodDate));
  }
  
  return periods;
}

/**
 * Generates dynamic time period mappings based on Pacific Time.
 * Period Logic: Last Month (single), Last Quarter (3 months), Last Year (12 months).
 * All periods end with the last complete month to ensure data completeness.
 * - Custom Date Range: Defaults to last complete month
 * 
 * @returns Object mapping period type names to arrays of period strings in YYYY-MM format
 */
export function generateDynamicPeriodMapping(): Record<string, string[]> {
  // Use centralized Pacific Time parsing for timezone consistency
  const { year: ptYear, month: ptMonth } = parsePacificTimeDate();
  
  // Create target month (1 month before current PT date for "last complete month" logic)
  const targetMonth = new Date(ptYear, ptMonth - 1, 1);
  
  // Generate periods using helper functions for consistency
  const currentPeriod = formatDateToPeriod(targetMonth);
  const lastMonthPeriod = formatDateToPeriod(createDateWithMonthOffset(targetMonth, -1));
  const currentQuarterPeriods = generatePeriodRange(targetMonth, QUARTER_MONTHS);
  const yearPeriods = generatePeriodRange(targetMonth, YEAR_MONTHS);
  
  // Log comprehensive period mapping information
  logger.info("Generated dynamic period mapping", {
    currentPeriod,
    lastMonthPeriod,
    currentQuarterPeriods,
    yearPeriodsCount: yearPeriods.length,
    yearPeriodsRange: yearPeriods.length > 0 ? `${yearPeriods[0]} to ${yearPeriods[yearPeriods.length - 1]}` : 'none',
    actualYearPeriods: yearPeriods
  });
  
  return {
    "Last Month": [currentPeriod], // Last complete month
    "Last Quarter": currentQuarterPeriods, // Current quarter (3 months ending with last complete month)
    "Last Year": yearPeriods, // Exactly 12 months ending with last complete month
    "Custom Date Range": [currentPeriod] // Default to last complete month for custom ranges
  };
}

// ============================
// DISPLAY FORMATTING FUNCTIONS
// ============================

/**
 * Generates user-friendly display labels for time periods in dashboard UI components.
 * Creates formatted strings suitable for dropdowns, headers, and period selectors.
 * 
 * Features:
 * - Human-readable period descriptions
 * - Consistent formatting across all period types
 * - Automatic calculation based on current date
 * - Localized month names using US English format
 * 
 * Label Formats:
 * - Last Month: "July 2025"
 * - Last Quarter: "Q3 2025"
 * - Last Year: "August 2024 - July 2025"
 * 
 * @returns Object mapping period type names to human-readable display strings
 */
export function getTimePeriodDisplayLabels(): Record<string, string> {
  const now = new Date();
  
  // Last Month display using helper function
  const lastMonth = createDateWithMonthOffset(now, -1);
  const lastMonthDisplay = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Current Quarter display with proper quarter calculation
  const currentQuarter = Math.floor(now.getMonth() / QUARTER_MONTHS) + 1;
  const quarterDisplay = `Q${currentQuarter} ${now.getFullYear()}`;
  
  // Last Year display showing 12-month range
  const yearStart = createDateWithMonthOffset(now, -YEAR_MONTHS);
  const yearEnd = createDateWithMonthOffset(now, -1);
  const yearDisplay = `${yearStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${yearEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  
  return {
    "Last Month": lastMonthDisplay,
    "Last Quarter": quarterDisplay,
    "Last Year": yearDisplay
  };
}

/**
 * Generates compact period labels optimized for chart display and data visualization.
 * Converts YYYY-MM period strings into concise, chart-friendly labels.
 * 
 * Features:
 * - Compact format suitable for chart axes and legends
 * - Consistent abbreviated month names
 * - Two-digit year format for space efficiency
 * - Bulk processing of period arrays for performance
 * 
 * Label Format: "Jan 25", "Feb 25", "Dec 24", etc.
 * 
 * @param periods - Array of period strings in YYYY-MM format
 * @returns Object mapping period strings to compact chart labels
 */
export function generateChartPeriodLabels(periods: string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  
  periods.forEach(period => {
    const [year, month] = period.split('-');
    const monthIndex = parseInt(month) - 1; // Convert to 0-indexed for array access
    const shortYear = year.slice(-2); // Get last 2 digits of year
    
    // Use constant for month abbreviations and validate index
    if (monthIndex >= 0 && monthIndex < MONTH_ABBREVIATIONS.length) {
      labels[period] = `${MONTH_ABBREVIATIONS[monthIndex]} ${shortYear}`;
    }
  });
  
  return labels;
}

// ============================
// DATA GENERATION UTILITIES
// ============================

/**
 * Determines if sample data generation is needed for the current time period.
 * Used for dynamic data population and testing scenarios.
 * 
 * Features:
 * - Current month period calculation
 * - Dynamic generation flag for demo/testing purposes
 * - Automatic period detection based on current date
 * 
 * @returns Object containing generation flag and current period string
 */
export function shouldGenerateDataForCurrentPeriod(): { needed: boolean; period: string } {
  const now = new Date();
  const currentPeriod = formatDateToPeriod(now);
  
  return {
    needed: true, // Always true for dynamic generation in demo mode
    period: currentPeriod
  };
}

/**
 * Retrieves the most recent available data period from the database storage.
 * Used to determine the latest period with actual data for fallback logic.
 * 
 * Features:
 * - Database integration for period detection
 * - Graceful error handling with logging
 * - Null return for fallback to dynamic period generation
 * 
 * Note: Currently returns null as a placeholder - would need storage implementation
 * to query for the latest period with available data.
 * 
 * @param storage - Storage interface with client metrics access
 * @param clientId - Client identifier for period lookup
 * @returns Promise resolving to most recent period string or null if unavailable
 */
export async function getMostRecentDataPeriod(
  storage: { getMetricsByClient: (clientId: string) => Promise<Array<{ timePeriod: string }>> }, 
  clientId: string
): Promise<string | null> {
  try {
    // Placeholder implementation - would need actual storage query logic
    // to find the most recent period with available data for the client
    return null;
  } catch (error) {
    logger.error("Error getting most recent data period", { 
      error: (error as Error).message,
      clientId 
    });
    return null;
  }
}