/**
 * GA4 Data Processor
 * 
 * Handles processing and transformation of raw GA4 API responses.
 */

import logger from '../../utils/logger';
import type { GA4MetricData, GA4DailyMetric } from './types';

export class GA4DataProcessor {

  /**
   * Process raw GA4 API response into structured data
   */
  processGA4Response(
    mainMetricsResponse: any,
    trafficChannelsResponse: any,
    deviceDataResponse: any
  ): GA4MetricData | null {
    try {
      // Process main metrics
      const mainMetrics = this.extractMainMetrics(mainMetricsResponse);
      if (!mainMetrics) {
        logger.error('Failed to extract main metrics from GA4 response');
        return null;
      }

      // Process traffic channels
      const trafficChannels = this.extractTrafficChannels(trafficChannelsResponse);
      
      // Process device distribution
      const deviceDistribution = this.extractDeviceDistribution(deviceDataResponse);

      // Ensure all required fields are present
      return {
        bounceRate: mainMetrics.bounceRate ?? 0,
        sessionDuration: mainMetrics.sessionDuration ?? 0,
        pagesPerSession: mainMetrics.pagesPerSession ?? 0,
        sessionsPerUser: mainMetrics.sessionsPerUser ?? 0,
        totalSessions: mainMetrics.totalSessions ?? 0,
        totalUsers: mainMetrics.totalUsers ?? 0,
        trafficChannels,
        deviceDistribution
      };

    } catch (error) {
      logger.error('Error processing GA4 response:', error);
      return null;
    }
  }

  /**
   * Process daily GA4 metrics response
   */
  processDailyGA4Response(response: any): GA4DailyMetric[] | null {
    try {
      if (!response.rows || response.rows.length === 0) {
        logger.warn('No daily data rows in GA4 response');
        return [];
      }

      return response.rows.map((row: any) => {
        const date = row.dimensionValues[0].value; // First dimension is date
        const metrics = row.metricValues;

        // Parse metrics (same order as request)
        const bounceRate = parseFloat(metrics[0].value) * 100; // Convert to percentage
        const sessionDuration = parseFloat(metrics[1].value); // Already in seconds
        const pagesPerSession = parseFloat(metrics[2].value);
        const sessionsPerUser = parseFloat(metrics[3].value);
        const totalSessions = parseInt(metrics[4].value);
        const totalUsers = parseInt(metrics[5].value);

        return {
          date,
          metrics: {
            bounceRate,
            sessionDuration,
            pagesPerSession,
            sessionsPerUser,
            totalSessions,
            totalUsers
          }
        };
      }) || [];

    } catch (error) {
      logger.error('Error processing daily GA4 response:', error);
      return null;
    }
  }

  /**
   * Extract main metrics from GA4 response
   */
  private extractMainMetrics(response: any): Partial<GA4MetricData> | null {
    try {
      if (!response.rows || response.rows.length === 0) {
        logger.warn('No rows in main metrics response');
        return null;
      }

      const row = response.rows[0];
      const metrics = row.metricValues;

      // Parse metrics (same order as request)
      const bounceRate = parseFloat(metrics[0].value) * 100; // Convert to percentage
      const sessionDuration = parseFloat(metrics[1].value); // Already in seconds
      const pagesPerSession = parseFloat(metrics[2].value);
      const sessionsPerUser = parseFloat(metrics[3].value);
      const totalSessions = parseInt(metrics[4].value);
      const totalUsers = parseInt(metrics[5].value);

      return {
        bounceRate,
        sessionDuration,
        pagesPerSession,
        sessionsPerUser,
        totalSessions,
        totalUsers
      };

    } catch (error) {
      logger.error('Error extracting main metrics:', error);
      return null;
    }
  }

  /**
   * Extract traffic channels from GA4 response
   */
  private extractTrafficChannels(response: any): Array<{channel: string; sessions: number; percentage: number}> {
    try {
      if (!response.rows || response.rows.length === 0) {
        logger.warn('No rows in traffic channels response');
        return [];
      }

      const totalSessions = response.rows.reduce((sum: number, row: any) => 
        sum + parseInt(row.metricValues[0].value), 0
      );

      // First pass: normalize and collect all channels
      const channelMap = new Map<string, { sessions: number }>();

      response.rows.forEach((row: any) => {
        const rawChannel = row.dimensionValues[0].value;
        const sessions = parseInt(row.metricValues[0].value);
        const normalizedChannel = this.normalizeChannelName(rawChannel);

        // Debug logging to see what raw channel names we're getting
        if (rawChannel !== normalizedChannel) {
          logger.info(`GA4 Channel mapping: "${rawChannel}" -> "${normalizedChannel}"`);
        }

        // Consolidate channels with same normalized name
        if (channelMap.has(normalizedChannel)) {
          channelMap.get(normalizedChannel)!.sessions += sessions;
        } else {
          channelMap.set(normalizedChannel, { sessions });
        }
      });

      // Second pass: calculate percentages from consolidated data
      const results = Array.from(channelMap.entries()).map(([channel, data]) => {
        const percentage = totalSessions > 0 ? (data.sessions / totalSessions) * 100 : 0;
        return {
          channel,
          sessions: data.sessions,
          percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
        };
      });

      // Sort by sessions descending for consistent ordering
      results.sort((a, b) => b.sessions - a.sessions);
      
      logger.info(`GA4 Traffic Channels consolidated: ${results.length} channels`, {
        channels: results.map(r => `${r.channel}: ${r.percentage}%`)
      });
      
      return results;

    } catch (error) {
      logger.error('Error extracting traffic channels:', error);
      return [];
    }
  }

