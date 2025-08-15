import { BaseService } from './base.service';

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
    domain: string;
    industryVertical: string;
    businessSize: string;
  }): Promise<any> {
    return super.create(data);
  }

  /**
   * Update benchmark company
   */
  async update(id: string, data: {
    name?: string;
    domain?: string;
    industryVertical?: string;
    businessSize?: string;
    status?: string;
  }): Promise<any> {
    return super.update(id, data);
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
    
    return this.request('POST', '/csv-import', formData);
  }

  /**
   * Resync competitor SEMrush data
   */
  async resyncCompetitorSemrush(id: string): Promise<{ message: string }> {
    return this.request('POST', `/api/admin/competitors/${id}/resync-semrush`);
  }
}