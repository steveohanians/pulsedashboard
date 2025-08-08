import { logger } from '@/utils/logger';

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
    
    if (duration > 1000) {
      logger.warn(`🐌 Slow operation: ${label} took ${duration}ms`);
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

  markDashboardComplete() {
    return 0;
  }

  getTotalTime(): number {
    return Date.now() - this.startTime;
  }
}

class RenderTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = Date.now();
  }

  markComplete() {
    this.endTime = Date.now();
    const totalTime = this.endTime - this.startTime;
    
    const rechartWrappers = document.querySelectorAll('[data-testid="recharts-wrapper"]');
    const metricElements = document.querySelectorAll('[id^="metric-"]');
    const chartContainers = document.querySelectorAll('.recharts-wrapper');
    const hasContent = rechartWrappers.length > 0 || chartContainers.length > 0;
    const hasMetrics = metricElements.length > 0;
    
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

class BrowserPerformanceTimer {
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
              logger.info(`🎨 [PERF] First Contentful Paint: ${entry.startTime.toFixed(0)}ms`);
            }
          }
          
          if (entry.entryType === 'largest-contentful-paint') {
            this.largestContentfulPaint = entry.startTime;
          }
        }
      });
      
      try {
        this.observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      } catch (e) {
        logger.warn('Performance observer not fully supported');
      }
    }
  }

  private measureNavigationStart() {
    if (performance.timing) {
      this.navigationStart = performance.timing.navigationStart;
    } else {
      this.navigationStart = Date.now();
    }
  }

  markDashboardComplete() {
    this.dashboardComplete = Date.now();
    const totalTime = this.dashboardComplete - this.navigationStart;
    return totalTime;
  }

  getPerformanceMetrics() {
    return {
      navigationStart: this.navigationStart,
      firstContentfulPaint: this.firstContentfulPaint,
      largestContentfulPaint: this.largestContentfulPaint,
      dashboardComplete: this.dashboardComplete
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
export const renderTimer = new RenderTimer();
export const browserPerformanceTimer = new BrowserPerformanceTimer();

export const loadChartingLibrary = async () => {
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = await import('recharts');
  return { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer };
};

export const loadPDFLibraries = async () => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  return { html2canvas, jsPDF };
};

export { PerformanceMonitor, RenderTimer, BrowserPerformanceTimer };