import { storage } from "./storage";
import logger from "./utils/logger";

// Generate realistic sessions per user data for all time periods and source types
export async function generateSessionsPerUserData() {
  logger.info("Generating sessions per user sample data");
  
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
  
  // Base sessions per user ranges with significant variation (realistic engagement metrics)
  const sessionsPerUserRanges = {
    "Client": { min: 2.8, max: 4.2 },        // 2.8-4.2 sessions (strong user retention)
    "Industry_Avg": { min: 1.9, max: 2.8 },  // 1.9-2.8 sessions (industry baseline)
    "CD_Avg": { min: 3.1, max: 3.8 }         // 3.1-3.8 sessions (CD portfolio avg)
  };
  
  try {
    // Clear existing sessions per user data
    await storage.clearMetricsByName("Sessions per User");
    
    for (const timePeriod of timePeriods) {
      // Create significant time-based variance for better chart visualization
      const periodIndex = timePeriods.indexOf(timePeriod);
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length + periodIndex * 150;
      
      // Strong seasonal effects with period-specific variations
      const seasonalFactor = Math.sin(periodSeed * 0.4) * 0.6; // ±0.6 sessions significant variation
      
      // Clear year-over-year growth and monthly trends
      const yearTrend = timePeriod.includes('2024') ? -0.6 : 0.4;
      const monthTrend = periodIndex * 0.15; // Progressive change over time
      
      for (const sourceType of sourceTypes) {
        const range = sessionsPerUserRanges[sourceType as keyof typeof sessionsPerUserRanges];
        
        // Enhanced variation with period-specific seeds
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 9 + periodIndex * 75;
        const randomFactor = (Math.sin(sourceSeed * 3.456) + 1) / 2; // 0-1 range
        
        // Period-specific variations for clear differentiation
        let periodVariation = 0;
        const periodIndex = timePeriods.indexOf(timePeriod);
        if (periodIndex === 0) periodVariation = 0.5; // Current period
        if (periodIndex === 1) periodVariation = 0.2; // Last month
        if (periodIndex === 2) periodVariation = -0.2; // 2 months ago
        if (periodIndex === 3) periodVariation = 0.4;  // Older period
        if (periodIndex === 4) periodVariation = -0.8; // Oldest period
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + monthTrend + periodVariation;
        
        // Ensure realistic bounds (1.3 - 5.5 sessions per user)
        finalValue = Math.max(1.3, Math.min(5.5, finalValue));
        
        // Round to 1 decimal place for realistic precision
        finalValue = Math.round(finalValue * 10) / 10;
        
        // Create the metric entry
        await storage.createMetric({
          clientId,
          metricName: "Sessions per User",
          value: finalValue.toString(),
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        logger.debug(`Generated Sessions per User: ${sourceType} ${timePeriod} = ${finalValue}`);
      }
    }
    
    logger.info("Sessions per user data generation completed successfully");
    return { success: true, message: "Sessions per user sample data generated" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating sessions per user data", { error: err.message, stack: err.stack });
    throw error;
  }
}