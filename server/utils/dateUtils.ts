// Dynamic date utilities for time period handling
// This ensures the dashboard automatically updates for new months/periods

import logger from "./logger";
import { parsePacificTimeDate } from "./timePeriodsGenerator";

/**
 * Generate dynamic time period mappings based on current date
 * This ensures the dashboard shows correct periods as time progresses
 */
export function generateDynamicPeriodMapping(): Record<string, string[]> {
  // Use centralized Pacific Time parsing - consolidated utility
  const { year: ptYear, month: ptMonth } = parsePacificTimeDate();
  
  // Create PT date and go back 1 month for target period
  const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT date
  
  const currentYear = targetMonth.getFullYear();
  const currentMonth = targetMonth.getMonth(); // 0-indexed, now points to target month
  
  // Generate current month period (YYYY-MM format) - this is now 1 month before current
  const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  // Generate last month period (one month before the target month)
  const previousMonth = new Date(targetMonth);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const lastMonthPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
  
  // Generate current quarter periods (ending with target month) in chronological order
  const currentQuarterPeriods = [];
  
  // Always get exactly 3 months: the 2 months before target month + target month
  for (let i = 2; i >= 0; i--) {
    const monthDate = new Date(targetMonth);
    monthDate.setMonth(monthDate.getMonth() - i);
    const period = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    currentQuarterPeriods.push(period);
  }
  
  // Generate extended historical period for "Last Year" to include all sample data
  // Include 15+ months from 2024-04 to show complete historical trends
  const yearPeriods = [];
  
  // Start from April 2024 to capture all historical sample data
  const historicalStart = new Date(2024, 3, 1); // April 2024 (month is 0-indexed)
  const currentDate = new Date(targetMonth);
  
  // Generate all months from historical start to target month
  const tempDate = new Date(historicalStart);
  while (tempDate <= currentDate) {
    const monthPeriod = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
    yearPeriods.push(monthPeriod);
    tempDate.setMonth(tempDate.getMonth() + 1);
  }
  
  logger.info("Generated dynamic period mapping", {
    currentPeriod,
    lastMonthPeriod,
    currentQuarterPeriods,
    yearPeriodsCount: yearPeriods.length,
    yearPeriodsRange: yearPeriods.length > 0 ? `${yearPeriods[0]} to ${yearPeriods[yearPeriods.length - 1]}` : 'none'
  });
  
  return {
    "Last Month": [currentPeriod], // Last complete month
    "Last Quarter": currentQuarterPeriods, // Current quarter (up to 3 months, ending with last complete month)
    "Last Year": yearPeriods, // Last 12 months ending with last complete month
    "Custom Date Range": [currentPeriod] // Default to last complete month for custom ranges
  };
}

/**
 * Get display labels for time periods
 */
export function getTimePeriodDisplayLabels(): Record<string, string> {
  const now = new Date();
  
  // Last Month display
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthDisplay = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Current Quarter display
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterDisplay = `Q${currentQuarter} ${now.getFullYear()}`;
  
  // Last Year display (12 months ending last month)
  const yearStart = new Date(now);
  yearStart.setMonth(yearStart.getMonth() - 12);
  const yearEnd = new Date(now);
  yearEnd.setMonth(yearEnd.getMonth() - 1);
  const yearDisplay = `${yearStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${yearEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  
  return {
    "Last Month": lastMonthDisplay,
    "Last Quarter": quarterDisplay,
    "Last Year": yearDisplay
  };
}

/**
 * Generate period labels for chart display
 */
export function generateChartPeriodLabels(periods: string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  
  periods.forEach(period => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    
    // Format as "Jan 25", "Feb 25", etc.
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const shortYear = year.slice(-2);
    labels[period] = `${monthNames[parseInt(month) - 1]} ${shortYear}`;
  });
  
  return labels;
}

/**
 * Check if we need to generate sample data for a new time period
 */
export function shouldGenerateDataForCurrentPeriod(): { needed: boolean; period: string } {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // For demo purposes, we'll generate data for the current month when it changes
  return {
    needed: true, // Always true for dynamic generation
    period: currentPeriod
  };
}

/**
 * Get the most recent available data period from the database
 */
export async function getMostRecentDataPeriod(storage: { getMetricsByClient: (clientId: string) => Promise<Array<{ timePeriod: string }>> }, clientId: string): Promise<string | null> {
  try {
    // This would need to be implemented in storage to get the latest period with data
    // For now, we'll return null and let the system use the dynamic periods
    return null;
  } catch (error) {
    logger.error("Error getting most recent data period", { error: (error as Error).message });
    return null;
  }
}