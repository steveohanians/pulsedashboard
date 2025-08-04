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
    const seed = this.seedBase + competitorIndex * 1000 + periodIndex;
    const rng = this.createSeededRNG(seed);
    
    // Competitors vary 5-15% from client baseline
    const variationFactor = 0.05 + rng() * 0.10; // 5-15%
    const direction = rng() > 0.5 ? 1 : -1;
    
    return {
      bounceRate: this.clamp(
        clientBaseline.bounceRate * (1 + direction * variationFactor),
        METRIC_RANGES.BOUNCE_RATE.min,
        METRIC_RANGES.BOUNCE_RATE.max
      ),
      sessionDuration: this.clamp(
        clientBaseline.sessionDuration * (1 + direction * variationFactor * 0.5),
        METRIC_RANGES.SESSION_DURATION.min,
        METRIC_RANGES.SESSION_DURATION.max
      ),
      pagesPerSession: this.clamp(
        clientBaseline.pagesPerSession * (1 + direction * variationFactor * 0.3),
        METRIC_RANGES.PAGES_PER_SESSION.min,
        METRIC_RANGES.PAGES_PER_SESSION.max
      ),
      sessionsPerUser: this.clamp(
        clientBaseline.sessionsPerUser * (1 + direction * variationFactor * 0.2),
        METRIC_RANGES.SESSIONS_PER_USER.min,
        METRIC_RANGES.SESSIONS_PER_USER.max
      )
    };
  }

  /**
   * Generate traffic channel distribution
   */
  generateTrafficChannels(periodIndex: number): TrafficChannelDistribution {
    const seed = this.seedBase + periodIndex + 10000;
    const rng = this.createSeededRNG(seed);
    
    const channels = { ...TRAFFIC_CHANNEL_BASELINES };
    
    // Add variation to each channel
    Object.keys(channels).forEach(channel => {
      const variation = (rng() - 0.5) * 0.1; // ±5% variation
      channels[channel as keyof TrafficChannelDistribution] = Math.max(1, 
        channels[channel as keyof TrafficChannelDistribution] * (1 + variation)
      );
    });
    
    // Normalize to 100%
    const total = Object.values(channels).reduce((sum, val) => sum + val, 0);
    Object.keys(channels).forEach(channel => {
      channels[channel as keyof TrafficChannelDistribution] = 
        Math.round((channels[channel as keyof TrafficChannelDistribution] / total) * 100 * 10) / 10;
    });
    
    return channels;
  }

  /**
   * Generate device distribution
   */
  generateDeviceDistribution(periodIndex: number): DeviceDistribution {
    const seed = this.seedBase + periodIndex + 20000;
    const rng = this.createSeededRNG(seed);
    
    const devices = { ...DEVICE_DISTRIBUTION_BASELINE };
    
    // Add variation
    Object.keys(devices).forEach(device => {
      const variation = (rng() - 0.5) * 0.05; // ±2.5% variation
      devices[device as keyof DeviceDistribution] = Math.max(5, 
        devices[device as keyof DeviceDistribution] * (1 + variation)
      );
    });
    
    // Normalize to 100%
    const total = Object.values(devices).reduce((sum, val) => sum + val, 0);
    Object.keys(devices).forEach(device => {
      devices[device as keyof DeviceDistribution] = 
        Math.round((devices[device as keyof DeviceDistribution] / total) * 100 * 10) / 10;
    });
    
    return devices;
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