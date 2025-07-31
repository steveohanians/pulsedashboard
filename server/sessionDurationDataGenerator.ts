import { storage } from "./storage";

// Generate realistic session duration data for all time periods and source types
export async function generateSessionDurationData() {
  console.log("Generating session duration sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-10", "2024-01"];
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
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 7 + periodIndex * 80;
        const randomFactor = (Math.sin(sourceSeed * 3.456) + 1) / 2; // 0-1 range
        
        // Period-specific variations for clear differentiation
        let periodVariation = 0;
        if (timePeriod === '2025-06') periodVariation = 20; // Best recent performance
        if (timePeriod === '2025-05') periodVariation = 10;
        if (timePeriod === '2025-04') periodVariation = 0;
        if (timePeriod === '2024-10') periodVariation = -10;
        if (timePeriod === '2024-01') periodVariation = -25; // Worst historical performance
        
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
        console.log(`Generated Session Duration: ${sourceType} ${timePeriod} = ${finalValue}s (${minutes} min)`);
      }
    }
    
    console.log("Session duration data generation completed");
    return { success: true, message: "Session duration sample data generated successfully" };
    
  } catch (error) {
    console.error("Error generating session duration data:", error);
    throw error;
  }
}