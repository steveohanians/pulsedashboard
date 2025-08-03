// Real performance measurement that captures actual user experience
export class RealPerformanceTimer {
  private navigationStart: number = 0;
  private firstContentfulPaint: number = 0;
  private largestContentfulPaint: number = 0;
  private dashboardComplete: number = 0;
  private observer: PerformanceObserver | null = null;

  constructor() {
    this.setupPerformanceObserver();
    this.measureNavigationStart();
  }

  private setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              this.firstContentfulPaint = entry.startTime;
              console.log(`🎨 [REAL-PERF] First Contentful Paint: ${entry.startTime.toFixed(0)}ms`);
            }
          }
          
          if (entry.entryType === 'largest-contentful-paint') {
            this.largestContentfulPaint = entry.startTime;
            console.log(`🖼️ [REAL-PERF] Largest Contentful Paint: ${entry.startTime.toFixed(0)}ms`);
          }
        }
      });
      
      try {
        this.observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      } catch (e) {
        console.warn('Performance observer not fully supported');
      }
    }
  }

  private measureNavigationStart() {
    if (performance.timing) {
      this.navigationStart = performance.timing.navigationStart;
      console.log(`🚀 [REAL-PERF] Navigation Start: ${this.navigationStart}`);
    } else {
      this.navigationStart = Date.now();
    }
  }

  startDashboardTiming() {
    console.log(`📊 [REAL-PERF] Dashboard component mounting at: ${Date.now() - this.navigationStart}ms after navigation`);
  }

  markDashboardComplete() {
    this.dashboardComplete = Date.now();
    const totalTime = this.dashboardComplete - this.navigationStart;
    
    // Verify actual visual content exists
    const visualElements = this.countVisualElements();
    
    console.log(`\n=== REAL PERFORMANCE MEASUREMENT ===`);
    console.log(`🚀 Navigation Start: 0ms`);
    if (this.firstContentfulPaint > 0) {
      console.log(`🎨 First Contentful Paint: ${this.firstContentfulPaint.toFixed(0)}ms`);
    }
    if (this.largestContentfulPaint > 0) {
      console.log(`🖼️ Largest Contentful Paint: ${this.largestContentfulPaint.toFixed(0)}ms`);
    }
    console.log(`📊 Dashboard Visual Complete: ${totalTime}ms`);
    console.log(`🎯 TOTAL USER EXPERIENCE TIME: ${(totalTime/1000).toFixed(2)} SECONDS`);
    console.log(`📈 Visual Elements Rendered: ${visualElements.charts} charts, ${visualElements.metrics} metrics, ${visualElements.paths} paths`);
    console.log(`=====================================\n`);

    return totalTime;
  }

  private countVisualElements() {
    return {
      charts: document.querySelectorAll('.recharts-wrapper').length,
      metrics: document.querySelectorAll('[id^="metric-"]').length,
      paths: document.querySelectorAll('svg path, svg circle, svg rect').length,
      totalElements: document.querySelectorAll('*').length
    };
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export const realPerformanceTimer = new RealPerformanceTimer();