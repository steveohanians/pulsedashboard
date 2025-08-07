// Frontend rendering optimization utilities

// Virtualized rendering for large datasets
export class VirtualizedRenderer {
  private static CHUNK_SIZE = 50;
  private static RENDER_DELAY = 16; // ~60fps

  static async renderChunked<T>(
    items: T[],
    renderFn: (item: T, index: number) => JSX.Element,
    container?: HTMLElement
  ): Promise<JSX.Element[]> {
    return new Promise((resolve) => {
      const chunks: JSX.Element[][] = [];
      let currentIndex = 0;

      const processChunk = () => {
        const chunk: JSX.Element[] = [];
        const endIndex = Math.min(currentIndex + this.CHUNK_SIZE, items.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
          chunk.push(renderFn(items[i], i));
        }
        
        chunks.push(chunk);
        currentIndex = endIndex;
        
        if (currentIndex < items.length) {
          setTimeout(processChunk, this.RENDER_DELAY);
        } else {
          resolve(chunks.flat());
        }
      };

      processChunk();
    });
  }
}

// DOM performance optimization
export class DOMOptimizer {
  private static observer: IntersectionObserver | null = null;

  static setupIntersectionObserver(
    callback: (entries: IntersectionObserverEntry[]) => void
  ): IntersectionObserver {
    if (!this.observer) {
      this.observer = new IntersectionObserver(callback, {
        rootMargin: '50px',
        threshold: 0.1
      });
    }
    return this.observer;
  }

  static lazyLoadElement(element: HTMLElement, loadFn: () => void): void {
    const observer = this.setupIntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target === element) {
          loadFn();
          observer.unobserve(element);
        }
      });
    });
    
    observer.observe(element);
  }
}

// Memory management utilities
export class MemoryOptimizer {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyFn?: (...args: Parameters<T>) => string
  ): T {
    return ((...args: Parameters<T>) => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
      
      const result = fn(...args);
      this.cache.set(key, { data: result, timestamp: Date.now() });
      
      // Clean up old entries
      if (this.cache.size > 100) {
        this.cleanupCache();
      }
      
      return result;
    }) as T;
  }

  private static cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

// Async loading utilities for insights
export class AsyncLoader {
  private static loadingQueue: Array<() => Promise<any>> = [];
  private static isProcessing = false;
  private static readonly BATCH_SIZE = 3;

  static queueAsyncLoad<T>(loadFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.loadingQueue.push(async () => {
        try {
          const result = await loadFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.loadingQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.loadingQueue.length > 0) {
      const batch = this.loadingQueue.splice(0, this.BATCH_SIZE);
      await Promise.all(batch.map(fn => fn()));
      
      // Yield control to allow other operations
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    this.isProcessing = false;
  }
}