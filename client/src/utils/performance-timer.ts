// Performance timing utility to measure actual render completion
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = performance.now();
    console.log(`🚀 [PERFORMANCE] Page load started at: ${this.startTime}ms`);
    console.log(`📊 [PERFORMANCE] Browser navigation timestamp: ${Date.now()}`);
  }

  markComplete() {
    this.endTime = performance.now();
    const totalTime = this.endTime - this.startTime;
    
    // Verify we actually have content rendered
    const rechartWrappers = document.querySelectorAll('[data-testid="recharts-wrapper"]');
    const metricElements = document.querySelectorAll('[id^="metric-"]');
    const chartContainers = document.querySelectorAll('.recharts-wrapper');
    const hasContent = rechartWrappers.length > 0 || chartContainers.length > 0;
    const hasMetrics = metricElements.length > 0;
    
    console.log(`✅ [PERFORMANCE] Page fully rendered at: ${this.endTime}ms`);
    console.log(`📊 [PERFORMANCE] Content verification: Charts=${hasContent}, Metrics=${hasMetrics}`);
    console.log(`⏱️  [PERFORMANCE] TOTAL RENDER TIME: ${totalTime.toFixed(2)}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`🎯 [PERFORMANCE] === ACTUAL COMPLETE RENDER TIME: ${(totalTime/1000).toFixed(2)} SECONDS ===`);
    
    // Also log to localStorage for retrieval
    localStorage.setItem('lastRenderTime', totalTime.toString());
    localStorage.setItem('lastRenderDetails', JSON.stringify({
      time: totalTime,
      hasCharts: hasContent,
      hasMetrics: hasMetrics,
      timestamp: Date.now()
    }));
    
    return totalTime;
  }

  getLastRenderTime(): number | null {
    const time = localStorage.getItem('lastRenderTime');
    return time ? parseFloat(time) : null;
  }
}

export const performanceTimer = new PerformanceTimer();