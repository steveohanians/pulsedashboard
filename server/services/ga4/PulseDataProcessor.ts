/**
 * GA4 Data Processing Service
 * Handles transformation of GA4 data into Pulse Dashboard™ metrics
 */

import { db } from '../../db';
import { metrics, clients, type InsertMetric } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../../utils/logging/logger';

export interface GA4RawData {
  sessions: number;
  bounceRate: number;
  averageSessionDuration: number;
  screenPageViewsPerSession: number;
  sessionsPerUser: number;
  channelData: {
    channel: string;
    sessions: number;
  }[];
  deviceDistribution: {
    device: string;
    sessions: number;
    percentage: number;
  }[];
  timePeriod: string;
}

export class GA4DataProcessor {
  
  /**
   * Process GA4 data and store as client metrics
   */
  async processClientGA4Data(clientId: string, ga4Data: GA4RawData) {
    try {
      logger.info(`Processing GA4 data for client ${clientId}`);

      // Delete existing client metrics for this time period
      await db.delete(metrics)
        .where(
          and(
            eq(metrics.clientId, clientId),
            eq(metrics.timePeriod, ga4Data.timePeriod),
            eq(metrics.sourceType, 'Client')
          )
        );

      // Transform and insert new metrics
      const metricRecords = this.transformGA4ToMetrics(clientId, ga4Data);
      
      for (const metric of metricRecords) {
        await db.insert(metrics).values(metric);
      }

      logger.info(`Successfully processed ${metricRecords.length} GA4 metrics for client ${clientId}`);
      return metricRecords.length;

    } catch (error) {
      logger.error(`Failed to process GA4 data for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Transform GA4 raw data into our metric format
   */
  private transformGA4ToMetrics(clientId: string, ga4Data: GA4RawData): InsertMetric[] {
    const metricRecords: InsertMetric[] = [];

    // Core metrics
    const coreMetrics = [
      { name: 'Sessions', value: ga4Data.sessions },
      { name: 'Bounce Rate', value: Math.round(ga4Data.bounceRate * 100) }, // Convert to percentage
      { name: 'Session Duration', value: Math.round(ga4Data.averageSessionDuration) }, // Convert to seconds
      { name: 'Pages per Session', value: Math.round(ga4Data.screenPageViewsPerSession * 100) / 100 },
      { name: 'Sessions per User', value: Math.round(ga4Data.sessionsPerUser * 100) / 100 },
    ];

    // Add core metrics
    coreMetrics.forEach(metric => {
      metricRecords.push({
        clientId,
        metricName: metric.name,
        value: JSON.stringify(metric.value),
        sourceType: 'Client' as const,
        timePeriod: ga4Data.timePeriod,
        createdAt: new Date(),
      });
    });

    // Add traffic channel data
    ga4Data.channelData.forEach(channelData => {
      metricRecords.push({
        clientId,
        metricName: 'Traffic Channels',
        value: JSON.stringify(channelData.sessions),
        sourceType: 'Client' as const,
        timePeriod: ga4Data.timePeriod,
        channel: channelData.channel,
        createdAt: new Date(),
      });
    });

    // Add authentic device distribution from GA4 API
    ga4Data.deviceDistribution.forEach(device => {
      metricRecords.push({
        clientId,
        metricName: 'Device Distribution',
        value: JSON.stringify(device.sessions),
        sourceType: 'Client' as const,
        timePeriod: ga4Data.timePeriod,
        channel: device.device,
        createdAt: new Date(),
      });
    });

    return metricRecords;
  }

  /**
   * REMOVED: generateDeviceDistribution function
   * All device distribution data now comes from authentic GA4 API sources via deviceDistribution field
   */

  /**
   * Test data processing with sample GA4 data
   */
  async testDataProcessing(clientId: string) {
    const sampleGA4Data: GA4RawData = {
      sessions: 15420,
      bounceRate: 0.42, // 42%
      averageSessionDuration: 185, // 3:05 minutes
      screenPageViewsPerSession: 2.8,
      sessionsPerUser: 1.35,
      channelData: [
        { channel: 'Organic Search', sessions: 8854 },
        { channel: 'Direct', sessions: 2313 },
        { channel: 'Social Media', sessions: 2467 },
        { channel: 'Paid Search', sessions: 617 },
        { channel: 'Email', sessions: 1169 },
      ],
      deviceDistribution: [
        { device: 'Desktop', sessions: 9252 },
        { device: 'Mobile', sessions: 6168 }
      ],
      timePeriod: '2025-07',
    };

    return await this.processClientGA4Data(clientId, sampleGA4Data);
  }
}

export const ga4DataProcessor = new GA4DataProcessor();