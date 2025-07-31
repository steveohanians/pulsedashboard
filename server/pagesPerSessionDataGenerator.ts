import { storage } from "./storage";

// Generate realistic pages per session data for all time periods and source types
export async function generatePagesPerSessionData() {
  console.log("Generating pages per session sample data...");
  
  const clientId = "demo-client-id";
  const timePeriods = ["2025-06", "2025-05", "2025-04", "2024-Q4", "2024-01"];
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  // Base pages per session ranges with more variation (realistic engagement metrics)
  const pagesPerSessionRanges = {
    "Client": { min: 2.2, max: 3.1 },        // 2.2-3.1 pages (good client performance)
    "Industry_Avg": { min: 1.6, max: 2.2 },  // 1.6-2.2 pages (industry baseline)
    "CD_Avg": { min: 2.4, max: 2.9 }         // 2.4-2.9 pages (CD portfolio avg)
  };
  
  try {
    // Clear existing pages per session data
    await storage.clearMetricsByName("Pages per Session");
    
    for (const timePeriod of timePeriods) {
      // Create time-based variance with stronger seasonal effects
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length;
      const seasonalFactor = Math.sin(periodSeed * 0.18) * 0.3; // ±0.3 pages seasonal variation
      
      // Add year-over-year improvement trend
      const yearTrend = timePeriod.includes('2024') ? -0.2 : 0.1;
      
      for (const sourceType of sourceTypes) {
        const range = pagesPerSessionRanges[sourceType as keyof typeof pagesPerSessionRanges];
        
        // Generate realistic varied pages per session with enhanced time-based changes
        const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 2;
        const randomFactor = (Math.sin(sourceSeed * 1.456) + 1) / 2; // 0-1 range
        
        // Add quarterly variations (Q4 typically higher engagement)
        const quarterVariation = timePeriod === '2024-Q4' ? 0.2 : 0;
        
        const baseValue = range.min + (randomFactor * (range.max - range.min));
        let finalValue = baseValue + seasonalFactor + yearTrend + quarterVariation;
        
        // Ensure realistic bounds (1.4 - 3.5 pages per session)
        finalValue = Math.max(1.4, Math.min(3.5, finalValue));
        
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