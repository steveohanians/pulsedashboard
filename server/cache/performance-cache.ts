// Simple in-memory cache for performance optimization
interface CacheEntry {
  data: any;
  timestamp: number;
}

class PerformanceCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ENTRIES = 500;

  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), this.DEFAULT_TTL);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.DEFAULT_TTL) {
        this.cache.delete(key);
      }
    }
    
    // Enforce max size by removing oldest entries
    if (this.cache.size > this.MAX_ENTRIES) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, this.cache.size - this.MAX_ENTRIES);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  // Generate cache key for dashboard queries
  generateDashboardKey(clientId: string, timePeriod: string, businessSize: string, industryVertical: string): string {
    return `dashboard:${clientId}:${timePeriod}:${businessSize}:${industryVertical}`;
  }

  // Generate cache key for filtered metrics
  generateMetricsKey(timePeriod: string, businessSize: string, industryVertical: string): string {
    return `metrics:${timePeriod}:${businessSize}:${industryVertical}`;
  }

  // Get cached result
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  // Set cached result
  set(key: string, data: any, ttl?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now()
    };
    
    this.cache.set(key, entry);
    
    // Trigger cleanup if we're over the limit
    if (this.cache.size > this.MAX_ENTRIES) {
      this.cleanup();
    }
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Clear specific pattern
  clearPattern(pattern: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Invalidate all cache entries for a specific client
  invalidateClientCache(clientId: string): void {
    const keysToDelete: string[] = [];
    for (const [key] of Array.from(this.cache.entries())) {
      if (key.includes(`dashboard:${clientId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keysCached: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const performanceCache = new PerformanceCache();