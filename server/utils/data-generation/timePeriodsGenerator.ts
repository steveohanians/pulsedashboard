/**
 * Time periods generator for consistent Pacific Time-based calculations.
 * Generates 15 months of historical periods starting from last complete month.
 * Handles daylight saving transitions automatically via Intl.DateTimeFormat.
 */

const HISTORICAL_MONTHS_COUNT = 15;

function createPacificTimeFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit'
  });
}

/**
 * Generates 15 months of historical periods in YYYY-MM format.
 * Starts from 1 month before current Pacific Time (last complete month).
 * Handles month/year boundaries and timezone transitions automatically.
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
  
  return Array.from(new Set(periods)); // Remove duplicates for data integrity
}

/**
 * Parses current Pacific Time into standardized year/month components.
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