import logger from "../logging/logger";
import { seededRandom, generateCompositeSeed, createPeriodSeed, applyBusinessSizeVariation } from "@shared/seededRandom";

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

// Use centralized time period generation
export { generateTimePeriods } from './timePeriodsGenerator';

// Generate realistic metric values with variations
export function generateMetricValue(
  config: MetricConfig,
  sourceType: string,
  timePeriod: string,
  timePeriods: string[],
  businessSize?: string,
  industryVertical?: string,
  competitorId?: string
): number {
  const currentPeriodIndex = timePeriods.indexOf(timePeriod);
  const periodSeed = createPeriodSeed(timePeriod, currentPeriodIndex);
  
  const range = config.ranges[sourceType as keyof typeof config.ranges];
  if (!range) {
    logger.warn(`No range found for sourceType: ${sourceType}`);
    return 0;
  }
  
  // Enhanced variation using consolidated seeded random generation
  let sourceSeed = generateCompositeSeed(
    periodSeed * 5 + currentPeriodIndex * 100,
    sourceType,
    industryVertical,
    competitorId
  );
  
  // Apply business size variation using consolidated logic - adds MAJOR multipliers for visual impact
  if (businessSize && sourceType === 'Industry_Avg') {
    sourceSeed = applyBusinessSizeVariation(sourceSeed, businessSize);
  }
  
  const randomFactor = seededRandom(sourceSeed);
  
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
  
  // Period-specific variations for clear differentiation across ALL 15 months
  let periodVariation = 0;
  if (config.name === "Session Duration") {
    const sessionVariations = [20, 10, 0, -10, -25, -15, -5, 5, 15, 25, 10, -5, -20, -10, 0];
    periodVariation = sessionVariations[currentPeriodIndex] || 0;
  } else if (config.name === "Bounce Rate") {
    const bounceVariations = [-3, -1, 1, 3, 5, 2, -2, -4, 0, 4, -1, 3, -3, 1, -2];
    periodVariation = bounceVariations[currentPeriodIndex] || 0;
  } else if (config.name === "Pages per Session") {
    const pagesVariations = [0.3, 0.1, -0.1, 0.2, -0.5, -0.2, 0.4, 0.0, -0.3, 0.5, 0.1, -0.4, 0.2, -0.1, 0.3];
    periodVariation = pagesVariations[currentPeriodIndex] || 0;
  } else if (config.name === "Sessions per User") {
    const sessionsVariations = [0.3, 0.1, -0.1, 0.2, -0.5, 0.4, -0.2, 0.1, -0.3, 0.6, -0.1, 0.2, -0.4, 0.3, -0.2];
    periodVariation = sessionsVariations[currentPeriodIndex] || 0;
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