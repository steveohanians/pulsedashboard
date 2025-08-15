import { BaseService } from './base.service';
import { cacheManager } from '../cache/CacheManager';

/**
 * Filter service
 * Handles filter options management operations
 */
export class FilterService extends BaseService {
  constructor() {
    super('/api/admin/filter-options');
  }

  /**
   * Create a new filter option
   */
  async create(data: {
    type: 'business_size' | 'industry_vertical';
    value: string;
    sortOrder?: number;
  }): Promise<any> {
    const result = await super.create(data);
    cacheManager.invalidate('filter');
    return result;
  }

  /**
   * Update filter option
   */
  async update(id: string, data: {
    value?: string;
    sortOrder?: number;
  }): Promise<any> {
    const result = await super.update(id, data);
    cacheManager.invalidate('filter');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('filter');
  }
}