  /**
   * Extract device distribution from GA4 response and combine mobile+tablet into single Mobile category
   */
  private extractDeviceDistribution(response: any): Array<{device: string; sessions: number; percentage: number}> {
    try {
      if (!response.rows || response.rows.length === 0) {
        logger.warn('No rows in device distribution response');
        return [];
      }

      const totalSessions = response.rows.reduce((sum: number, row: any) => 
        sum + parseInt(row.metricValues[0].value), 0
      );

      // Aggregate mobile and tablet into single Mobile category
      const deviceTotals = new Map<string, number>();
      
      response.rows.forEach((row: any) => {
        const device = row.dimensionValues[0].value;
        const sessions = parseInt(row.metricValues[0].value);
        const normalizedDevice = this.normalizeDeviceName(device);
        
        if (deviceTotals.has(normalizedDevice)) {
          deviceTotals.set(normalizedDevice, deviceTotals.get(normalizedDevice)! + sessions);
        } else {
          deviceTotals.set(normalizedDevice, sessions);
        }
      });

      // Convert to final format with percentages
      const result = Array.from(deviceTotals.entries()).map(([device, sessions]) => {
        const percentage = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
        return {
          device,
          sessions,
          percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
        };
      });

      logger.info('GA4 Device distribution processed with mobile+tablet combination', {
        originalDevices: response.rows.length,
        combinedDevices: result.length,
        devices: result.map(r => `${r.device}: ${r.percentage}%`)
      });

      return result;

    } catch (error) {
      logger.error('Error extracting device distribution:', error);
      return [];
    }
  }

  /**
   * Normalize channel names for consistency - preserve unknown channels instead of grouping as "Other"
   */
  private normalizeChannelName(channel: string): string {
    const channelMap: Record<string, string> = {
      'Direct': 'Direct',
      '(none)': 'Direct', // GA4 sometimes uses (none) for direct traffic
      'Paid Search': 'Paid Search',
      'Organic Search': 'Organic Search',
      'Referral': 'Referral',
      'Email': 'Email',
      'Paid Social': 'Social Media',
      'Organic Social': 'Social Media',
      'Social': 'Social Media',
      'Cross-network': 'Other',
      'Unassigned': 'Other',

      'Video': 'Other',
      'YouTube': 'Other',
      'Affiliates': 'Other',
      'Organic Video': 'Other',
      'Audio': 'Other',
      'SMS': 'Other',
      'Push': 'Other',
      'Mobile Push Notifications': 'Other'
    };

    // Return mapped name if exists, otherwise map to "Other"
    return channelMap[channel] || 'Other';
  }

  /**
   * Normalize device names for consistency - combine mobile and tablet into Mobile category
   */
  private normalizeDeviceName(device: string): string {
    const deviceMap: Record<string, string> = {
      'desktop': 'Desktop',
      'mobile': 'Mobile',
      'tablet': 'Mobile' // Combine tablet with mobile to match SEMrush format
    };

    return deviceMap[device.toLowerCase()] || 'Mobile'; // Default unknown devices to Mobile
  }

  /**
   * Calculate period averages from daily data
   */
  calculatePeriodAverages(dailyMetrics: GA4DailyMetric[]): Partial<GA4MetricData> | null {
    if (!dailyMetrics || dailyMetrics.length === 0) {
      return null;
    }

    const totals = dailyMetrics.reduce((acc, day) => ({
      bounceRate: acc.bounceRate + day.metrics.bounceRate,
      sessionDuration: acc.sessionDuration + day.metrics.sessionDuration,
      pagesPerSession: acc.pagesPerSession + day.metrics.pagesPerSession,
      sessionsPerUser: acc.sessionsPerUser + day.metrics.sessionsPerUser,
      totalSessions: acc.totalSessions + day.metrics.totalSessions,
      totalUsers: acc.totalUsers + day.metrics.totalUsers
    }), {
      bounceRate: 0,
      sessionDuration: 0,
      pagesPerSession: 0,
      sessionsPerUser: 0,
      totalSessions: 0,
      totalUsers: 0
    });

    const dayCount = dailyMetrics.length;

    return {
      bounceRate: totals.bounceRate / dayCount,
      sessionDuration: totals.sessionDuration / dayCount,
      pagesPerSession: totals.pagesPerSession / dayCount,
      sessionsPerUser: totals.sessionsPerUser / dayCount,
      totalSessions: totals.totalSessions,
      totalUsers: totals.totalUsers
    };
  }
}