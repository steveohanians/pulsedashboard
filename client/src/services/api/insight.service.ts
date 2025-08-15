import { apiRequest } from '@/lib/queryClient';
import { cacheManager } from '../cache/CacheManager';

/**
 * Insight service
 * Handles AI insights generation and context management operations
 */
export class InsightService {
  /**
   * Generate insight for specific metric
   */
  async generateForMetric(
    clientId: string,
    metricName: string,
    data: {
      metricValue: number;
      benchmarks?: any[];
      context?: string;
    }
  ): Promise<{ insight: string; recommendations: string[]; message: string }> {
    const result = await apiRequest('POST', `/api/generate-metric-insight/${clientId}`, {
      metricName,
      ...data
    });
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Generate insight with context
   */
  async generateWithContext(
    clientId: string,
    data: {
      metricName: string;
      metricValue: number;
      benchmarks?: any[];
      context?: string;
    }
  ): Promise<{ insight: string; recommendations: string[]; message: string }> {
    const result = await apiRequest('POST', `/api/generate-metric-insight-with-context/${clientId}`, data);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Generate comprehensive insights for client
   */
  async generateComprehensive(
    clientId: string,
    data: {
      timePeriod?: string;
      includeContext?: boolean;
    } = {}
  ): Promise<{ 
    insights: any[]; 
    generated: number; 
    message: string; 
  }> {
    const result = await apiRequest('POST', `/api/generate-comprehensive-insights/${clientId}`, data);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Get AI insights for client
   */
  async getWithContext(
    clientId: string,
    params: {
      period?: string;
      timePeriod?: string;
    } = {}
  ): Promise<{
    status: 'available' | 'pending' | 'generating' | 'error';
    insights: any[];
    message?: string;
  }> {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.set('period', params.period);
    if (params.timePeriod) searchParams.set('timePeriod', params.timePeriod);

    const queryString = searchParams.toString();
    const url = `/api/ai-insights/${clientId}${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest('GET', url);
  }

  /**
   * Get versioned insights
   */
  async getVersioned(clientId: string): Promise<{
    status: string;
    insights: any[];
    version?: number;
  }> {
    return apiRequest('GET', `/api/v2/ai-insights/${clientId}`);
  }

  /**
   * Get version status for polling
   */
  async getVersionStatus(clientId: string): Promise<{
    version: number;
    status: string;
    generatedAt?: string;
  }> {
    return apiRequest('GET', `/api/v2/ai-insights/${clientId}/status`);
  }

  /**
   * Force regenerate insights
   */
  async forceRegenerate(clientId: string): Promise<{ message: string; version: number }> {
    const result = await apiRequest('POST', `/api/v2/ai-insights/${clientId}/regenerate`);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Delete insight and context
   */
  async deleteInsightAndContext(
    clientId: string,
    metricName: string,
    period?: string
  ): Promise<{ ok: boolean; deleted: any }> {
    const searchParams = new URLSearchParams();
    if (period) searchParams.set('period', period);

    const queryString = searchParams.toString();
    const url = `/api/ai-insights/${clientId}/${metricName}${queryString ? `?${queryString}` : ''}`;
    
    const result = await apiRequest('DELETE', url);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Delete versioned insight
   */
  async deleteVersioned(
    clientId: string,
    metricName: string
  ): Promise<{ ok: boolean; deleted: any }> {
    const result = await apiRequest('DELETE', `/api/v2/ai-insights/${clientId}/${metricName}`);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Get insight context
   */
  async getContext(
    clientId: string,
    metricName: string
  ): Promise<{ context?: string; hasContext: boolean }> {
    return apiRequest('GET', `/api/insight-context/${clientId}/${metricName}`);
  }

  /**
   * Update insight context
   */
  async updateContext(
    clientId: string,
    metricName: string,
    context: string
  ): Promise<{ message: string }> {
    const result = await apiRequest('POST', `/api/insight-context/${clientId}/${metricName}`, { context });
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Delete insight context
   */
  async deleteContext(
    clientId: string,
    metricName: string
  ): Promise<{ ok: boolean }> {
    const result = await apiRequest('DELETE', `/api/insight-context/${clientId}/${metricName}`);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Get all insights (legacy)
   */
  async getAll(params: {
    clientId?: string;
    period?: string;
  } = {}): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params.clientId) searchParams.set('clientId', params.clientId);
    if (params.period) searchParams.set('period', params.period);

    const queryString = searchParams.toString();
    const url = `/api/insights${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest('GET', url);
  }

  /**
   * Generate insights (legacy)
   */
  async generate(
    clientId: string,
    data: {
      metricName?: string;
      period?: string;
      context?: string;
    } = {}
  ): Promise<{ message: string; generated: number }> {
    const result = await apiRequest('POST', `/api/generate-insights/${clientId}`, data);
    cacheManager.invalidate('insight');
    return result;
  }

  /**
   * Clear all insights (debug)
   */
  async clearAll(): Promise<{ message: string; deleted: number }> {
    const result = await apiRequest('DELETE', '/api/debug/clear-all-insights');
    cacheManager.invalidate('insight');
    return result;
  }
}