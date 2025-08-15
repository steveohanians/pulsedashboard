import { BaseService } from './base.service';

/**
 * Client service
 * Handles admin client management operations
 */
export class ClientService extends BaseService {
  constructor() {
    super('/api/admin/clients');
  }

  /**
   * Create client with optional GA4 setup
   */
  async createWithGA4Setup(data: {
    name: string;
    websiteUrl: string;
    industryVertical: string;
    businessSize: string;
    ga4PropertyId?: string;
    enableGA4Sync?: boolean;
  }): Promise<any> {
    return this.create(data);
  }

  /**
   * Fetch and set client icon/logo
   */
  async fetchIcon(id: string, domain?: string): Promise<{ iconUrl?: string; message: string }> {
    return this.request('POST', `/${id}/fetch-icon`, { domain });
  }

  /**
   * Clear client icon/logo
   */
  async clearIcon(id: string): Promise<void> {
    return this.request('DELETE', `/${id}/clear-icon`);
  }

  /**
   * Trigger complete GA4 data sync for client
   */
  async triggerGA4Sync(id: string): Promise<{ message: string }> {
    return this.request('POST', `/api/admin/ga4/complete-data-sync/${id}`);
  }
}