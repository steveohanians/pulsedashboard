import { storage } from "./storage";
import logger from "./utils/logger";

// Generate realistic session duration data for all time periods and source types
export async function generateSessionDurationData() {
  logger.info("Generating session duration sample data");
  
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
  
  // Base session duration ranges (in seconds) with enhanced variation
  const sessionDurationRanges = {
    "Client": { min: 200, max: 320 },      // 3.3-5.3 minutes (good client engagement)
    "Industry_Avg": { min: 150, max: 240 }, // 2.5-4 minutes (industry baseline)
    "CD_Avg": { min: 170, max: 290 }        // 2.8-4.8 minutes (CD portfolio average)
  };
  
  try {
    // Clear existing session duration data
    await storage.clearMetricsByName("Session Duration");
    
    for (const timePeriod of timePeriods) {
      // Create significant time-based variance for better chart visualization
      const periodIndex = timePeriods.indexOf(timePeriod);
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length + periodIndex * 150;
      
      // Strong seasonal effects with period-specific variations
      const seasonalFactor = Math.sin(periodSeed * 0.25) * 45; // ±45 seconds significant variation
      
      // Clear year-over-year and monthly trends
      const yearTrend = timePeriod.includes('2024') ? -15 : 10; // 2024 lower engagement
      const monthTrend = periodIndex * 3; // Progressive improvement over time
      
      for (const sourceType of sourceTypes) {
        const range = sessionDurationRanges[sourceType as keyof typeof sessionDurationRanges];
        
        // Enhanced variation with period-specific seeds
        const currentPeriodIndex = timePeriods.indexOf(timePeriod);
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 7 + currentPeriodIndex * 80;
        const randomFactor = (Math.sin(sourceSeed * 3.456) + 1) / 2; // 0-1 range
        
        // Period-specific variations for clear differentiation
        let periodVariation = 0;
        if (currentPeriodIndex === 0) periodVariation = 20; // Current period - Best recent performance
        if (currentPeriodIndex === 1) periodVariation = 10; // Last month
        if (currentPeriodIndex === 2) periodVariation = 0;  // 2 months ago
        if (currentPeriodIndex === 3) periodVariation = -10; // Older period
        if (currentPeriodIndex === 4) periodVariation = -25; // Oldest period - Worst historical performance
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + monthTrend + periodVariation;
        
        // Ensure realistic bounds (2-7 minutes = 120-420 seconds)
        finalValue = Math.max(120, Math.min(420, finalValue));
        
        // Round to whole seconds
        finalValue = Math.round(finalValue);
        
        await storage.createMetric({
          clientId,
          metricName: "Session Duration",
          value: finalValue.toString(),
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        const minutes = Math.round((finalValue / 60) * 10) / 10;
        logger.debug(`Generated Session Duration: ${sourceType} ${timePeriod} = ${finalValue}s (${minutes} min)`);
      }
    }
    
    logger.info("Session duration data generation completed");
    return { success: true, message: "Session duration sample data generated successfully" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating session duration data", { error: err.message, stack: err.stack });
    throw error;
  }
}