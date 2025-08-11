/**
 * Time Period Normalization Utilities for AI Insights
 * Ensures consistent canonical YYYY-MM format across all insight operations
 */

import { parseUILabel } from "../../shared/timePeriod";

/**
 * Convert any time period representation to canonical YYYY-MM format
 * @param period - "Last Month", "2025-07", etc.
 * @returns Canonical YYYY-MM string
 */
export function normalizeToCanonicalMonth(period: string): string {
  try {
    // If already in YYYY-MM format, return as-is
    if (/^\d{4}-\d{2}$/.test(period)) {
      return period;
    }
    
    // Use existing time period parsing logic
    const canonicalTimePeriod = parseUILabel(period);
    
    // Extract month from canonical format - works for "last_month", "this_month", etc.
    if (canonicalTimePeriod.type === "last_month") {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (canonicalTimePeriod.type === "this_month") {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // For other formats, try to extract YYYY-MM pattern
    const match = period.match(/(\d{4})-(\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}`;
    }
    
    // Default to current month if parsing fails
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
  } catch (error) {
    // Fallback to current month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Get current month in canonical YYYY-MM format
 */
export function getCurrentCanonicalMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get last month in canonical YYYY-MM format
 */
export function getLastCanonicalMonth(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
}