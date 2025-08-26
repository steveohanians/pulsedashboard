/**
 * Effectiveness Scoring Configuration Management
 */

import { db } from "../../db";
import { effectivenessConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SCORING_CONFIG, ScoringConfig } from "./types";
import logger from "../../utils/logging/logger";

export class EffectivenessConfigManager {
  private static instance: EffectivenessConfigManager;
  private cachedConfig: ScoringConfig | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): EffectivenessConfigManager {
    if (!EffectivenessConfigManager.instance) {
      EffectivenessConfigManager.instance = new EffectivenessConfigManager();
    }
    return EffectivenessConfigManager.instance;
  }

  /**
   * Get current scoring configuration with caching
   */
  public async getConfig(): Promise<ScoringConfig> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.cachedConfig && (now - this.lastUpdate) < this.CACHE_TTL) {
      return this.cachedConfig;
    }

    try {
      // Load from database
      const configs = await db.select().from(effectivenessConfig);
      const configMap = configs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {} as Record<string, any>);

      // Merge with defaults
      this.cachedConfig = this.mergeConfigs(DEFAULT_SCORING_CONFIG, configMap);
      this.lastUpdate = now;
      
      logger.info("Loaded effectiveness scoring configuration", {
        configKeys: Object.keys(configMap),
        timestamp: new Date().toISOString()
      });

      return this.cachedConfig;
    } catch (error) {
      logger.error("Failed to load effectiveness config, using defaults", {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return DEFAULT_SCORING_CONFIG;
    }
  }

  /**
   * Update configuration value
   */
  public async updateConfig(key: string, value: any, description?: string): Promise<void> {
    try {
      await db.insert(effectivenessConfig)
        .values({
          key,
          value,
          description,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: effectivenessConfig.key,
          set: {
            value,
            description,
            updatedAt: new Date()
          }
        });

      // Invalidate cache
      this.cachedConfig = null;
      
      logger.info("Updated effectiveness configuration", { key, description });
    } catch (error) {
      logger.error("Failed to update effectiveness configuration", {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Initialize default configuration values
   */
  public async initializeDefaults(): Promise<void> {
    try {
      const defaults = [
        {
          key: 'buzzwords',
          value: DEFAULT_SCORING_CONFIG.buzzwords,
          description: 'Words that reduce positioning clarity score'
        },
        {
          key: 'thresholds',
          value: DEFAULT_SCORING_CONFIG.thresholds,
          description: 'Scoring thresholds for various criteria'
        },
        {
          key: 'viewport',
          value: DEFAULT_SCORING_CONFIG.viewport,
          description: 'Screenshot viewport dimensions'
        },
        {
          key: 'openai',
          value: DEFAULT_SCORING_CONFIG.openai,
          description: 'OpenAI API configuration'
        }
      ];

      for (const config of defaults) {
        await db.insert(effectivenessConfig)
          .values(config)
          .onConflictDoNothing();
      }

      logger.info("Initialized default effectiveness configuration");
    } catch (error) {
      logger.error("Failed to initialize default configuration", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clear configuration cache
   */
  public clearCache(): void {
    this.cachedConfig = null;
    this.lastUpdate = 0;
  }

  /**
   * Merge default config with database overrides
   */
  private mergeConfigs(defaults: ScoringConfig, overrides: Record<string, any>): ScoringConfig {
    const merged = JSON.parse(JSON.stringify(defaults)); // Deep clone

    for (const [key, value] of Object.entries(overrides)) {
      if (key in merged) {
        if (typeof merged[key as keyof ScoringConfig] === 'object' && !Array.isArray(merged[key as keyof ScoringConfig])) {
          // Merge objects
          merged[key as keyof ScoringConfig] = {
            ...merged[key as keyof ScoringConfig],
            ...value
          };
        } else {
          // Replace primitives and arrays
          (merged as any)[key] = value;
        }
      }
    }

    return merged;
  }
}