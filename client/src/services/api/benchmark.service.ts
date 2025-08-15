import { BaseService } from './base.service';
import { cacheManager } from '../cache/CacheManager';

/**
 * Benchmark service
 * Handles benchmark companies management operations
 */
export class BenchmarkService extends BaseService {
  constructor() {
    super('/api/admin/benchmark-companies');
  }

  /**
   * Create a new benchmark company
   */
  async create(data: {
    name: string;
    websiteUrl: string;
    industryVertical: string;
    businessSize: string;
  }): Promise<any> {
    const result = await super.create(data);
    cacheManager.invalidate('benchmark');
    return result;
  }

  /**
   * Update benchmark company
   */
  async update(id: string, data: {
    name?: string;
    websiteUrl?: string;
    industryVertical?: string;
    businessSize?: string;
    status?: string;
  }): Promise<any> {
    const result = await super.update(id, data);
    cacheManager.invalidate('benchmark');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('benchmark');
  }

  /**
   * Preview CSV import data
   */
  async csvPreview(file: File): Promise<{
    headers: string[];
    rows: any[];
    totalRows: number;
  }> {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    return this.request('POST', '/csv-preview', formData);
  }

  /**
   * Import CSV data
   */
  async csvImport(file: File): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    message: string;
  }> {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    const result = await this.request('POST', '/csv-import', formData);
    cacheManager.invalidate('benchmark');
    return result;
  }

  /**
   * Resync competitor SEMrush data
   */
  async resyncCompetitorSemrush(id: string): Promise<{ message: string }> {
    const result = await this.request('POST', `/api/admin/competitors/${id}/resync-semrush`);
    cacheManager.invalidate('competitor');
    return result;
  }
}