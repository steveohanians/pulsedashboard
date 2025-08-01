import { storage } from "./storage";
import logger from "./utils/logger";

// Generate realistic pages per session data for all time periods and source types
export async function generatePagesPerSessionData() {
  logger.info("Generating pages per session sample data");
  
  const { getDefaultClientId } = await import('./config');
  const clientId = getDefaultClientId();
  // Generate dynamic time periods
  function generateTimePeriods(): string[] {
    const now = new Date();
    const periods: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    
    const prevYear = new Date(now);
    prevYear.setFullYear(prevYear.getFullYear() - 1);
    periods.push(`${prevYear.getFullYear()}-${String(prevYear.getMonth() + 1).padStart(2, '0')}`);
    
    const prevQuarter = new Date(now);
    prevQuarter.setMonth(prevQuarter.getMonth() - 6);
    periods.push(`${prevQuarter.getFullYear()}-${String(prevQuarter.getMonth() + 1).padStart(2, '0')}`);
    
    return Array.from(new Set(periods));
  }
  
  const timePeriods = generateTimePeriods();
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  // Base pages per session ranges with more variation (realistic engagement metrics)
  const pagesPerSessionRanges = {
    "Client": { min: 2.2, max: 3.1 },        // 2.2-3.1 pages (good client performance)
    "Industry_Avg": { min: 1.6, max: 2.2 },  // 1.6-2.2 pages (industry baseline)
    "CD_Avg": { min: 2.4, max: 2.9 }         // 2.4-2.9 pages (CD portfolio avg)
  };
  
  try {
    // Clear existing pages per session data
    await storage.clearMetricsByName("Pages per Session");
    
    for (const timePeriod of timePeriods) {
      // Create significant time-based variance for better chart visualization
      const periodIndex = timePeriods.indexOf(timePeriod);
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length + periodIndex * 100;
      
      // Strong seasonal effects with period-specific variations
      const seasonalFactor = Math.sin(periodSeed * 0.3) * 0.5; // ±0.5 pages significant variation
      
      // Clear year-over-year and monthly trends
      const yearTrend = timePeriod.includes('2024') ? -0.4 : 0.3;
      const monthTrend = periodIndex * 0.1; // Progressive change over time
      
      for (const sourceType of sourceTypes) {
        const range = pagesPerSessionRanges[sourceType as keyof typeof pagesPerSessionRanges];
        
        // Enhanced variation with period-specific seeds
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 7 + periodIndex * 50;
        const randomFactor = (Math.sin(sourceSeed * 2.345) + 1) / 2; // 0-1 range
        
        // Period-specific variations for clear differentiation
        let periodVariation = 0;
        const periodIndex = timePeriods.indexOf(timePeriod);
        if (periodIndex === 0) periodVariation = 0.3; // Current period
        if (periodIndex === 1) periodVariation = 0.1; // Last month
        if (periodIndex === 2) periodVariation = -0.1; // 2 months ago
        if (periodIndex === 3) periodVariation = 0.2;  // Older period
        if (periodIndex === 4) periodVariation = -0.5; // Oldest period
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + monthTrend + periodVariation;
        
        // Ensure realistic bounds (1.2 - 3.8 pages per session)
        finalValue = Math.max(1.2, Math.min(3.8, finalValue));
        
        // Round to 1 decimal place for realistic precision
        finalValue = Math.round(finalValue * 10) / 10;
        
        // Create the metric entry
        await storage.createMetric({
          clientId,
          metricName: "Pages per Session",
          value: finalValue.toString(),
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        logger.debug(`Generated Pages per Session: ${sourceType} ${timePeriod} = ${finalValue}`);
      }
    }
    
    logger.info("Pages per session data generation completed successfully");
    return { success: true, message: "Pages per session sample data generated" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating pages per session data", { error: err.message, stack: err.stack });
    throw error;
  }
}