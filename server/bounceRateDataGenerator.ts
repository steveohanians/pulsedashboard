import { storage } from "./storage";

// Generate realistic bounce rate data for all time periods and source types
export async function generateBounceRateData() {
  console.log("Generating bounce rate sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
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
        if (timePeriod === '2025-06') periodVariation = -3; // Best recent performance
        if (timePeriod === '2025-05') periodVariation = -1;
        if (timePeriod === '2025-04') periodVariation = 1;
        if (timePeriod === '2024-Q4') periodVariation = 3;
        if (timePeriod === '2024-01') periodVariation = 5; // Worst historical performance
        
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
        
        console.log(`Generated Bounce Rate: ${sourceType} ${timePeriod} = ${finalValue}%`);
      }
    }
    
    console.log("Bounce rate data generation completed");
    return { success: true, message: "Bounce rate sample data generated successfully" };
    
  } catch (error) {
    console.error("Error generating bounce rate data:", error);
    throw error;
  }
}