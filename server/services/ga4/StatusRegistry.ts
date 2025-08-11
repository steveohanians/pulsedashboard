/**
 * GA4 Status Registry
 * 
 * Tracks per-(clientId,timePeriod) status for GA4 fetches to provide
 * observable cache and lock status to the UI.
 */

import logger from '../../utils/logging/logger';

export interface GA4FetchStatus {
  clientId: string;
  timePeriod: string;
  inProgress: boolean;
  lastRefreshedAt: string | null; // ISO timestamp
  startedAt?: string | null; // When current fetch started
  error?: string | null;
  dataType?: 'daily' | 'monthly' | null;
  lockKey: string;
}

export interface StatusRegistryStats {
  totalFetches: number;
  inProgressCount: number;
  lastActivity: string | null;
  oldestInProgress?: string | null;
}

/**
 * Thread-safe status registry for GA4 fetch operations
 */
class GA4StatusRegistry {
  private readonly statusMap = new Map<string, GA4FetchStatus>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 300000) { // 5 minutes default TTL
    this.ttlMs = ttlMs;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanupExpiredEntries(), 60000);
  }

  /**
   * Generate lock key for clientId + timePeriod combination
   */
  private generateLockKey(clientId: string, timePeriod: string): string {
    return `${clientId}:${timePeriod}`;
  }

  /**
   * Start tracking a fetch operation
   */
  startFetch(clientId: string, timePeriod: string): string {
    const lockKey = this.generateLockKey(clientId, timePeriod);
    const now = new Date().toISOString();
    
    const status: GA4FetchStatus = {
      clientId,
      timePeriod,
      inProgress: true,
      lastRefreshedAt: null, // Will be set on completion
      startedAt: now,
      error: null,
      dataType: null,
      lockKey
    };

    this.statusMap.set(lockKey, status);
    
    logger.info(`GA4 fetch started for ${lockKey}`, { startedAt: now });
    return lockKey;
  }

  /**
   * Complete tracking for a fetch operation
   */
  completeFetch(
    lockKey: string, 
    success: boolean, 
    dataType: 'daily' | 'monthly' = 'monthly',
    error?: string
  ): void {
    const status = this.statusMap.get(lockKey);
    if (!status) {
      logger.warn(`Attempted to complete non-existent fetch: ${lockKey}`);
      return;
    }

    const now = new Date().toISOString();
    
    status.inProgress = false;
    status.lastRefreshedAt = success ? now : status.lastRefreshedAt;
    status.dataType = dataType;
    status.error = error || null;
    
    // Keep completed status for a short time for UI visibility
    setTimeout(() => {
      this.statusMap.delete(lockKey);
      logger.debug(`Cleaned up completed fetch status: ${lockKey}`);
    }, 30000); // 30 seconds

    logger.info(`GA4 fetch completed for ${lockKey}`, { 
      success, 
      dataType, 
      duration: status.startedAt ? 
        Date.now() - new Date(status.startedAt).getTime() : 
        undefined,
      error: error ? error.substring(0, 100) : undefined
    });
  }

  /**
   * Get status for a specific clientId and timePeriod
   */
  getStatus(clientId: string, timePeriod: string): GA4FetchStatus | null {
    const lockKey = this.generateLockKey(clientId, timePeriod);
    return this.statusMap.get(lockKey) || null;
  }

  /**
   * Get all statuses for a specific clientId across all time periods
   */
  getClientStatuses(clientId: string): GA4FetchStatus[] {
    const statuses: GA4FetchStatus[] = [];
    
    for (const [, status] of this.statusMap.entries()) {
      if (status.clientId === clientId) {
        statuses.push({ ...status }); // Return copy to prevent mutations
      }
    }
    
    return statuses.sort((a, b) => 
      new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
    );
  }

  /**
   * Check if a fetch is currently in progress for given clientId + timePeriod
   */
  isFetchInProgress(clientId: string, timePeriod: string): boolean {
    const status = this.getStatus(clientId, timePeriod);
    return status?.inProgress || false;
  }

  /**
   * Get last refresh time for clientId + timePeriod
   */
  getLastRefreshTime(clientId: string, timePeriod: string): string | null {
    const status = this.getStatus(clientId, timePeriod);
    return status?.lastRefreshedAt || null;
  }

  /**
   * Force expire a fetch (for admin force refresh)
   */
  forceExpireFetch(clientId: string, timePeriod: string): boolean {
    const lockKey = this.generateLockKey(clientId, timePeriod);
    const status = this.statusMap.get(lockKey);
    
    if (status && status.inProgress) {
      status.inProgress = false;
      status.error = 'Force expired by admin';
      this.statusMap.delete(lockKey);
      
      logger.warn(`Force expired fetch: ${lockKey}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get registry statistics
   */
  getStats(): StatusRegistryStats {
    const statuses = Array.from(this.statusMap.values());
    const inProgressStatuses = statuses.filter(s => s.inProgress);
    
    const lastActivity = statuses.length > 0 ? 
      statuses
        .map(s => s.startedAt || s.lastRefreshedAt)
        .filter(t => t !== null)
        .sort()
        .pop() || null :
      null;

    const oldestInProgress = inProgressStatuses.length > 0 ? 
      inProgressStatuses
        .map(s => s.startedAt)
        .filter(t => t !== null)
        .sort()
        .shift() || null :
      null;

    return {
      totalFetches: statuses.length,
      inProgressCount: inProgressStatuses.length,
      lastActivity,
      oldestInProgress
    };
  }

  /**
   * Cleanup expired entries to prevent memory leaks
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Use snapshot iteration to avoid concurrent modification
    const entries = Array.from(this.statusMap.entries());
    
    for (const [lockKey, status] of entries) {
      const startTime = status.startedAt ? new Date(status.startedAt).getTime() : now;
      
      // Remove entries that are too old or stuck in progress
      if (now - startTime > this.ttlMs) {
        this.statusMap.delete(lockKey);
        cleanedCount++;
        
        if (status.inProgress) {
          logger.warn(`Cleaned up stuck fetch: ${lockKey}`, { 
            duration: now - startTime,
            timePeriod: status.timePeriod 
          });
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Registry cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Add jitter to prevent thundering herd
   */
  generateJitteredDelay(baseDelayMs: number = 1000): number {
    const jitterMs = Math.random() * baseDelayMs * 0.3; // Up to 30% jitter
    return baseDelayMs + jitterMs;
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attemptNumber: number, baseDelayMs: number = 1000): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
    const maxDelay = 30000; // Cap at 30 seconds
    return Math.min(exponentialDelay, maxDelay);
  }
}

// Singleton instance
export const ga4StatusRegistry = new GA4StatusRegistry();

// Export for testing
export { GA4StatusRegistry };