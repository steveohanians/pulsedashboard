import { storage } from "./storage";

// Generate realistic sessions per user data for all time periods and source types
export async function generateSessionsPerUserData() {
  console.log("Generating sessions per user sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
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
      // Create time-based variance with seasonal and trend effects
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length;
      const seasonalFactor = Math.sin(periodSeed * 0.15) * 0.4; // ±0.4 sessions seasonal variation
      
      // Add year-over-year growth trend (2024 lower, 2025 higher)
      const yearTrend = timePeriod.includes('2024') ? -0.3 : 0.2;
      
      for (const sourceType of sourceTypes) {
        const range = sessionsPerUserRanges[sourceType as keyof typeof sessionsPerUserRanges];
        
        // Generate realistic varied sessions per user with time-based changes
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 3;
        const randomFactor = (Math.sin(sourceSeed * 1.789) + 1) / 2; // 0-1 range
        
        // Add month-specific variations (Q4 higher due to holidays)
        const monthVariation = timePeriod === '2024-Q4' ? 0.3 : 0;
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + monthVariation;
        
        // Ensure realistic bounds (1.5 - 5.0 sessions per user)
        finalValue = Math.max(1.5, Math.min(5.0, finalValue));
        
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