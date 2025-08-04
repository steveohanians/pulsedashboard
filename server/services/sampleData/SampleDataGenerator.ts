/**
 * Sample Data Generator
 * 
 * Generates realistic sample data with proper trends and variations.
 */

import logger from '../../utils/logger';
import { 
  METRIC_RANGES, 
  TREND_PATTERNS, 
  COMPETITOR_DOMAINS, 
  TRAFFIC_CHANNEL_BASELINES,
  DEVICE_DISTRIBUTION_BASELINE,
  METRIC_NAMES
} from './constants';
import type { 
  SampleMetricData, 
  TrendVariation, 
  CompetitorConfig,
  TrafficChannelDistribution,
  DeviceDistribution 
} from './types';

export class SampleDataGenerator {
  private seedBase: number;

  constructor(clientId: string) {
    // Create deterministic seed based on client ID for consistent data
    this.seedBase = this.hashString(clientId);
  }

  /**
   * Generate sample metrics for a specific period
   */
  generatePeriodMetrics(periodIndex: number, trendVariation: TrendVariation): SampleMetricData {
    const seed = this.seedBase + periodIndex;
    
    // Base metrics
    const baseMetrics = this.generateBaseMetrics(seed);
    
    // Apply trend over time
    const trendedMetrics = this.applyTrend(baseMetrics, periodIndex, trendVariation);
    
    // Add monthly variation
    const finalMetrics = this.addMonthlyVariation(trendedMetrics, seed);
    
    return finalMetrics;
  }

  /**
   * Generate competitor data
   */
  generateCompetitorMetrics(
    clientBaseline: SampleMetricData, 
    competitorIndex: number, 
    periodIndex: number
  ): SampleMetricData {
    // Create completely unique baseline per competitor by adding fixed offsets
    const competitorBaseline = {
      bounceRate: clientBaseline.bounceRate + (competitorIndex * 3) - 1.5,
      sessionDuration: clientBaseline.sessionDuration + (competitorIndex * 20) - 10,
      pagesPerSession: clientBaseline.pagesPerSession + (competitorIndex * 0.3) - 0.15,
      sessionsPerUser: clientBaseline.sessionsPerUser + (competitorIndex * 0.2) - 0.1
    };
    
    // Use large seed spacing to ensure completely different random sequences
    const seed = this.seedBase + competitorIndex * 50000 + periodIndex * 1000;
    const rng = this.createSeededRNG(seed);
    
    // Apply random variation on top of the unique baseline
    const variationFactor = 0.05 + rng() * 0.10; // 5-15% variation
    const direction = rng() > 0.5 ? 1 : -1;
    
    return {
      bounceRate: this.clamp(
        competitorBaseline.bounceRate * (1 + direction * variationFactor),
        METRIC_RANGES.BOUNCE_RATE.min,
        METRIC_RANGES.BOUNCE_RATE.max
      ),
      sessionDuration: this.clamp(
        competitorBaseline.sessionDuration * (1 + direction * variationFactor * 0.5),
        METRIC_RANGES.SESSION_DURATION.min,
        METRIC_RANGES.SESSION_DURATION.max
      ),
      pagesPerSession: this.clamp(
        competitorBaseline.pagesPerSession * (1 + direction * variationFactor * 0.3),
        METRIC_RANGES.PAGES_PER_SESSION.min,
        METRIC_RANGES.PAGES_PER_SESSION.max
      ),
      sessionsPerUser: this.clamp(
        competitorBaseline.sessionsPerUser * (1 + direction * variationFactor * 0.2),
        METRIC_RANGES.SESSIONS_PER_USER.min,
        METRIC_RANGES.SESSIONS_PER_USER.max
      )
    };
  }

  /**
   * DEPRECATED: Traffic channels generation removed for data authenticity
   * All Traffic Channels data must come from authentic GA4 sources only
   */
  generateTrafficChannels(periodIndex: number): TrafficChannelDistribution {
    // Return empty object - no synthetic data generation allowed
    return {} as TrafficChannelDistribution;
  }

