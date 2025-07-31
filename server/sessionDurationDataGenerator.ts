import { storage } from "./storage";

// Generate realistic session duration data for all time periods and source types
export async function generateSessionDurationData() {
  console.log("Generating session duration sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  // Base session duration ranges in seconds (3-5 minutes)
  const sessionDurationRanges = {
    "Client": { min: 240, max: 320 },      // 4-5.3 minutes (good engagement)
    "Industry_Avg": { min: 180, max: 270 }, // 3-4.5 minutes (average)
    "CD_Avg": { min: 200, max: 290 }       // 3.3-4.8 minutes (CD client average)
  };
  
  try {
    for (const timePeriod of timePeriods) {
      // Create time-based variance (seasonal effects)
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length;
      const seasonalFactor = Math.sin(periodSeed * 0.15) * 20; // ±20 seconds seasonal variation
      
      for (const sourceType of sourceTypes) {
        const range = sessionDurationRanges[sourceType as keyof typeof sessionDurationRanges];
        
        // Generate realistic varied session duration with time-based changes
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 3;
        const randomFactor = (Math.sin(sourceSeed * 1.234) + 1) / 2; // 0-1 range
        
        // Add time period specific variation
        const timeVariation = timePeriod.includes('2024') ? -15 : 
                            timePeriod.includes('-04') ? 10 : 
                            timePeriod.includes('-05') ? 5 : 0;
        
        const baseValue = range.min + (range.max - range.min) * randomFactor;
        const finalValue = Math.max(120, Math.min(400, Math.round(baseValue + seasonalFactor + timeVariation)));
        
        await storage.createMetric({
          clientId,
          metricName: "Session Duration",
          value: finalValue,
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        const minutes = Math.round((finalValue / 60) * 10) / 10;
        console.log(`Created session duration: ${sourceType} ${timePeriod} = ${finalValue}s (${minutes} min)`);
      }
    }
    
    console.log("Session duration data generation completed");
    return { success: true, message: "Session duration sample data generated successfully" };
    
  } catch (error) {
    console.error("Error generating session duration data:", error);
    throw error;
  }
}