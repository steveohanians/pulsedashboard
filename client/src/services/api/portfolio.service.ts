import { BaseService } from './base.service';
import { cacheManager } from '../cache/CacheManager';

/**
 * Portfolio service
 * Handles CD Portfolio companies management operations
 */
export class PortfolioService extends BaseService {
  constructor() {
    super('/api/admin/cd-portfolio');
  }

  /**
   * Create a new CD Portfolio company
   */
  async create(data: {
    name: string;
    domain: string;
    industryVertical: string;
    businessSize: string;
  }): Promise<any> {
    const result = await super.create(data);
    cacheManager.invalidate('portfolio');
    return result;
  }

  /**
   * Update CD Portfolio company
   */
  async update(id: string, data: {
    name?: string;
    domain?: string;
    industryVertical?: string;
    businessSize?: string;
    status?: string;
  }): Promise<any> {
    const result = await super.update(id, data);
    cacheManager.invalidate('portfolio');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('portfolio');
  }

  /**
   * Get company data
   */
  async getCompanyData(id: string): Promise<any> {
    return this.request('GET', `/${id}/data`);
  }

  /**
   * Resync SEMrush data for company
   */
  async resyncSemrush(id: string): Promise<{ message: string }> {
    const result = await this.request('POST', `/${id}/resync-semrush`);
    cacheManager.invalidate('portfolio');
    return result;
  }

  /**
   * Test SEMrush connection for company
   */
  async testSemrush(id: string): Promise<{ success: boolean; message: string }> {
    return this.request('POST', `/${id}/test-semrush`);
  }

  /**
   * Recalculate portfolio averages
   */
  async recalculateAverages(): Promise<{ message: string; updated: number }> {
    const result = await this.request('POST', '/recalculate-averages');
    cacheManager.invalidate('portfolio');
    return result;
  }

  /**
   * Fix portfolio averages (admin debug)
   */
  async fixPortfolioAverages(): Promise<{ message: string }> {
    const result = await this.request('POST', '/api/admin/fix-portfolio-averages');
    cacheManager.invalidate('portfolio');
    return result;
  }
}