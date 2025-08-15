import { BaseService } from './base.service';
import { cacheManager } from '../cache/CacheManager';

/**
 * Competitor service
 * Handles competitor management operations
 */
export class CompetitorService extends BaseService {
  constructor() {
    super('/api/competitors');
  }

  /**
   * Create a new competitor
   */
  async create(data: {
    domain: string;
    label?: string;
    clientId: string;
  }): Promise<any> {
    const result = await super.create(data);
    cacheManager.invalidate('competitor');
    return result;
  }

  /**
   * Update competitor
   */
  async update(id: string, data: {
    domain?: string;
    label?: string;
    status?: string;
  }): Promise<any> {
    const result = await super.update(id, data);
    cacheManager.invalidate('competitor');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('competitor');
  }
}