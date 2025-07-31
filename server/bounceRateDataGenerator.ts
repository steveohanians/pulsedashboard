import { storage } from "./storage";

// Generate realistic bounce rate data for all time periods and source types
export async function generateBounceRateData() {
  console.log("Generating bounce rate sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  // Base bounce rates (realistic business values)
  const bounceRateRanges = {
    "Client": { min: 35, max: 50 },      // Good performance
    "Industry_Avg": { min: 45, max: 65 }, // Industry average
    "CD_Avg": { min: 40, max: 58 }        // CD client average
  };
  
  try {
    for (const timePeriod of timePeriods) {
      // Create time-based variance (seasonal effects)
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length;
      const seasonalFactor = Math.sin(periodSeed * 0.1) * 3; // ±3% seasonal variation
      
      for (const sourceType of sourceTypes) {
        const range = bounceRateRanges[sourceType as keyof typeof bounceRateRanges];
        
        // Generate consistent but varied bounce rate
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed;
        const randomFactor = (Math.sin(sourceSeed * 1.234) + 1) / 2; // 0-1 range
        
        const baseValue = range.min + (range.max - range.min) * randomFactor;
        const finalValue = Math.max(25, Math.min(75, Math.round(baseValue + seasonalFactor)));
        
        await storage.createMetric({
          clientId,
          metricName: "Bounce Rate",
          value: finalValue,
          sourceType,
          timePeriod
        });
        
        console.log(`Created bounce rate: ${sourceType} ${timePeriod} = ${finalValue}%`);
      }
    }
    
    console.log("Bounce rate data generation completed");
    return { success: true, message: "Bounce rate sample data generated successfully" };
    
  } catch (error) {
    console.error("Error generating bounce rate data:", error);
    throw error;
  }
}