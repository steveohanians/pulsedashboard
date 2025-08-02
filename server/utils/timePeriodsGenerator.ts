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