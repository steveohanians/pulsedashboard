// Dynamic date utilities for time period handling
// This ensures the dashboard automatically updates for new months/periods

import logger from "./logger";

/**
 * Generate dynamic time period mappings based on current date
 * This ensures the dashboard shows correct periods as time progresses
 */
export function generateDynamicPeriodMapping(): Record<string, string[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = January, 11 = December)
  
  // Generate current month period (YYYY-MM format)
  const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  // Generate last month period
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  // Generate current quarter periods
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
  const currentQuarterPeriods = [];
  for (let i = 0; i < 3; i++) {
    const quarterMonth = quarterStartMonth + i;
    if (quarterMonth <= currentMonth) {
      const quarterDate = new Date(currentYear, quarterMonth, 1);
      currentQuarterPeriods.push(`${quarterDate.getFullYear()}-${String(quarterDate.getMonth() + 1).padStart(2, '0')}`);
    }
  }
  
  // If current quarter is incomplete, include previous quarter's last months
  if (currentQuarterPeriods.length < 3) {
    const prevQuarterMonths = 3 - currentQuarterPeriods.length;
    for (let i = prevQuarterMonths; i > 0; i--) {
      const prevMonth = new Date(now);
      prevMonth.setMonth(prevMonth.getMonth() - i);
      const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      currentQuarterPeriods.unshift(prevPeriod);
    }
  }
  
  // Generate last 12 months for "Last Year"
  const yearPeriods = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - i);
    const monthPeriod = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    yearPeriods.push(monthPeriod);
  }
  
  logger.info("Generated dynamic period mapping", {
    currentPeriod,
    lastMonthPeriod,
    currentQuarterPeriods,
    yearPeriodsCount: yearPeriods.length
  });
  
  return {
    "Last Month": [lastMonthPeriod], // Previous month
    "Last Quarter": currentQuarterPeriods, // Current quarter (up to 3 months)
    "Last Year": yearPeriods, // Last 12 months
    "Custom Date Range": [lastMonthPeriod] // Default to last month for custom ranges
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
export async function getMostRecentDataPeriod(storage: any, clientId: string): Promise<string | null> {
  try {
    // This would need to be implemented in storage to get the latest period with data
    // For now, we'll return null and let the system use the dynamic periods
    return null;
  } catch (error) {
    logger.error("Error getting most recent data period", { error: (error as Error).message });
    return null;
  }
}