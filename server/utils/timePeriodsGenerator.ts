// Centralized time period generation utility
// This file consolidates all time period logic to eliminate duplication

/**
 * Generate 15 months of historical time periods based on current Pacific Time
 * This is the single source of truth for time period generation across the application
 */
export function generateTimePeriods(): string[] {
  // Use Pacific Time properly with Intl API
  const now = new Date();
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  });
  
  // Get current date in Pacific Time
  const ptParts = ptFormatter.formatToParts(now);
  const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  
  const periods: string[] = [];
  
  // Generate 15 months of historical data, starting from 1 month before current PT date
  // This ensures we always have comprehensive data for analysis
  const latestDate = new Date(ptYear, ptMonth - 1, 1); // 1 month before current
  for (let i = 0; i < 15; i++) {
    const date = new Date(latestDate);
    date.setMonth(latestDate.getMonth() - i);
    periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  
  return Array.from(new Set(periods)); // Remove duplicates and return
}

/**
 * Generate time periods based on filter selection with custom date support
 * Used by dashboard queries to determine which periods to fetch data for
 */
export function generateTimePeriodsWithOffsets(
  timePeriod: string, 
  customStartDate?: string, 
  customEndDate?: string
): string[] {
  const { year, month } = parsePacificTimeDate();
  
  switch (timePeriod) {
    case 'Last Month':
      // Return the most recent complete month
      const lastMonth = new Date(year, month - 1, 1);
      return [`${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`];
      
    case 'Last Quarter':
      // Return the last 3 months
      const periods: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const date = new Date(year, month - i, 1);
        periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
      return periods;
      
    case 'Last Year':
      // Return the last 12 months
      const yearPeriods: string[] = [];
      for (let i = 1; i <= 12; i++) {
        const date = new Date(year, month - i, 1);
        yearPeriods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
      return yearPeriods;
      
    case 'Custom Date Range':
      if (!customStartDate || !customEndDate) {
        // Fallback to last month if custom dates are missing
        const fallbackMonth = new Date(year, month - 1, 1);
        return [`${fallbackMonth.getFullYear()}-${String(fallbackMonth.getMonth() + 1).padStart(2, '0')}`];
      }
      
      // Generate periods between custom start and end dates
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const customPeriods: string[] = [];
      
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      
      while (current <= endMonth) {
        customPeriods.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
        current.setMonth(current.getMonth() + 1);
      }
      
      return customPeriods;
      
    default:
      // Default to last month for unknown time periods
      const defaultMonth = new Date(year, month - 1, 1);
      return [`${defaultMonth.getFullYear()}-${String(defaultMonth.getMonth() + 1).padStart(2, '0')}`];
  }
}

/**
 * Parse Pacific Time date parts for consistent date handling
 * Consolidates the repeated ptParts.find pattern found across multiple files
 */
export function parsePacificTimeDate(): { year: number; month: number } {
  const now = new Date();
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  });
  
  const ptParts = ptFormatter.formatToParts(now);
  const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  
  return { year: ptYear, month: ptMonth };
}