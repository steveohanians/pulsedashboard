import { storage } from "./storage";
import logger from "./utils/logger";
import { generateTimePeriods, generateMetricValue, getMetricConfig } from "./utils/dataGeneratorCore";

// Consolidated data generator for all individual metrics
export async function generateMetricData(metricName: string) {
  logger.info(`Generating ${metricName} sample data`);
  
  const { getDefaultClientId } = await import('./config');
  const clientId = getDefaultClientId();
  
  const config = getMetricConfig(metricName);
  if (!config) {
    logger.error(`No configuration found for metric: ${metricName}`);
    throw new Error(`Unsupported metric: ${metricName}`);
  }
  
  const timePeriods = generateTimePeriods();
  const sourceTypes = ["Client", "Industry_Avg", "CD_Avg"];
  
  try {
    // Clear existing metric data
    await storage.clearMetricsByName(metricName);
    
    for (const timePeriod of timePeriods) {
      for (const sourceType of sourceTypes) {
        const value = generateMetricValue(config, sourceType, timePeriod, timePeriods);
        
        // Create the metric entry
        await storage.createMetric({
          clientId,
          metricName,
          value: value.toString(),
          sourceType: sourceType as "Client" | "Industry_Avg" | "CD_Avg",
          timePeriod
        });
        
        logger.debug(`Generated ${metricName}: ${sourceType} ${timePeriod} = ${value}`);
      }
    }
    
    logger.info(`${metricName} data generation completed successfully`);
    return { success: true, message: `${metricName} sample data generated` };
    
  } catch (error) {
    const err = error as Error;
    logger.error(`Error generating ${metricName} data`, { error: err.message });
    throw error;
  }
}

// Individual metric generators (now using consolidated logic)
export async function generateBounceRateData() {
  return await generateMetricData("Bounce Rate");
}

export async function generateSessionDurationData() {
  return await generateMetricData("Session Duration");
}

export async function generatePagesPerSessionData() {
  return await generateMetricData("Pages per Session");
}

export async function generateSessionsPerUserData() {
  return await generateMetricData("Sessions per User");
}