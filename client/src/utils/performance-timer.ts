// Performance timing utility to measure actual render completion
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = performance.now();
    console.log(`🚀 [PERFORMANCE] Page load started at: ${this.startTime}ms`);
  }

  markComplete() {
    this.endTime = performance.now();
    const totalTime = this.endTime - this.startTime;
    console.log(`✅ [PERFORMANCE] Page fully rendered at: ${this.endTime}ms`);
    console.log(`⏱️  [PERFORMANCE] TOTAL RENDER TIME: ${totalTime.toFixed(2)}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log(`🎯 [PERFORMANCE] === FINAL MEASUREMENT: ${(totalTime/1000).toFixed(2)} SECONDS ===`);
    
    // Also log to localStorage for retrieval
    localStorage.setItem('lastRenderTime', totalTime.toString());
    
    return totalTime;
  }

  getLastRenderTime(): number | null {
    const time = localStorage.getItem('lastRenderTime');
    return time ? parseFloat(time) : null;
  }
}

export const performanceTimer = new PerformanceTimer();