// Consolidated performance monitoring utilities
// This eliminates duplicate performance tracking patterns

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: 'api' | 'database' | 'render' | 'calculation' | 'external';
  metadata?: Record<string, unknown>;
}

/**
 * Performance monitoring utilities
 * Consolidates timing and measurement patterns
 */
export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetric> = new Map();
  private static completedMetrics: PerformanceMetric[] = [];
  private static maxHistorySize = 1000;

  /**
   * Start timing an operation
   */
  static start(name: string, category: PerformanceMetric['category'], metadata?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      category,
      metadata
    };
    
    this.metrics.set(name, metric);
  }

  /**
   * End timing an operation
   */
  static end(name: string): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric '${name}' not found`);
      return undefined;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Move to completed metrics
    this.completedMetrics.push(metric);
    this.metrics.delete(name);

    // Maintain history size limit
    if (this.completedMetrics.length > this.maxHistorySize) {
      this.completedMetrics = this.completedMetrics.slice(-this.maxHistorySize);
    }

    return metric.duration;
  }

  /**
   * Time a function execution
   */
  static async time<T>(
    name: string, 
    category: PerformanceMetric['category'],
    fn: () => Promise<T> | T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name, category, metadata);
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(name);
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(category?: PerformanceMetric['category']): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
  } {
    let metrics = this.completedMetrics;
    
    if (category) {
      metrics = metrics.filter(m => m.category === category);
    }

    if (metrics.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalDuration: 0
      };
    }

    const durations = metrics.map(m => m.duration || 0);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: metrics.length,
      averageDuration: totalDuration / metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration
    };
  }

  /**
   * Get slowest operations
   */
  static getSlowestOperations(limit: number = 10, category?: PerformanceMetric['category']): PerformanceMetric[] {
    let metrics = this.completedMetrics;
    
    if (category) {
      metrics = metrics.filter(m => m.category === category);
    }

    return metrics
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  /**
   * Clear performance history
   */
  static clearHistory(): void {
    this.completedMetrics = [];
    this.metrics.clear();
  }

  /**
   * Get active timers
   */
  static getActiveTimers(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }
}

/**
 * Debounce utility for performance optimization
 * Consolidates debouncing patterns from multiple components
 */
export class DebounceManager {
  private static timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounce a function call
   */
  static debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        fn(...args);
        this.timers.delete(key);
      }, delay);

      this.timers.set(key, timer);
    };
  }

  /**
   * Cancel a debounced operation
   */
  static cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Clear all debounced operations
   */
  static clearAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

/**
 * Throttle utility for performance optimization
 * Consolidates throttling patterns from scroll and resize handlers
 */
export class ThrottleManager {
  private static lastExecuted: Map<string, number> = new Map();

  /**
   * Throttle a function call
   */
  static throttle<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const lastTime = this.lastExecuted.get(key) || 0;

      if (now - lastTime >= limit) {
        fn(...args);
        this.lastExecuted.set(key, now);
      }
    };
  }

  /**
   * Clear throttle history
   */
  static clear(key: string): void {
    this.lastExecuted.delete(key);
  }

  /**
   * Clear all throttle history
   */
  static clearAll(): void {
    this.lastExecuted.clear();
  }
}

/**
 * Memory usage monitoring
 * Consolidates memory tracking patterns
 */
export class MemoryMonitor {
  /**
   * Get current memory usage (browser only)
   */
  static getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } | null {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
      };
    }
    return null;
  }

  /**
   * Monitor memory usage over time
   */
  static startMemoryMonitoring(intervalMs: number = 5000): () => void {
    const interval = setInterval(() => {
      const usage = this.getMemoryUsage();
      if (usage && usage.percentage > 90) {
        console.warn('High memory usage detected:', usage);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }
}

/**
 * Cache utilities for performance optimization
 * Consolidates caching patterns
 */
export class CacheManager {
  private static cache: Map<string, { value: any; expiry: number }> = new Map();

  /**
   * Set cache value with TTL
   */
  static set(key: string, value: any, ttlMs: number = 300000): void { // 5 minutes default
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get cache value
   */
  static get<T = any>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Check if key exists and is valid
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete cache entry
   */
  static delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear expired entries
   */
  static clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    this.cache.forEach((item, key) => {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleared++;
      }
    });

    return cleared;
  }

  /**
   * Clear all cache
   */
  static clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  static getStats(): {
    size: number;
    expired: number;
    valid: number;
  } {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    this.cache.forEach((item) => {
      if (now > item.expiry) {
        expired++;
      } else {
        valid++;
      }
    });

    return {
      size: this.cache.size,
      expired,
      valid
    };
  }
}