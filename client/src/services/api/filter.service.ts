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
    // Transform the data to match backend expectations
    const backendData = {
      category: data.type === 'business_size' ? 'businessSizes' : 'industryVerticals',
      value: data.value,
      order: data.sortOrder || 0
    };
    
    const result = await super.create(backendData);
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
    // Transform the data to match backend expectations
    const backendData: any = {};
    if (data.value !== undefined) backendData.value = data.value;
    if (data.sortOrder !== undefined) backendData.order = data.sortOrder;
    
    const result = await super.update(id, backendData);
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