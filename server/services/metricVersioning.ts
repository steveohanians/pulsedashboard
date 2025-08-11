/**
 * Metric Versioning Service
 * 
 * Handles version tracking for metrics to invalidate stale AI insights
 * when metrics are updated.
 */

import type { IStorage } from '../storage.js';
import type { AIInsight } from '@shared/schema';

export interface VersionedInsightStatus {
  status: 'pending' | 'available' | 'error';
  latestVersion: number;
  lastCompleteVersion?: number;
  error?: string;
}

export class MetricVersionService {
  constructor(private storage: IStorage) {}

  /**
   * Get or create the current version for a (clientId, timePeriod) pair
   */
  async getCurrentVersion(clientId: string, timePeriod: string): Promise<number> {
    const existing = await this.storage.getMetricVersion(clientId, timePeriod);
    if (existing) {
      return existing.currentVersion;
    }

    // Create initial version if it doesn't exist
    await this.storage.createMetricVersion(clientId, timePeriod, 1);
    return 1;
  }

  /**
   * Increment the version when metrics are updated
   */
  async incrementVersion(clientId: string, timePeriod: string): Promise<number> {
    const currentVersion = await this.getCurrentVersion(clientId, timePeriod);
    const newVersion = currentVersion + 1;
    
    await this.storage.updateMetricVersion(clientId, timePeriod, newVersion);
    return newVersion;
  }

  /**
   * Check if insights exist for the latest version
   */
  async getInsightStatus(clientId: string, timePeriod: string): Promise<VersionedInsightStatus> {
    const latestVersion = await this.getCurrentVersion(clientId, timePeriod);
    
    // Check if insights exist for the latest version
    const latestInsights = await this.storage.getAIInsightsByVersion(clientId, timePeriod, latestVersion);
    
    if (latestInsights.length > 0) {
      return {
        status: 'available',
        latestVersion,
        lastCompleteVersion: latestVersion
      };
    }

    // Check if we have insights for a previous version
    const previousVersions = await this.storage.getLatestAIInsightVersion(clientId, timePeriod);
    const lastCompleteVersion = previousVersions.length > 0 ? Math.max(...previousVersions.map((i: AIInsight) => i.version)) : undefined;

    return {
      status: 'pending',
      latestVersion,
      lastCompleteVersion
    };
  }

  /**
   * Get the highest version with available insights (for serving during pending state)
   */
  async getLatestAvailableInsights(clientId: string, timePeriod: string) {
    const versions = await this.storage.getLatestAIInsightVersion(clientId, timePeriod);
    if (versions.length === 0) {
      return null;
    }

    const latestVersion = Math.max(...versions.map((i: AIInsight) => i.version));
    return await this.storage.getAIInsightsByVersion(clientId, timePeriod, latestVersion);
  }

  /**
   * Clean up old insight versions (keep only the latest 3 versions)
   */
  async cleanupOldVersions(clientId: string, timePeriod: string): Promise<void> {
    const versions = await this.storage.getLatestAIInsightVersion(clientId, timePeriod);
    const versionNumbers = versions.map((i: AIInsight) => i.version);
    const uniqueVersions = Array.from(new Set(versionNumbers)).sort((a, b) => b - a);
    
    // Keep only the latest 3 versions
    const versionsToDelete = uniqueVersions.slice(3);
    
    for (const version of versionsToDelete) {
      await this.storage.deleteAIInsightsByVersion(clientId, timePeriod, version);
    }
  }

  /**
   * Force regeneration of insights for the latest version
   */
  async forceRegenerate(clientId: string, timePeriod: string): Promise<number> {
    const currentVersion = await this.getCurrentVersion(clientId, timePeriod);
    
    // Delete existing insights for current version if any
    await this.storage.deleteAIInsightsByVersion(clientId, timePeriod, currentVersion);
    
    return currentVersion;
  }
}

// Backward compatibility helper
export function migrateInsightVersion(insight: any): any {
  // If version is missing, treat as v1 and migrate lazily
  if (!insight.version) {
    return { ...insight, version: 1 };
  }
  return insight;
}

export default MetricVersionService;