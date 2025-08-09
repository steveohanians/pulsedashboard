/**
 * GA4 API Service
 * 
 * Handles all direct API calls to Google Analytics Data API.
 */

import logger from '../../utils/logging/logger';
import { GA4_ENDPOINTS, GA4_METRICS, GA4_DIMENSIONS } from './constants';
import type { GA4PropertyAccess } from './types';

export class GA4APIService {

  /**
   * Fetch main metrics from GA4 API (aggregated for period)
   */
  async fetchMainMetrics(
    propertyAccess: GA4PropertyAccess, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    const reportRequest = {
      property: `properties/${propertyAccess.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: GA4_METRICS.BOUNCE_RATE },
        { name: GA4_METRICS.SESSION_DURATION },
        { name: GA4_METRICS.PAGES_PER_SESSION },
        { name: GA4_METRICS.SESSIONS_PER_USER },
        { name: GA4_METRICS.SESSIONS },
        { name: GA4_METRICS.TOTAL_USERS }
      ]
    };

    return this.makeGA4Request(propertyAccess, reportRequest);
  }

  /**
   * Fetch daily main metrics with date dimension
   */
  async fetchDailyMainMetrics(
    propertyAccess: GA4PropertyAccess, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    const reportRequest = {
      property: `properties/${propertyAccess.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: GA4_DIMENSIONS.DATE }],
      metrics: [
        { name: GA4_METRICS.BOUNCE_RATE },
        { name: GA4_METRICS.SESSION_DURATION },
        { name: GA4_METRICS.PAGES_PER_SESSION },
        { name: GA4_METRICS.SESSIONS_PER_USER },
        { name: GA4_METRICS.SESSIONS },
        { name: GA4_METRICS.TOTAL_USERS }
      ],
      orderBys: [{ dimension: { dimensionName: GA4_DIMENSIONS.DATE } }]
    };

    return this.makeGA4Request(propertyAccess, reportRequest);
  }

  /**
   * Fetch traffic channels from GA4 API
   */
  async fetchTrafficChannels(
    propertyAccess: GA4PropertyAccess, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    const reportRequest = {
      property: `properties/${propertyAccess.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: GA4_DIMENSIONS.TRAFFIC_CHANNEL }],
      metrics: [{ name: GA4_METRICS.SESSIONS }]
    };

    return this.makeGA4Request(propertyAccess, reportRequest);
  }

  /**
   * Fetch device data from GA4 API
   */
  async fetchDeviceData(
    propertyAccess: GA4PropertyAccess, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    const reportRequest = {
      property: `properties/${propertyAccess.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: GA4_DIMENSIONS.DEVICE_CATEGORY }],
      metrics: [{ name: GA4_METRICS.SESSIONS }]
    };

    return this.makeGA4Request(propertyAccess, reportRequest);
  }

  /**
   * Fetch batch GA4 data for multiple metrics simultaneously
   */
  async fetchBatchData(
    propertyAccess: GA4PropertyAccess, 
    startDate: string, 
    endDate: string
  ): Promise<{
    mainMetrics: any;
    trafficChannels: any;
    deviceData: any;
  }> {
    try {
      const [mainMetrics, trafficChannels, deviceData] = await Promise.all([
        this.fetchMainMetrics(propertyAccess, startDate, endDate),
        this.fetchTrafficChannels(propertyAccess, startDate, endDate),
        this.fetchDeviceData(propertyAccess, startDate, endDate)
      ]);

      return {
        mainMetrics,
        trafficChannels,
        deviceData
      };
    } catch (error) {
      logger.error('Error in batch GA4 data fetch:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to GA4 API
   */
  private async makeGA4Request(
    propertyAccess: GA4PropertyAccess, 
    reportRequest: any
  ): Promise<any> {
    const url = `${GA4_ENDPOINTS.ANALYTICS_DATA}/properties/${propertyAccess.propertyId}:runReport`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${propertyAccess.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GA4 API error:', { 
        status: response.status, 
        error: errorText,
        propertyId: propertyAccess.propertyId 
      });
      throw new Error(`GA4 API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Validate GA4 property access by making a test API call
   */
  async validatePropertyAccess(propertyAccess: GA4PropertyAccess): Promise<boolean> {
    try {
      // Make a simple test request for the last 7 days
      const testEndDate = new Date().toISOString().split('T')[0];
      const testStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await this.fetchMainMetrics(propertyAccess, testStartDate, testEndDate);
      return true;
    } catch (error) {
      logger.warn(`Property access validation failed for ${propertyAccess.propertyId}:`, error);
      return false;
    }
  }
}