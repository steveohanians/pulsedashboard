import { apiRequest } from '@/lib/queryClient';
import { cacheManager } from '../cache/CacheManager';

/**
 * Metric service
 * Handles metrics data and metric prompts operations
 */
export class MetricService {
  /**
   * Get daily metrics for client
   */
  async getDailyMetrics(
    clientId: string,
    period: string,
    metricName: string
  ): Promise<{
    success: boolean;
    data: any[];
    count: number;
  }> {
    return apiRequest('GET', `/api/metrics/daily/${clientId}/${period}/${metricName}`);
  }

  /**
   * Create metric data
   */
  async createMetric(data: {
    clientId: string;
    metricName: string;
    value: number | string;
    sourceType: string;
    timePeriod: string;
    channel?: string;
    competitorId?: string;
  }): Promise<any> {
    return apiRequest('POST', '/api/metrics', data);
  }

  /**
   * Create benchmark data
   */
  async createBenchmark(data: {
    metricName: string;
    value: number;
    sourceType: string;
    timePeriod: string;
    businessSize?: string;
    industryVertical?: string;
  }): Promise<any> {
    return apiRequest('POST', '/api/benchmarks', data);
  }

  /**
   * Get metric prompts (admin)
   */
  async getPrompts(): Promise<any[]> {
    return apiRequest('GET', '/api/admin/metric-prompts');
  }

  /**
   * Create metric prompt (admin)
   */
  async createPrompt(data: {
    metricName: string;
    promptTemplate: string;
    isActive?: boolean;
  }): Promise<any> {
    const result = await apiRequest('POST', '/api/admin/metric-prompts', data);
    cacheManager.invalidate('metric');
    return result;
  }

  /**
   * Update metric prompt (admin)
   */
  async updatePrompt(
    metricName: string,
    data: {
      promptTemplate?: string;
      isActive?: boolean;
    }
  ): Promise<any> {
    const result = await apiRequest('PUT', `/api/admin/metric-prompts/${metricName}`, data);
    cacheManager.invalidate('metric');
    return result;
  }

  /**
   * Delete metric prompt (admin)
   */
  async deletePrompt(metricName: string): Promise<void> {
    await apiRequest('DELETE', `/api/admin/metric-prompts/${metricName}`);
    cacheManager.invalidate('metric');
  }

  /**
   * Get global prompt template (admin)
   */
  async getGlobalTemplate(): Promise<{
    template: string;
    lastUpdated?: string;
  }> {
    return apiRequest('GET', '/api/admin/global-prompt-template');
  }

  /**
   * Update global prompt template (admin)
   */
  async updateGlobalTemplate(template: string): Promise<{ message: string }> {
    const result = await apiRequest('PUT', '/api/admin/global-prompt-template', { template });
    cacheManager.invalidate('metric');
    return result;
  }

  /**
   * Generate bounce rate data
   */
  async generateBounceRateData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-bounce-rate-data');
  }

  /**
   * Generate session duration data
   */
  async generateSessionDurationData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-session-duration-data');
  }

  /**
   * Generate pages per session data
   */
  async generatePagesPerSessionData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-pages-per-session-data');
  }

  /**
   * Generate sessions per user data
   */
  async generateSessionsPerUserData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-sessions-per-user-data');
  }

  /**
   * Generate comprehensive data
   */
  async generateComprehensiveData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-comprehensive-data');
  }

  /**
   * Generate dynamic data
   */
  async generateDynamicData(): Promise<{ message: string }> {
    return apiRequest('POST', '/api/generate-dynamic-data');
  }
}