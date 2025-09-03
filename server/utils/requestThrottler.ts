/**
 * Request Throttler Utility
 * 
 * Implements queue-based throttling to prevent race conditions with external APIs.
 * Ensures minimum delay between requests to the same service while allowing 
 * different services to run in parallel.
 */

import logger from './logging/logger';

interface ThrottleRequest {
  serviceName: string;
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class RequestThrottler {
  private serviceQueues: Map<string, ThrottleRequest[]> = new Map();
  private serviceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastRequestTimes: Map<string, number> = new Map();
  private readonly serviceDelays: Map<string, number> = new Map();

  constructor() {
    // Set minimum delays for different services (in milliseconds)
    this.serviceDelays.set('screenshotone', 1000); // 1 second for Screenshotone API
    this.serviceDelays.set('playwright', 0); // No throttling needed for Playwright
    this.serviceDelays.set('default', 500); // Default 500ms delay for unknown services
  }

  /**
   * Throttle a request to ensure minimum delay between calls to the same service
   */
  public async throttle<T>(serviceName: string, requestFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: ThrottleRequest = {
        serviceName,
        requestFn,
        resolve,
        reject
      };

      // Add to service queue
      if (!this.serviceQueues.has(serviceName)) {
        this.serviceQueues.set(serviceName, []);
      }
      
      this.serviceQueues.get(serviceName)!.push(request);
      
      // Process queue
      this.processQueue(serviceName);
    });
  }

  private processQueue(serviceName: string): void {
    const queue = this.serviceQueues.get(serviceName);
    if (!queue || queue.length === 0) {
      return;
    }

    // If already processing this service, wait
    if (this.serviceTimers.has(serviceName)) {
      return;
    }

    const minDelay = this.serviceDelays.get(serviceName) || this.serviceDelays.get('default')!;
    const lastRequestTime = this.lastRequestTimes.get(serviceName) || 0;
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    const delayNeeded = Math.max(0, minDelay - timeSinceLastRequest);

    const processNext = () => {
      const request = queue.shift();
      if (!request) {
        return;
      }

      // Clear timer
      this.serviceTimers.delete(serviceName);
      
      // Update last request time
      this.lastRequestTimes.set(serviceName, Date.now());

      // Log throttling action
      if (delayNeeded > 0) {
        logger.info(`[THROTTLE] Applied ${delayNeeded}ms delay for ${serviceName} service`);
      }

      // Execute the request
      request.requestFn()
        .then(result => {
          request.resolve(result);
          
          // Process next request in queue if any
          if (queue.length > 0) {
            setTimeout(() => this.processQueue(serviceName), minDelay);
          }
        })
        .catch(error => {
          request.reject(error);
          
          // Process next request in queue if any, even after error
          if (queue.length > 0) {
            setTimeout(() => this.processQueue(serviceName), minDelay);
          }
        });
    };

    if (delayNeeded > 0) {
      // Set timer to process after delay
      const timer = setTimeout(processNext, delayNeeded);
      this.serviceTimers.set(serviceName, timer);
    } else {
      // Process immediately
      processNext();
    }
  }

  /**
   * Get current queue status for debugging
   */
  public getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const [service, queue] of this.serviceQueues) {
      status[service] = queue.length;
    }
    return status;
  }

  /**
   * Clear all queues (for testing/cleanup)
   */
  public clearQueues(): void {
    // Clear all timers
    for (const timer of this.serviceTimers.values()) {
      clearTimeout(timer);
    }
    
    this.serviceQueues.clear();
    this.serviceTimers.clear();
    this.lastRequestTimes.clear();
  }
}

// Export singleton instance for global use
export const requestThrottler = new RequestThrottler();