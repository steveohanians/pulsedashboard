/**
 * GA4 Storage Service
 * 
 * Handles all database storage operations for GA4 data.
 */

import { storage } from '../../storage';
import logger from '../../utils/logging/logger';
import { METRIC_NAMES } from './constants';
import type { GA4MetricData, GA4DailyMetric, ExistingDataStatus, DataPeriod } from './types';
import { transformGA4ToCanonical } from '../../utils/metricTransformers';

export class GA4StorageService {

  /**
   * Store GA4 metrics for a specific period
   */
  async storeGA4Metrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    try {
      console.log(`[GA4 SYNC] Storing metrics for clientId: ${clientId}, period: ${period}`);
      
      // Store main metrics
      await this.storeMainMetrics(clientId, period, data);
      
      // Store traffic channel data
      await this.storeTrafficChannels(clientId, period, data.trafficChannels);
      
      // Store device distribution data
      await this.storeDeviceDistribution(clientId, period, data.deviceDistribution);

      console.log(`[GA4 SYNC] Successfully stored all metrics for clientId: ${clientId}, period: ${period}`);
      logger.info(`Stored GA4 metrics for client ${clientId}, period ${period}`);
    } catch (error) {
      console.error(`[GA4 SYNC] Error storing metrics for clientId: ${clientId}, period: ${period}:`, error);
      logger.error(`Error storing GA4 metrics for ${clientId}, period ${period}:`, error);
      throw error;
    }
  }

  /**
   * Store daily GA4 metrics
   */
  async storeDailyGA4Metrics(clientId: string, period: string, dailyData: GA4DailyMetric[]): Promise<void> {
    try {
      for (const dayData of dailyData) {
        await this.storeDailyMetrics(clientId, period, dayData);
      }

      logger.info(`Stored ${dailyData.length} daily GA4 metrics for client ${clientId}, period ${period}`);
    } catch (error) {
      logger.error(`Error storing daily GA4 metrics for ${clientId}, period ${period}:`, error);
      throw error;
    }
  }

  /**
   * Check existing data status for multiple periods
   */
  async checkExistingData(clientId: string, periods: DataPeriod[]): Promise<Map<string, ExistingDataStatus[]>> {
    const statusMap = new Map<string, ExistingDataStatus[]>();

    for (const period of periods) {
      const status = await this.checkPeriodDataStatus(clientId, period.period);
      statusMap.set(period.period, status);
    }

    return statusMap;
  }

  /**
   * Clear existing client data for a specific period
   */
  async clearClientDataForPeriod(clientId: string, period: string): Promise<void> {
    try {
      await storage.clearClientMetricsByPeriod(clientId, period);
      logger.debug(`Cleared existing data for client ${clientId}, period ${period}`);
    } catch (error) {
      logger.error(`Error clearing data for ${clientId}, period ${period}:`, error);
      throw error;
    }
  }

  /**
   * Clear ALL existing GA4 data for a client (all periods)
   */
  async clearAllClientData(clientId: string): Promise<void> {
    try {
      await storage.clearAllClientMetrics(clientId);
      logger.info(`Cleared ALL GA4 data for client ${clientId}`);
    } catch (error) {
      logger.error(`Error clearing all data for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Replace daily data with monthly summary for optimization
   */
  async replaceDailyWithMonthly(clientId: string, period: DataPeriod, monthlyData: GA4MetricData): Promise<void> {
    try {
      // Clear existing daily data
      await this.clearClientDataForPeriod(clientId, period.period);
      
      // Store monthly summary
      await this.storeGA4Metrics(clientId, period.period, monthlyData);
      
      logger.info(`Replaced daily data with monthly summary for ${period.period}`);
    } catch (error) {
      logger.error(`Error replacing daily with monthly data for ${period.period}:`, error);
      throw error;
    }
  }

  /**
   * Validate clientId and get client details for metric storage
   */
  private async validateClientForStorage(clientId: string): Promise<any> {
    // Validate clientId
    if (!clientId || clientId === 'undefined' || clientId === 'null') {
      throw new Error('Invalid clientId for metric storage');
    }
    
    // Double-check we're not using the wrong client
    const { storage } = await import('../../storage');
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Cannot store metrics - client ${clientId} not found`);
    }
    
    return client;
  }

  /**
   * Store GA4 metric with comprehensive validation
   */
  private async storeGA4Metric(clientId: string, metricData: any): Promise<void> {
    const client = await this.validateClientForStorage(clientId);
    
    console.log(`[GA4] Storing metric for ${client.name} (${clientId}): ${metricData.metricName}`);
    
    // Store with explicit clientId
    const { storage } = await import('../../storage');
    await storage.createMetric({
      ...metricData,
      clientId: clientId, // Explicitly set
      sourceType: 'Client'
    });
  }

  /**
   * Store main metrics in database
   */
  private async storeMainMetrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    const metrics = [
      { name: METRIC_NAMES.BOUNCE_RATE, value: data.bounceRate.toFixed(2) },
      { name: METRIC_NAMES.SESSION_DURATION, value: data.sessionDuration.toFixed(2) },
      { name: METRIC_NAMES.PAGES_PER_SESSION, value: data.pagesPerSession.toFixed(2) },
      { name: METRIC_NAMES.SESSIONS_PER_USER, value: data.sessionsPerUser.toFixed(2) }
    ];

    const enableCanonicalEnvelope = process.env.FEATURE_CANONICAL_ENVELOPE === 'true';

    for (const metric of metrics) {
      let metricData: any = {
        clientId, // MUST use the passed clientId parameter
        metricName: metric.name,
        value: metric.value,
        sourceType: 'Client',
        timePeriod: period
      };
      
      console.log(`[GA4 SYNC] Creating metric: ${metric.name} for clientId: ${clientId}, value: ${metric.value}`);

      // Add canonical envelope transformation if feature is enabled
      if (enableCanonicalEnvelope) {
        try {
          const canonicalEnvelope = transformGA4ToCanonical(
            metric.name,
            parseFloat(metric.value),
            period
          );
          metricData.canonicalEnvelope = canonicalEnvelope;
          
          logger.debug(`Created canonical envelope for ${metric.name}`, {
            sourceType: canonicalEnvelope.meta.sourceType,
            units: canonicalEnvelope.meta.units,
            seriesCount: canonicalEnvelope.series.length
          });
        } catch (error) {
          logger.warn(`Failed to create canonical envelope for ${metric.name}:`, error);
          // Continue with legacy format if transformation fails
        }
      }

      // Use enhanced validation method
      await this.storeGA4Metric(clientId, metricData);
    }
  }

  /**
   * Store traffic channel data
   */
  private async storeTrafficChannels(clientId: string, period: string, channels: GA4MetricData['trafficChannels']): Promise<void> {
    console.log(`[GA4 SYNC] Storing traffic channels for clientId: ${clientId}, period: ${period}, channels: ${channels.length}`);
    
    // Use enhanced validation method
    await this.storeGA4Metric(clientId, {
      metricName: METRIC_NAMES.TRAFFIC_CHANNELS,
      value: JSON.stringify(channels),
      timePeriod: period
    });
  }

  /**
   * Store device distribution data
   */
  private async storeDeviceDistribution(clientId: string, period: string, devices: GA4MetricData['deviceDistribution']): Promise<void> {
    console.log(`[GA4 SYNC] Storing device distribution for clientId: ${clientId}, period: ${period}, devices: ${devices.length}`);
    
    // Use enhanced validation method
    await this.storeGA4Metric(clientId, {
      metricName: METRIC_NAMES.DEVICE_DISTRIBUTION,
      value: JSON.stringify(devices),
      timePeriod: period
    });
  }

  /**
   * Store daily metrics for a specific day
   */
  private async storeDailyMetrics(clientId: string, period: string, dayData: GA4DailyMetric): Promise<void> {
    const metrics = [
      { name: METRIC_NAMES.BOUNCE_RATE, value: dayData.metrics.bounceRate.toFixed(2) },
      { name: METRIC_NAMES.SESSION_DURATION, value: dayData.metrics.sessionDuration.toFixed(2) },
      { name: METRIC_NAMES.PAGES_PER_SESSION, value: dayData.metrics.pagesPerSession.toFixed(2) },
      { name: METRIC_NAMES.SESSIONS_PER_USER, value: dayData.metrics.sessionsPerUser.toFixed(2) }
    ];

    for (const metric of metrics) {
      await storage.createMetric({
        clientId,
        metricName: metric.name,
        value: metric.value,
        sourceType: 'Client',
        timePeriod: `${period}-daily-${dayData.date}`
      });
    }
  }

  /**
   * Check data status for a specific period
   */
  private async checkPeriodDataStatus(clientId: string, period: string): Promise<ExistingDataStatus[]> {
    try {
      // Check for existing monthly data
      const monthlyMetrics = await storage.getMetricsByClient(clientId, period);
      
      // Check for existing daily data
      const dailyMetrics = await storage.getDailyClientMetrics(clientId, period);

      const status: ExistingDataStatus[] = [];

      // Analyze each metric type
      for (const metricName of Object.values(METRIC_NAMES)) {
        const monthlyCount = monthlyMetrics.filter((m: any) => m.metricName === metricName).length;
        const dailyCount = dailyMetrics.filter((m: any) => m.metricName === metricName).length;

        let dataType: 'daily' | 'monthly' | 'none' = 'none';
        let recordCount = 0;

        if (dailyCount > 0) {
          dataType = 'daily';
          recordCount = dailyCount;
        } else if (monthlyCount > 0) {
          dataType = 'monthly';
          recordCount = monthlyCount;
        }

        status.push({
          period,
          metricName,
          dataType,
          recordCount
        });
      }

      return status;
    } catch (error) {
      logger.error(`Error checking data status for ${period}:`, error);
      return [];
    }
  }
}