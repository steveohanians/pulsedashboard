// Client-side caching for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // Cache filters and user data for 5 minutes
  cacheFilters(data: any): void {
    this.set('filters', data, 5 * 60 * 1000);
  }

  getCachedFilters(): any {
    return this.get('filters');
  }

  cacheUser(data: any): void {
    this.set('user', data, 5 * 60 * 1000);
  }

  getCachedUser(): any {
    return this.get('user');
  }
}

export const cacheManager = new CacheManager();