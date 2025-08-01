// Fix missing sample data - ensure all metrics exist for all source types
import { storage } from "./storage";
import logger from "./utils/logger";

const TIME_PERIODS = ["2025-06", "2025-05", "2025-04", "2024-10", "2024-01"];
const SOURCE_TYPES = ["Client", "Industry_Avg", "CD_Avg"];
const CLIENT_ID = "demo-client-id";

// Generate device distribution data
function generateDeviceDistribution(seed: number) {
  const desktop = 50 + (Math.sin(seed * 1.1) * 15);
  const mobile = 40 + (Math.sin(seed * 2.2) * 12);
  const tablet = 10 + (Math.sin(seed * 3.3) * 3);
  
  const total = desktop + mobile + tablet;
  const desktopNorm = Math.round((desktop / total) * 100);
  const mobileNorm = Math.round((mobile / total) * 100);
  const tabletNorm = 100 - desktopNorm - mobileNorm;

  return [
    { name: "Desktop", value: desktopNorm, percentage: desktopNorm, color: "#3b82f6" },
    { name: "Mobile", value: mobileNorm, percentage: mobileNorm, color: "#10b981" },
    { name: "Tablet", value: tabletNorm, percentage: tabletNorm, color: "#8b5cf6" }
  ];
}

export async function fixMissingDeviceData() {
  logger.info("Fixing missing Device Distribution data");
  
  try {
    // Check what Device Distribution data exists
    const existingDeviceData = await storage.getMetricsByName("Device Distribution");
    const existingCombinations = new Set(
      existingDeviceData.map(d => `${d.sourceType}_${d.timePeriod}`)
    );
    
    logger.info("Existing Device Distribution combinations:", { count: existingCombinations.size });
    
    // Generate missing Device Distribution data
    for (const timePeriod of TIME_PERIODS) {
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.charCodeAt(1);
      
      for (const sourceType of SOURCE_TYPES) {
        const sourceSeed = periodSeed + sourceType.charCodeAt(0);
        const combination = `${sourceType}_${timePeriod}`;
        
        if (!existingCombinations.has(combination)) {
          logger.info(`Generating missing Device Distribution data for ${sourceType} in ${timePeriod}`);
          
          const deviceData = generateDeviceDistribution(sourceSeed + 200);
          
          for (const device of deviceData) {
            await storage.createMetric({
              clientId: CLIENT_ID,
              metricName: "Device Distribution",
              value: device.value,
              sourceType: sourceType as any,
              timePeriod,
              channel: device.name
            });
          }
        }
      }
    }
    
    logger.info("Device Distribution data fix completed");
    return { success: true, message: "Missing Device Distribution data generated" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error fixing Device Distribution data", { error: err.message });
    throw error;
  }
}

export async function validateAllMetricsExist() {
  logger.info("Validating all metrics exist for all source types and time periods");
  
  try {
    const requiredMetrics = ["Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User", "Traffic Channels", "Device Distribution"];
    const issues: string[] = [];
    
    for (const metric of requiredMetrics) {
      for (const sourceType of SOURCE_TYPES) {
        for (const timePeriod of TIME_PERIODS) {
          const data = await storage.getMetrics(CLIENT_ID, metric, sourceType as any, timePeriod);
          
          if (metric === "Traffic Channels" || metric === "Device Distribution") {
            // These should have multiple entries (one per channel/device)
            if (data.length === 0) {
              issues.push(`Missing ${metric} data for ${sourceType} in ${timePeriod}`);
            }
          } else {
            // Standard metrics should have exactly one entry
            if (data.length === 0) {
              issues.push(`Missing ${metric} data for ${sourceType} in ${timePeriod}`);
            }
          }
        }
      }
    }
    
    logger.info("Metric validation completed", { 
      totalIssues: issues.length,
      issues: issues.slice(0, 10) // Log first 10 issues
    });
    
    return {
      success: issues.length === 0,
      issues,
      totalIssues: issues.length
    };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error validating metrics", { error: err.message });
    throw error;
  }
}