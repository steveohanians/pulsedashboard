// Real-time performance monitoring for enterprise optimization
class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private startTime: number = Date.now();

  markStart(label: string): void {
    this.metrics.set(`${label}_start`, Date.now());
  }

  markEnd(label: string): number {
    const startTime = this.metrics.get(`${label}_start`);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.metrics.set(`${label}_duration`, duration);
    
    // Log slow operations for optimization
    if (duration > 1000) {
      console.warn(`🐌 Slow operation: ${label} took ${duration}ms`);
    }
    
    return duration;
  }

  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((value, key) => {
      if (key.endsWith('_duration')) {
        result[key.replace('_duration', '')] = value;
      }
    });
    return result;
  }

  getTotalTime(): number {
    return Date.now() - this.startTime;
  }
}

export const performanceMonitor = new PerformanceMonitor();