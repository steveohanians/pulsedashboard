/**
 * Time Period Canonicalization System
 * Unified time period handling: UI labels → canonical object → DB month range → GA4 date range
 */

import { z } from 'zod';

// ===== CANONICAL TIME PERIOD SCHEMA =====

/**
 * Canonical time period object that standardizes all time period handling
 */
export const TimePeriodSchema = z.object({
  granularity: z.enum(['month', 'day']),
  months: z.number().positive(),
  type: z.enum(['last_month', 'last_quarter', 'last_year', 'custom_range']),
  customStart: z.string().optional(), // YYYY-MM-DD format for custom ranges
  customEnd: z.string().optional(),   // YYYY-MM-DD format for custom ranges
});

export type TimePeriod = z.infer<typeof TimePeriodSchema>;

/**
 * Database month range for period queries
 */
export interface DbRange {
  startMonth: string; // YYYY-MM format
  endMonth: string;   // YYYY-MM format
}

/**
 * GA4 API date range for analytics requests
 */
export interface Ga4Range {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}

// ===== BACKWARD COMPATIBILITY =====

/**
 * Legacy UI labels that need backward compatibility
 */
export const LEGACY_LABELS = [
  'Last Month',
  'Last Quarter', 
  'Last Year',
  'Custom Date Range'
] as const;

let deprecationWarningShown = false;

function logDeprecationWarning(label: string): void {
  if (!deprecationWarningShown) {
    console.warn(`DEPRECATION: Time period label "${label}" is deprecated. Use canonical TimePeriod objects instead.`);
    deprecationWarningShown = true;
  }
}

// ===== CORE ADAPTER FUNCTIONS =====

/**
 * Parses UI labels into canonical time period objects
 * @param label UI label from frontend (e.g., "Last Month", "4/30/2025 to 7/31/2025")
 * @returns Canonical TimePeriod object
 * @throws Error for invalid labels
 */
export function parseUILabel(label: string): TimePeriod {
  if (!label || typeof label !== 'string') {
    throw new Error('Invalid time period label: must be a non-empty string');
  }

  const trimmedLabel = label.trim();

  // Handle legacy labels with deprecation warning
  if (LEGACY_LABELS.includes(trimmedLabel as any)) {
    logDeprecationWarning(trimmedLabel);
  }

  // Handle custom date range format: "4/30/2025 to 7/31/2025"
  if (trimmedLabel.includes(' to ')) {
    const [startStr, endStr] = trimmedLabel.split(' to ').map(s => s.trim());
    
    try {
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format in custom range');
      }
      
      if (startDate > endDate) {
        throw new Error('Start date must be before end date');
      }
      
      // Calculate months between start and end
      const months = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      return {
        granularity: 'month',
        months: Math.max(1, months),
        type: 'custom_range',
        customStart: startDate.toISOString().split('T')[0],
        customEnd: endDate.toISOString().split('T')[0]
      };
    } catch (error) {
      // Re-throw specific validation errors
      if ((error as Error).message === 'Start date must be before end date') {
        throw error;
      }
      throw new Error(`Invalid custom date range format: ${trimmedLabel}`);
    }
  }

  // Handle standard labels
  switch (trimmedLabel) {
    case 'Last Month':
      return {
        granularity: 'month',
        months: 1,
        type: 'last_month'
      };
      
    case 'Last Quarter':
      return {
        granularity: 'month', 
        months: 3,
        type: 'last_quarter'
      };
      
    case 'Last Year':
      return {
        granularity: 'month',
        months: 12,
        type: 'last_year'
      };
      
    case 'Custom Date Range':
      // Default to last month for empty custom range
      return {
        granularity: 'month',
        months: 1,
        type: 'custom_range'
      };
      
    default:
      throw new Error(`Unsupported time period label: ${trimmedLabel}`);
  }
}

/**
 * Converts canonical time period to database month range
 * @param canonical Canonical TimePeriod object
 * @param now Current date (defaults to UTC now, accepts Date for testing)
 * @returns Database month range in YYYY-MM format
 */
