import { apiRequest } from '@/lib/queryClient';

/**
 * Dashboard service
 * Handles dashboard data, filters, and caching operations
 */
export class DashboardService {
  /**
   * Get dashboard data for a client
   */
  async getDashboard(
    clientId: string,
    params: {
      timePeriod?: string;
      businessSize?: string;
      industryVertical?: string;
    } = {}
  ): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.timePeriod) searchParams.set('timePeriod', params.timePeriod);
    if (params.businessSize) searchParams.set('businessSize', params.businessSize);
    if (params.industryVertical) searchParams.set('industryVertical', params.industryVertical);

    const queryString = searchParams.toString();
    const url = `/api/dashboard/${clientId}${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest('GET', url);
  }

  /**
   * Get filter options
   */
  async getFilters(params: {
    businessSize?: string;
    industryVertical?: string;
  } = {}): Promise<{
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
  }> {
    const searchParams = new URLSearchParams();
    if (params.businessSize) searchParams.set('businessSize', params.businessSize);
    if (params.industryVertical) searchParams.set('industryVertical', params.industryVertical);

    const queryString = searchParams.toString();
    const url = `/api/filters${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest('GET', url);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    cache: any;
    backgroundProcessor: any;
    optimizations: any;
  }> {
    return apiRequest('GET', '/api/cache-stats');
  }
}