import { queryClient } from '@/lib/queryClient';
import { AdminQueryKeys } from '@/lib/adminQueryKeys';

export type CacheEntity = 
  | 'client'
  | 'user'
  | 'competitor'
  | 'benchmark'
  | 'portfolio'
  | 'filter'
  | 'ga4'
  | 'insight'
  | 'dashboard'
  | 'metric';

interface InvalidationRule {
  entities: CacheEntity[];
  queryKeys: (string | (() => string[]))[];
}

export class CacheManager {
  private static instance: CacheManager;
  private invalidationRules: Map<CacheEntity, InvalidationRule>;

  private constructor() {
    this.invalidationRules = new Map();
    this.setupInvalidationRules();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private setupInvalidationRules(): void {
    // When a client changes, invalidate these
    this.invalidationRules.set('client', {
      entities: ['dashboard', 'filter'],
      queryKeys: [
        () => [...AdminQueryKeys.clients()],
        () => [...AdminQueryKeys.ga4PropertyAccess()],
        () => [...AdminQueryKeys.allDashboards()],
        () => ['/api/filters']
      ]
    });

    // When a user changes
    this.invalidationRules.set('user', {
      entities: [],
      queryKeys: [() => [...AdminQueryKeys.users()]]
    });

    // When a competitor changes
    this.invalidationRules.set('competitor', {
      entities: ['dashboard'],
      queryKeys: [
        () => [...AdminQueryKeys.allDashboards()],
        () => ['/api/dashboard']
      ]
    });

    // When benchmark companies change
    this.invalidationRules.set('benchmark', {
      entities: ['dashboard'],
      queryKeys: [
        () => [...AdminQueryKeys.benchmarkCompanies()],
        () => [...AdminQueryKeys.allDashboards()],
        () => ['/api/filters']
      ]
    });

    // When portfolio companies change
    this.invalidationRules.set('portfolio', {
      entities: ['dashboard'],
      queryKeys: [
        () => [...AdminQueryKeys.cdPortfolio()],
        () => [...AdminQueryKeys.allDashboards()],
        () => ['/api/filters']
      ]
    });

    // When filters change, everything using filters needs update
    this.invalidationRules.set('filter', {
      entities: ['client', 'benchmark', 'portfolio'],
      queryKeys: [
        () => [...AdminQueryKeys.filterOptions()],
        () => [...AdminQueryKeys.clients()],
        () => [...AdminQueryKeys.benchmarkCompanies()],
        () => [...AdminQueryKeys.cdPortfolio()],
        () => ['/api/filters'],
        () => ['/api/dashboard']
      ]
    });

    // When GA4 changes
    this.invalidationRules.set('ga4', {
      entities: ['dashboard'],
      queryKeys: [
        () => [...AdminQueryKeys.ga4ServiceAccounts()],
        () => [...AdminQueryKeys.ga4PropertyAccess()],
        () => [...AdminQueryKeys.allDashboards()]
      ]
    });

    // When insights change
    this.invalidationRules.set('insight', {
      entities: [],
      queryKeys: [
        () => ['/api/ai-insights'],
        () => ['/api/insights']
      ]
    });

    // When metrics change
    this.invalidationRules.set('metric', {
      entities: ['dashboard', 'insight'],
      queryKeys: [
        () => [...AdminQueryKeys.metricPrompts()],
        () => [...AdminQueryKeys.allDashboards()]
      ]
    });

    // Dashboard is a special case - just invalidate itself
    this.invalidationRules.set('dashboard', {
      entities: [],
      queryKeys: [
        () => [...AdminQueryKeys.allDashboards()],
        () => ['/api/dashboard'],
        () => ['/api/filters']
      ]
    });
  }

  /**
   * Invalidate cache for given entities
   */
  invalidate(...entities: CacheEntity[]): void {
    const processed = new Set<CacheEntity>();
    const keysToInvalidate = new Set<string>();

    // Process each entity and its dependencies
    entities.forEach(entity => {
      this.collectInvalidations(entity, processed, keysToInvalidate);
    });

    // Invalidate all collected query keys
    keysToInvalidate.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });

    // Log for debugging
    console.debug('Cache invalidated:', {
      entities: Array.from(processed),
      keys: Array.from(keysToInvalidate)
    });
  }

  private collectInvalidations(
    entity: CacheEntity,
    processed: Set<CacheEntity>,
    keysToInvalidate: Set<string>
  ): void {
    // Avoid circular dependencies
    if (processed.has(entity)) return;
    processed.add(entity);

    const rule = this.invalidationRules.get(entity);
    if (!rule) return;

    // Add query keys for this entity
    rule.queryKeys.forEach(keyOrFunc => {
      if (typeof keyOrFunc === 'string') {
        keysToInvalidate.add(keyOrFunc);
      } else {
        const keys = keyOrFunc();
        keys.forEach((key: string) => keysToInvalidate.add(key));
      }
    });

    // Process dependent entities
    rule.entities.forEach(depEntity => {
      this.collectInvalidations(depEntity, processed, keysToInvalidate);
    });
  }

  /**
   * Invalidate specific query key (for edge cases)
   */
  invalidateKey(queryKey: string | string[]): void {
    const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    queryClient.invalidateQueries();
    console.debug('All caches invalidated');
  }

  /**
   * Clear backend performance cache
   */
  async clearBackendCache(keys?: string[]): Promise<void> {
    try {
      await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: keys || [] })
      });
    } catch (error) {
      console.error('Failed to clear backend cache:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();