export function toDbRange(canonical: TimePeriod, now: Date = new Date()): DbRange {
  // Validate input
  const validation = TimePeriodSchema.safeParse(canonical);
  if (!validation.success) {
    throw new Error(`Invalid canonical time period: ${validation.error.message}`);
  }

  // Handle custom ranges
  if (canonical.type === 'custom_range' && canonical.customStart && canonical.customEnd) {
    const startDate = new Date(canonical.customStart);
    const endDate = new Date(canonical.customEnd);
    
    return {
      startMonth: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
      endMonth: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`
    };
  }

  // Calculate period range based on current date (UTC)
  // Always use last complete month as the ending point
  const lastCompleteMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // Calculate start month by subtracting the required months
  const startMonth = new Date(lastCompleteMonth);
  startMonth.setMonth(startMonth.getMonth() - (canonical.months - 1));
  
  return {
    startMonth: `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`,
    endMonth: `${lastCompleteMonth.getFullYear()}-${String(lastCompleteMonth.getMonth() + 1).padStart(2, '0')}`
  };
}

/**
 * Converts canonical time period to GA4 API date range
 * @param canonical Canonical TimePeriod object
 * @param now Current date (defaults to UTC now, accepts Date for testing)
 * @returns GA4 date range in YYYY-MM-DD format
 */
export function toGa4Range(canonical: TimePeriod, now: Date = new Date()): Ga4Range {
  // Validate input
  const validation = TimePeriodSchema.safeParse(canonical);
  if (!validation.success) {
    throw new Error(`Invalid canonical time period: ${validation.error.message}`);
  }

  // Handle custom ranges
  if (canonical.type === 'custom_range' && canonical.customStart && canonical.customEnd) {
    return {
      startDate: canonical.customStart,
      endDate: canonical.customEnd
    };
  }

  // Calculate GA4 date range based on current date (UTC)
  // Always use last complete month as the ending point
  const lastCompleteMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // Calculate start month
  const startMonth = new Date(lastCompleteMonth);
  startMonth.setMonth(startMonth.getMonth() - (canonical.months - 1));
  
  // Calculate precise start and end dates
  const startDate = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
  const endDate = new Date(lastCompleteMonth.getFullYear(), lastCompleteMonth.getMonth() + 1, 0); // Last day of end month
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

// ===== VALIDATION HELPERS =====

/**
 * Validates if a time period object is canonical
 * @param obj Object to validate
 * @returns true if valid canonical TimePeriod
 */
export function isCanonicalTimePeriod(obj: unknown): obj is TimePeriod {
  return TimePeriodSchema.safeParse(obj).success;
}

/**
 * Validates if a string is a legacy UI label
 * @param label String to validate
 * @returns true if legacy label
 */
export function isLegacyLabel(label: string): boolean {
  return LEGACY_LABELS.includes(label as any);
}

// ===== QUERY KEY GENERATORS =====

/**
 * Generates standardized query keys using canonical time periods
 * @param canonical Canonical TimePeriod object
 * @returns Array suitable for React Query keys
 */
export function generateQueryKey(canonical: TimePeriod): readonly [string, TimePeriod] {
  return ['timePeriod', canonical] as const;
}

/**
 * Generates cache keys for server-side caching
 * @param canonical Canonical TimePeriod object
 * @returns String cache key
 */
export function generateCacheKey(canonical: TimePeriod): string {
  if (canonical.type === 'custom_range' && canonical.customStart && canonical.customEnd) {
    return `period:custom:${canonical.customStart}:${canonical.customEnd}`;
  }
  
  return `period:${canonical.type}:${canonical.months}`;
}

// ===== DISPLAY HELPERS =====

/**
 * Converts canonical time period back to display label
 * @param canonical Canonical TimePeriod object
 * @returns Human-readable display label
 */
export function toDisplayLabel(canonical: TimePeriod): string {
  switch (canonical.type) {
    case 'last_month':
      return 'Last Month';
    case 'last_quarter':
      return 'Last Quarter';
    case 'last_year':
      return 'Last Year';
    case 'custom_range':
      if (canonical.customStart && canonical.customEnd) {
        return `${canonical.customStart} to ${canonical.customEnd}`;
      }
      return 'Custom Date Range';
    default:
      return 'Unknown Period';
  }
}

// ===== MONTH EDGE CASES =====

/**
 * Handles month boundary edge cases (Jan/Dec transitions)
 * @param date Date to normalize
 * @returns Normalized date with proper month boundaries
 */
export function normalizeMonthBoundary(date: Date): Date {
  const normalized = new Date(date);
  
  // Ensure we're at the first day of the month for consistency
  normalized.setDate(1);
  normalized.setHours(0, 0, 0, 0);
  
  return normalized;
}

/**
 * Checks if a year is a leap year
 * @param year Year to check
 * @returns true if leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Gets the number of days in a specific month/year
 * @param year Year
 * @param month Month (1-12)
 * @returns Number of days in the month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}