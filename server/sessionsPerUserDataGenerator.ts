import { storage } from "./storage";

// Generate realistic sessions per user data for all time periods and source types
export async function generateSessionsPerUserData() {
  console.log("Generating sessions per user sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-10", "2024-01"];
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
        if (timePeriod === '2025-06') periodVariation = 0.5;
        if (timePeriod === '2025-05') periodVariation = 0.2;
        if (timePeriod === '2025-04') periodVariation = -0.2;
        if (timePeriod === '2024-10') periodVariation = 0.4;
        if (timePeriod === '2024-01') periodVariation = -0.8;
        
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
        
        console.log(`Generated Sessions per User: ${sourceType} ${timePeriod} = ${finalValue}`);
      }
    }
    
    console.log("Sessions per user data generation completed successfully");
    return { success: true, message: "Sessions per user sample data generated" };
    
  } catch (error) {
    console.error("Error generating sessions per user data:", error);
    throw error;
  }
}