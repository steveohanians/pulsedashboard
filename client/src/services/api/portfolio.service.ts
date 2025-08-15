import { BaseService } from './base.service';

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
    return super.create(data);
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
    return super.update(id, data);
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
    return this.request('POST', `/${id}/resync-semrush`);
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
    return this.request('POST', '/recalculate-averages');
  }

  /**
   * Fix portfolio averages (admin debug)
   */
  async fixPortfolioAverages(): Promise<{ message: string }> {
    return this.request('POST', '/api/admin/fix-portfolio-averages');
  }
}