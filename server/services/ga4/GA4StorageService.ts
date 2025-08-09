/**
 * GA4 Storage Service
 * 
 * Handles all database storage operations for GA4 data.
 */

import { storage } from '../../storage';
import logger from '../../utils/logging/logger';
import { METRIC_NAMES } from './constants';
import type { GA4MetricData, GA4DailyMetric, ExistingDataStatus, DataPeriod } from './types';

export class GA4StorageService {

  /**
   * Store GA4 metrics for a specific period
   */
  async storeGA4Metrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    try {
      // Store main metrics
      await this.storeMainMetrics(clientId, period, data);
      
      // Store traffic channel data
      await this.storeTrafficChannels(clientId, period, data.trafficChannels);
      
      // Store device distribution data
      await this.storeDeviceDistribution(clientId, period, data.deviceDistribution);

      logger.info(`Stored GA4 metrics for client ${clientId}, period ${period}`);
    } catch (error) {
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
   * Store main metrics in database
   */
  private async storeMainMetrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    const metrics = [
      { name: METRIC_NAMES.BOUNCE_RATE, value: data.bounceRate.toFixed(2) },
      { name: METRIC_NAMES.SESSION_DURATION, value: data.sessionDuration.toFixed(2) },
      { name: METRIC_NAMES.PAGES_PER_SESSION, value: data.pagesPerSession.toFixed(2) },
      { name: METRIC_NAMES.SESSIONS_PER_USER, value: data.sessionsPerUser.toFixed(2) }
    ];

    for (const metric of metrics) {
      await storage.createMetric({
        clientId,
        metricName: metric.name,
        value: metric.value,
        sourceType: 'Client',
        timePeriod: period
      });
    }
  }

  /**
   * Store traffic channel data
   */
  private async storeTrafficChannels(clientId: string, period: string, channels: GA4MetricData['trafficChannels']): Promise<void> {
    // Store as JSON array in value field
    await storage.createMetric({
      clientId,
      metricName: METRIC_NAMES.TRAFFIC_CHANNELS,
      value: JSON.stringify(channels),
      sourceType: 'Client',
      timePeriod: period
    });
  }

  /**
   * Store device distribution data
   */
  private async storeDeviceDistribution(clientId: string, period: string, devices: GA4MetricData['deviceDistribution']): Promise<void> {
    // Store as JSON array in value field
    await storage.createMetric({
      clientId,
      metricName: METRIC_NAMES.DEVICE_DISTRIBUTION,
      value: JSON.stringify(devices),
      sourceType: 'Client',
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