  /**
   * DEPRECATED: Device distribution generation removed for data authenticity
   * All Device Distribution data must come from authentic GA4 sources only
   */
  generateDeviceDistribution(periodIndex: number): DeviceDistribution {
    // Return empty object - no synthetic data generation allowed
    return {} as DeviceDistribution;
  }

  /**
   * Generate competitor configuration
   */
  generateCompetitorConfig(): CompetitorConfig {
    const rng = this.createSeededRNG(this.seedBase);
    const count = Math.floor(rng() * 3) + 1; // 1-3 competitors
    
    const domains = [...COMPETITOR_DOMAINS]
      .sort(() => rng() - 0.5) // Shuffle
      .slice(0, count);
    
    return {
      count,
      variation: 0.1, // 10% variation from client
      domains
    };
  }

  /**
   * Generate base metrics using seeded randomization
   */
  private generateBaseMetrics(seed: number): SampleMetricData {
    const rng = this.createSeededRNG(seed);
    
    return {
      bounceRate: this.randomInRange(rng, METRIC_RANGES.BOUNCE_RATE.min, METRIC_RANGES.BOUNCE_RATE.max),
      sessionDuration: this.randomInRange(rng, METRIC_RANGES.SESSION_DURATION.min, METRIC_RANGES.SESSION_DURATION.max),
      pagesPerSession: this.randomInRange(rng, METRIC_RANGES.PAGES_PER_SESSION.min, METRIC_RANGES.PAGES_PER_SESSION.max),
      sessionsPerUser: this.randomInRange(rng, METRIC_RANGES.SESSIONS_PER_USER.min, METRIC_RANGES.SESSIONS_PER_USER.max)
    };
  }

  /**
   * Apply trend over time
   */
  private applyTrend(
    baseMetrics: SampleMetricData, 
    periodIndex: number, 
    trendVariation: TrendVariation
  ): SampleMetricData {
    const trendConfig = TREND_PATTERNS[trendVariation.type.toUpperCase() as keyof typeof TREND_PATTERNS];
    const progressRatio = periodIndex / 15; // 15 months total
    const trendFactor = 1 + (trendConfig.magnitude * progressRatio);
    
    return {
      bounceRate: baseMetrics.bounceRate * trendFactor,
      sessionDuration: baseMetrics.sessionDuration * trendFactor,
      pagesPerSession: baseMetrics.pagesPerSession * trendFactor,
      sessionsPerUser: baseMetrics.sessionsPerUser * trendFactor
    };
  }

  /**
   * Add monthly variation
   */
  private addMonthlyVariation(metrics: SampleMetricData, seed: number): SampleMetricData {
    const rng = this.createSeededRNG(seed);
    const variationFactor = 0.05; // 5% monthly variation
    
    return {
      bounceRate: this.clamp(
        metrics.bounceRate * (1 + (rng() - 0.5) * variationFactor),
        METRIC_RANGES.BOUNCE_RATE.min,
        METRIC_RANGES.BOUNCE_RATE.max
      ),
      sessionDuration: this.clamp(
        metrics.sessionDuration * (1 + (rng() - 0.5) * variationFactor),
        METRIC_RANGES.SESSION_DURATION.min,
        METRIC_RANGES.SESSION_DURATION.max
      ),
      pagesPerSession: this.clamp(
        metrics.pagesPerSession * (1 + (rng() - 0.5) * variationFactor),
        METRIC_RANGES.PAGES_PER_SESSION.min,
        METRIC_RANGES.PAGES_PER_SESSION.max
      ),
      sessionsPerUser: this.clamp(
        metrics.sessionsPerUser * (1 + (rng() - 0.5) * variationFactor),
        METRIC_RANGES.SESSIONS_PER_USER.min,
        METRIC_RANGES.SESSIONS_PER_USER.max
      )
    };
  }

  /**
   * Create seeded random number generator
   */
  private createSeededRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Generate random number in range
   */
  private randomInRange(rng: () => number, min: number, max: number): number {
    return min + rng() * (max - min);
  }

  /**
   * Clamp value to range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Hash string to number for seeding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}