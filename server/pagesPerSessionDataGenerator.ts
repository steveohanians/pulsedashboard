import { storage } from "./storage";

// Generate realistic pages per session data for all time periods and source types
export async function generatePagesPerSessionData() {
  console.log("Generating pages per session sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  // Base pages per session ranges (realistic engagement metrics)
  const pagesPerSessionRanges = {
    "Client": { min: 2.1, max: 2.8 },        // 2.1-2.8 pages (good engagement)
    "Industry_Avg": { min: 1.8, max: 2.3 },  // 1.8-2.3 pages (industry average)
    "CD_Avg": { min: 2.0, max: 2.6 }         // 2.0-2.6 pages (CD client average)
  };
  
  try {
    for (const timePeriod of timePeriods) {
      // Create time-based variance (seasonal effects)
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length;
      const seasonalFactor = Math.sin(periodSeed * 0.12) * 0.2; // ±0.2 pages seasonal variation
      
      for (const sourceType of sourceTypes) {
        const range = pagesPerSessionRanges[sourceType as keyof typeof pagesPerSessionRanges];
        
        // Generate realistic varied pages per session with time-based changes
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 2;
        const randomFactor = (Math.sin(sourceSeed * 1.456) + 1) / 2; // 0-1 range
        
        // Add time period specific variation (older periods slightly lower)
        const timeVariation = timePeriod.includes('2024') ? -0.1 : 0;
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + timeVariation;
        
        // Ensure realistic bounds (1.5 - 3.5 pages per session)
        finalValue = Math.max(1.5, Math.min(3.5, finalValue));
        
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
        
        console.log(`Generated Pages per Session: ${sourceType} ${timePeriod} = ${finalValue}`);
      }
    }
    
    console.log("Pages per session data generation completed successfully");
    return { success: true, message: "Pages per session sample data generated" };
    
  } catch (error) {
    console.error("Error generating pages per session data:", error);
    throw error;
  }
}