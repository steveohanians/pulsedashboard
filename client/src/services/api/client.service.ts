import { BaseService } from './base.service';
import { eventBus } from '@/services/events/EventBus';
import { cacheManager } from '../cache/CacheManager';
import { apiRequest } from '@/lib/queryClient';

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
    const client = await this.create(data);
    
    eventBus.emit('client.created', { clientId: client.id, hasGA4: !!data.ga4PropertyId });
    
    if (data.ga4PropertyId) {
      eventBus.emit('client.ga4.connected', { 
        clientId: client.id, 
        propertyId: data.ga4PropertyId 
      });
      
      // Auto-trigger sync if requested
      if (data.enableGA4Sync) {
        this.triggerGA4Sync(client.id);
      }
    }
    
    return client;
  }

  /**
   * Create new item
   */
  async create<T = any>(data: any): Promise<T> {
    const result = await super.create(data);
    cacheManager.invalidate('client');
    return result;
  }

  /**
   * Update existing item
   */
  async update<T = any>(id: string, data: any): Promise<T> {
    const result = await super.update(id, data);
    cacheManager.invalidate('client');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('client');
  }

  /**
   * Fetch and set client icon/logo
   */
  async fetchIcon(id: string, domain?: string): Promise<{ iconUrl?: string; message: string }> {
    const result = await this.request('POST', `/${id}/fetch-icon`, { domain });
    cacheManager.invalidate('client');
    return result;
  }

  /**
   * Clear client icon/logo
   */
  async clearIcon(id: string): Promise<void> {
    await this.request('DELETE', `/${id}/clear-icon`);
    cacheManager.invalidate('client');
  }

  /**
   * Trigger complete GA4 data sync for client
   */
  async triggerGA4Sync(id: string): Promise<{ message: string }> {
    eventBus.emit('ga4.sync.started', { clientId: id });
    
    try {
      // Use apiRequest directly since this endpoint is not under the clients basePath
      const result = await apiRequest('POST', `/api/admin/ga4/complete-data-sync/${id}`);
      cacheManager.invalidate('client', 'ga4');
      eventBus.emit('ga4.sync.completed', { clientId: id, result });
      return result;
    } catch (error) {
      eventBus.emit('ga4.sync.failed', { clientId: id, error });
      throw error;
    }
  }
}