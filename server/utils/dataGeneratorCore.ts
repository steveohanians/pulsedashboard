import logger from "./logger";

// Core utility functions for data generation
export interface MetricConfig {
  name: string;
  ranges: {
    Client: { min: number; max: number };
    Industry_Avg: { min: number; max: number };
    CD_Avg: { min: number; max: number };
  };
  unit?: string;
  precision?: number;
  bounds?: { min: number; max: number };
}

// Generate dynamic time periods (DEPRECATED - use sampleDataGenerator.generateTimePeriods instead)
// This function generates only 5 periods and is being phased out
export function generateTimePeriods(): string[] {
  // Import the centralized 15-month generator
  const { generateTimePeriods: generateCentralized } = require('../sampleDataGenerator');
  return generateCentralized();
}

// Generate realistic metric values with variations
export function generateMetricValue(
  config: MetricConfig,
  sourceType: string,
  timePeriod: string,
  timePeriods: string[]
): number {
  const currentPeriodIndex = timePeriods.indexOf(timePeriod);
  const periodSeed = timePeriod.charCodeAt(0) + timePeriod.length + currentPeriodIndex * 100;
  
  const range = config.ranges[sourceType as keyof typeof config.ranges];
  if (!range) {
    logger.warn(`No range found for sourceType: ${sourceType}`);
    return 0;
  }
  
  // Enhanced variation with period-specific seeds
  const sourceSeed = sourceType.charCodeAt(0) + periodSeed * 5 + currentPeriodIndex * 100;
  const randomFactor = (Math.sin(sourceSeed * 2.789) + 1) / 2; // 0-1 range
  
  // Strong seasonal effects based on metric type
  const seasonalVariance = config.name === "Session Duration" ? 45 : 
                          config.name === "Bounce Rate" ? 6 : 
                          config.name === "Pages per Session" ? 0.5 : 0.6;
  const seasonalFactor = Math.sin(periodSeed * 0.25) * seasonalVariance;
  
  // Year-over-year trends
  const yearTrend = timePeriod.includes('2024') ? 
    (config.name === "Session Duration" ? -15 : 
     config.name === "Bounce Rate" ? 4 : -0.4) : 
    (config.name === "Session Duration" ? 10 : 
     config.name === "Bounce Rate" ? -2 : 0.3);
  
  // Monthly trends
  const monthTrend = currentPeriodIndex * (
    config.name === "Session Duration" ? 3 : 
    config.name === "Bounce Rate" ? 0.5 : 0.1
  );
  
  // Period-specific variations for clear differentiation
  let periodVariation = 0;
  if (config.name === "Session Duration") {
    if (currentPeriodIndex === 0) periodVariation = 20;
    if (currentPeriodIndex === 1) periodVariation = 10;
    if (currentPeriodIndex === 2) periodVariation = 0;
    if (currentPeriodIndex === 3) periodVariation = -10;
    if (currentPeriodIndex === 4) periodVariation = -25;
  } else if (config.name === "Bounce Rate") {
    if (currentPeriodIndex === 0) periodVariation = -3;
    if (currentPeriodIndex === 1) periodVariation = -1;
    if (currentPeriodIndex === 2) periodVariation = 1;
    if (currentPeriodIndex === 3) periodVariation = 3;
    if (currentPeriodIndex === 4) periodVariation = 5;
  } else {
    // Pages per Session and Sessions per User
    const variations = [0.3, 0.1, -0.1, 0.2, -0.5];
    periodVariation = variations[currentPeriodIndex] || 0;
  }
  
  const baseValue = range.min + (randomFactor * (range.max - range.min));
  let finalValue = baseValue + seasonalFactor + yearTrend + monthTrend + periodVariation;
  
  // Apply bounds if specified
  if (config.bounds) {
    finalValue = Math.max(config.bounds.min, Math.min(config.bounds.max, finalValue));
  }
  
  // Apply precision
  const precision = config.precision || 0;
  finalValue = Math.round(finalValue * Math.pow(10, precision)) / Math.pow(10, precision);
  
  return finalValue;
}

// Metric configurations
export const METRIC_CONFIGS: MetricConfig[] = [
  {
    name: "Bounce Rate",
    ranges: {
      Client: { min: 38, max: 48 },
      Industry_Avg: { min: 48, max: 58 },
      CD_Avg: { min: 52, max: 62 }
    },
    bounds: { min: 25, max: 75 }
  },
  {
    name: "Session Duration",
    ranges: {
      Client: { min: 200, max: 320 },
      Industry_Avg: { min: 150, max: 240 },
      CD_Avg: { min: 170, max: 290 }
    },
    bounds: { min: 120, max: 400 }
  },
  {
    name: "Pages per Session",
    ranges: {
      Client: { min: 2.2, max: 3.1 },
      Industry_Avg: { min: 1.6, max: 2.2 },
      CD_Avg: { min: 2.4, max: 2.9 }
    },
    bounds: { min: 1.2, max: 3.8 },
    precision: 1
  },
  {
    name: "Sessions per User",
    ranges: {
      Client: { min: 2.8, max: 4.2 },
      Industry_Avg: { min: 1.9, max: 2.8 },
      CD_Avg: { min: 3.1, max: 3.8 }
    },
    bounds: { min: 1.3, max: 5.5 },
    precision: 1
  }
];

// Get metric configuration by name
export function getMetricConfig(metricName: string): MetricConfig | undefined {
  return METRIC_CONFIGS.find(config => config.name === metricName);
}