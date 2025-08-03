// Consolidated seeded random number generation utilities
// Eliminates duplicate Math.sin-based random generation patterns across multiple files

/**
 * Generate a seeded random number between 0 and 1 using sine function
 * This provides consistent, reproducible random numbers for data generation
 */
export function seededRandom(seed: number): number {
  return (Math.sin(seed * 2.789) + 1) / 2; // 0-1 range
}

/**
 * Generate a seeded random number within a specific range
 */
export function seededRandomRange(seed: number, min: number, max: number): number {
  const randomFactor = seededRandom(seed);
  return min + (randomFactor * (max - min));
}

/**
 * Generate seeded variance for data with base value and variance
 * Used for traffic channels, device distribution, etc.
 */
export function seededVariance(seed: number, baseValue: number, variance: number): number {
  const factor = (Math.sin(seed * baseValue) - 0.5) * variance;
  return Math.max(1, baseValue + factor);
}

/**
 * Generate composite seed from multiple string/number inputs
 * Consolidates the common pattern of combining various factors into a seed
 */
export function generateCompositeSeed(
  baseSeed: number,
  ...factors: Array<string | number | undefined>
): number {
  let compositeSeed = baseSeed;
  
  factors.forEach((factor, index) => {
    if (factor !== undefined) {
      if (typeof factor === 'string') {
        compositeSeed += factor.charCodeAt(0) * (index + 1) * 7;
      } else {
        compositeSeed += factor * (index + 1) * 11;
      }
    }
  });
  
  return compositeSeed;
}

/**
 * Create time-based seed from period string (YYYY-MM format)
 * Consolidates period-based seed generation
 */
export function createPeriodSeed(timePeriod: string, periodIndex: number): number {
  return timePeriod.charCodeAt(0) + timePeriod.length + periodIndex * 100;
}

/**
 * Normalize array of values to sum to target total (e.g., 100 for percentages)
 * Common pattern used in traffic channels and device distribution
 */
export function normalizeToTotal(values: number[], targetTotal: number = 100): number[] {
  const currentTotal = values.reduce((sum, val) => sum + val, 0);
  const normalized = values.map(val => Math.round((val / currentTotal) * targetTotal));
  
  // Ensure total is exactly the target by adjusting the largest value
  const adjustedTotal = normalized.reduce((sum, val) => sum + val, 0);
  if (adjustedTotal !== targetTotal) {
    const maxIndex = normalized.indexOf(Math.max(...normalized));
    normalized[maxIndex] += (targetTotal - adjustedTotal);
  }
  
  return normalized;
}

/**
 * Business size multipliers for creating dramatic seed variations
 * Consolidates the business size variation logic used in metric generation
 */
export const BUSINESS_SIZE_MULTIPLIERS = {
  'Small Business': 5000,
  'Mid-Market': 10000,
  'Enterprise': 15000,
  'Global Enterprise': 20000,
} as const;

/**
 * Apply business size seed variation
 */
export function applyBusinessSizeVariation(baseSeed: number, businessSize?: string): number {
  if (!businessSize) return baseSeed;
  
  const baseVariation = businessSize.charCodeAt(0) * 7;
  const multiplier = Object.entries(BUSINESS_SIZE_MULTIPLIERS)
    .find(([key]) => businessSize.includes(key))?.[1] || 0;
  
  return baseSeed + baseVariation + multiplier;
}