import { apiRequest } from '@/lib/queryClient';
import { cacheManager } from '../cache/CacheManager';

/**
 * GA4 service
 * Handles GA4 integration, data sync, and property management operations
 */
export class GA4Service {
  /**
   * Execute complete GA4 data sync for client
   */
  async executeCompleteDataSync(clientId: string): Promise<{ message: string }> {
    const result = await apiRequest('POST', `/api/admin/ga4/complete-data-sync/${clientId}`);
    cacheManager.invalidate('ga4');
    return result;
  }

  /**
   * Populate historical GA4 data for client
   */
  async populateHistorical(clientId: string): Promise<{ message: string }> {
    const result = await apiRequest('POST', `/api/admin/ga4/populate-historical/${clientId}`);
    cacheManager.invalidate('ga4');
    return result;
  }

  /**
   * Refresh current daily GA4 data for client
   */
  async refreshCurrentDaily(clientId: string): Promise<{ message: string }> {
    const result = await apiRequest('POST', `/api/admin/ga4/refresh-current-daily/${clientId}`);
    cacheManager.invalidate('ga4');
    return result;
  }

  /**
   * Validate GA4 access for client
   */
  async validateAccess(clientId: string): Promise<{ 
    hasAccess: boolean; 
    propertyId?: string; 
    message: string; 
  }> {
    return apiRequest('GET', `/api/admin/ga4/validate-access/${clientId}`);
  }

  /**
   * Get GA4 service accounts
   */
  async getServiceAccounts(): Promise<any[]> {
    return apiRequest('GET', '/api/admin/ga4-service-accounts');
  }

  /**
   * Update GA4 service account status
   */
  async updateServiceAccount(id: string, data: { active: boolean }): Promise<any> {
    const result = await apiRequest('PUT', `/api/admin/ga4-service-accounts/${id}`, data);
    cacheManager.invalidate('ga4');
    return result;
  }

  /**
   * Delete GA4 service account
   */
  async deleteServiceAccount(id: string): Promise<void> {
    await apiRequest('DELETE', `/api/admin/ga4-service-accounts/${id}`);
    cacheManager.invalidate('ga4');
  }

  /**
   * Get GA4 property access for client
   */
  async getPropertyAccess(clientId: string): Promise<any> {
    return apiRequest('GET', `/api/admin/ga4-property-access/client/${clientId}`);
  }

  /**
   * Create GA4 property access
   */
  async createPropertyAccess(data: {
    clientId: string;
    propertyId: string;
    serviceAccountId: string;
  }): Promise<any> {
    const result = await apiRequest('POST', '/api/admin/ga4-property-access', data);
    cacheManager.invalidate('ga4');
    return result;
  }

  /**
   * Verify GA4 property access
   */
  async verifyPropertyAccess(accessId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('POST', `/api/admin/ga4-property-access/${accessId}/verify`);
  }

  /**
   * Test OAuth connection for service account
   */
  async testOAuthConnection(accountId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('POST', `/api/oauth/google/test/${accountId}`);
  }

  /**
   * Authorize OAuth for service account (returns popup URL)
   */
  getOAuthAuthorizationUrl(accountId: string): string {
    return `/api/oauth/google/authorize/${accountId}`;
  }

  /**
   * Debug GA4 July data
   */
  async debugGA4July(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/debug/ga4-july');
  }

  /**
   * Refresh GA4 data
   */
  async refreshGA4Data(data: { clientId: string; period: string }): Promise<{ message: string }> {
    return apiRequest('POST', '/api/refresh-ga4-data', data);
  }

  /**
   * Generate current period data (admin only)
   */
  async generateCurrentPeriodData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/admin/generate-current-period-data');
  }
}