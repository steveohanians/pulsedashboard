import { storage } from "./storage";
import logger from "./utils/logger";

// Generate realistic bounce rate data for all time periods and source types
export async function generateBounceRateData() {
  logger.info("Generating bounce rate sample data");
  
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
  
  // Base bounce rate ranges (percentages) with enhanced variation
  const bounceRateRanges = {
    "Client": { min: 38, max: 48 },        // 38-48% (good client performance)
    "Industry_Avg": { min: 48, max: 58 },  // 48-58% (industry baseline)
    "CD_Avg": { min: 52, max: 62 }         // 52-62% (CD portfolio avg)
  };
  
  try {
    // Clear existing bounce rate data
    await storage.clearMetricsByName("Bounce Rate");
    
    for (const timePeriod of timePeriods) {
      // Create significant time-based variance for better chart visualization
      const periodIndex = timePeriods.indexOf(timePeriod);
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length + periodIndex * 200;
      
      // Strong seasonal effects with period-specific variations
      const seasonalFactor = Math.sin(periodSeed * 0.2) * 6; // ±6% significant variation
      
      // Clear year-over-year and monthly trends
      const yearTrend = timePeriod.includes('2024') ? 4 : -2; // 2024 higher bounce rates
      const monthTrend = periodIndex * 0.5; // Progressive change over time
      
      for (const sourceType of sourceTypes) {
        const range = bounceRateRanges[sourceType as keyof typeof bounceRateRanges];
        
        // Enhanced variation with period-specific seeds
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 5 + periodIndex * 100;
        const randomFactor = (Math.sin(sourceSeed * 2.789) + 1) / 2; // 0-1 range
        
        // Period-specific variations for clear differentiation
        let periodVariation = 0;
        const periodIndex = timePeriods.indexOf(timePeriod);
        if (periodIndex === 0) periodVariation = -3; // Current period - Best recent performance
        if (periodIndex === 1) periodVariation = -1; // Last month
        if (periodIndex === 2) periodVariation = 1;  // 2 months ago
        if (periodIndex === 3) periodVariation = 3;  // Older period
        if (periodIndex === 4) periodVariation = 5;  // Oldest period - Worst historical performance
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + monthTrend + periodVariation;
        
        // Ensure realistic bounds (25% - 75% bounce rate)
        finalValue = Math.max(25, Math.min(75, finalValue));
        
        // Round to whole number for percentage
        finalValue = Math.round(finalValue);
        
        await storage.createMetric({
          clientId,
          metricName: "Bounce Rate",
          value: finalValue.toString(),
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        logger.debug(`Generated Bounce Rate: ${sourceType} ${timePeriod} = ${finalValue}%`);
      }
    }
    
    logger.info("Bounce rate data generation completed");
    return { success: true, message: "Bounce rate sample data generated successfully" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating bounce rate data", { error: err.message, stack: err.stack });
    throw error;
  }
}