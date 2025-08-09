import logger from '../../utils/logging/logger.ts';

export interface SemrushMetricData {
  bounceRate: number;
  sessionDuration: number;
  pagesPerSession: number;
  sessionsPerUser: number;
  trafficChannels: Array<{
    channel: string;
    percentage: number;
    sessions: number;
  }>;
  deviceDistribution: Array<{
    device: string;
    percentage: number;
    sessions: number;
  }>;
}

export interface SemrushApiResponse {
  data?: Array<{
    metric: string;
    value: number | string;
    period: string;
  }>;
  trafficChannels?: Array<{
    source: string;
    percentage: number;
    visits: number;
  }>;
  devices?: Array<{
    device_type: string;
    percentage: number;
    visits: number;
  }>;
}

import { requireSemrushApiKey } from '../../config';
import { ISemrushValidator } from '../../utils/company/validation';

export class SemrushService implements ISemrushValidator {
  private apiKey: string;
  private baseUrl = 'https://api.semrush.com/analytics/ta/api/v3'; // Analytics API v3 for traffic data

  constructor() {
    this.apiKey = requireSemrushApiKey();
  }

  /**
   * Generate 15 months of historical periods starting from last completed month
   */
  private generateHistoricalPeriods(): string[] {
    const periods: string[] = [];
    const now = new Date();
    
    // SEMrush data is only available up to 2025-06 (June 2025)
    // Cap the start period to respect SEMrush data availability
    const maxAvailableDate = new Date(2025, 5, 1); // June 2025 (month 5 = June)
    const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // Use the earlier of: last completed month OR max available SEMrush date
    let currentDate = lastCompletedMonth <= maxAvailableDate ? lastCompletedMonth : maxAvailableDate;
    
    for (let i = 0; i < 15; i++) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      periods.push(`${year}-${month}`);
      
      // Move to previous month
      currentDate.setMonth(currentDate.getMonth() - 1);
    }
    
    return periods.reverse(); // Return chronological order (oldest to newest)
  }

  /**
   * Fetch main website metrics from SEMrush using v3 API
   */
  private async fetchMainMetrics(domain: string, period: string): Promise<Partial<SemrushMetricData>> {
    try {
      const url = `${this.baseUrl}/summary`;
      
      // Convert period (YYYY-MM) to Analytics API v3 date format (YYYY-MM-DD)
      const [year, month] = period.split('-');
      const displayDate = `${year}-${month}-01`; // Use first day of month for historical data
      
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: domain,
        export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel',
        display_date: displayDate
      });

      logger.info('Fetching SEMrush main metrics', { domain, period, url: `${url}?${params}` });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `SEMrush API error: ${response.status} ${response.statusText} - ${errorText}`;
        logger.error('SEMrush API HTTP error', { domain, period, status: response.status, error: errorText });
        throw new Error(errorMessage);
      }

      const text = await response.text();
      logger.debug('SEMrush main metrics response', { domain, period, response: text });

      if (text.includes('ERROR')) {
        const errorMessage = `SEMrush API returned error for ${domain}: ${text}`;
        logger.error('SEMrush API data error', { domain, period, error: text });
        throw new Error(errorMessage);
      }

      // Parse CSV-like response from SEMrush v3 API
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        logger.warn('No data returned from SEMrush', { domain, period });
        return {};
      }

      // Headers: target,visits,users,pages_per_visit,time_on_site,bounce_rate,direct,referral,social,search,search_organic,search_paid,social_organic,social_paid,mail,display_ad,unknown_channel
      const data = lines[1].split(';');
      
      const totalVisits = parseFloat(data[1]) || 0; // Total visits for percentage calculation
      
      // Extract traffic channel data from Summary endpoint
      const trafficChannels: Array<{channel: string; sessions: number; percentage: number}> = [];
      if (totalVisits > 0) {
        const channelData = [
          { name: 'Direct', visits: parseFloat(data[6]) || 0 },
          { name: 'Referral', visits: parseFloat(data[7]) || 0 },
          { name: 'Organic Search', visits: parseFloat(data[10]) || 0 }, // search_organic
          { name: 'Paid Search', visits: parseFloat(data[11]) || 0 }, // search_paid
          { name: 'Social Media', visits: (parseFloat(data[12]) || 0) + (parseFloat(data[13]) || 0) }, // social_organic + social_paid
          { name: 'Email', visits: parseFloat(data[14]) || 0 }, // mail
          { name: 'Display Ads', visits: parseFloat(data[15]) || 0 }, // display_ad
          { name: 'Other', visits: parseFloat(data[16]) || 0 } // unknown_channel
        ];
        
        // Filter out channels with no traffic and calculate percentages
        channelData.forEach(channel => {
          if (channel.visits > 0) {
            trafficChannels.push({
              channel: channel.name,
              sessions: Math.round(channel.visits),
              percentage: Math.round((channel.visits / totalVisits) * 100 * 10) / 10 // Round to 1 decimal
            });
          }
        });
      }
      
      const metrics = {
        bounceRate: parseFloat(data[5]) || 0, // bounce_rate column (already as decimal)
        sessionDuration: parseFloat(data[4]) || 0, // time_on_site column (seconds)
        pagesPerSession: parseFloat(data[3]) || 0, // pages_per_visit column
        sessionsPerUser: parseFloat(data[1]) / parseFloat(data[2]) || 0, // visits/users ratio
        trafficChannels // Add traffic channels to the response
      };

      logger.info('Parsed SEMrush main metrics with traffic channels', { 
        domain, 
        metrics: {
          ...metrics,
          trafficChannels: trafficChannels.length
        }
      });
      return metrics;

    } catch (error) {
      logger.error('Failed to fetch SEMrush main metrics', { 
        domain, 
        period, 
        error: (error as Error).message 
      });
      return {};
    }
  }

  /**
   * Fetch traffic channels using summary endpoint
   */
  private async fetchTrafficChannels(domain: string, period: string): Promise<SemrushMetricData['trafficChannels']> {
    logger.info('Traffic channels now fetched from Summary endpoint in fetchMainMetrics', { domain, period });
    return []; // Traffic channels are now included in fetchMainMetrics response
  }

  /**
   * Fetch device distribution using summary endpoint with separate API calls for each device type
   */
  private async fetchDeviceDistribution(domain: string, period: string): Promise<SemrushMetricData['deviceDistribution']> {
    try {
      const url = `${this.baseUrl}/summary`;
      
      // Convert period (YYYY-MM) to Analytics API v3 date format (YYYY-MM-DD)
      const [year, month] = period.split('-');
      const displayDate = `${year}-${month}-01`; // Use first day of month for historical data
      
      logger.info('Fetching SEMrush device distribution with separate API calls', { domain, period });

      // Make separate API calls for each device type (SEMrush requirement)
      const deviceTypes = ['desktop', 'mobile'];
      const deviceResults: Array<{ device: string; sessions: number; percentage: number; }> = [];

      for (const deviceType of deviceTypes) {
        try {
          const params = new URLSearchParams({
            key: this.apiKey,
            targets: domain,
            export_columns: 'target,visits',
            display_date: displayDate,
            device_type: deviceType
          });

          const response = await fetch(`${url}?${params}`);
          
          if (!response.ok) {
            logger.warn(`SEMrush ${deviceType} API error: ${response.status}`, { domain, period });
            continue;
          }

          const text = await response.text();
          logger.debug(`SEMrush ${deviceType} response`, { domain, period, response: text.substring(0, 200) });

          if (text.includes('ERROR')) {
            logger.info(`SEMrush ${deviceType} not available`, { domain, period, error: text.trim() });
            continue;
          }

          const lines = text.trim().split('\n');
          if (lines.length >= 2) {
            const data = lines[1].split(';');
            const visits = parseInt(data[1]) || 0;
            
            if (visits > 0) {
              deviceResults.push({
                device: deviceType === 'desktop' ? 'Desktop' : 'Mobile',
                sessions: visits,
                percentage: 0 // Will calculate percentage after collecting all data
              });
            }
          }
        } catch (deviceError) {
          logger.error(`Failed to fetch ${deviceType} data`, { 
            domain, 
            period, 
            deviceType,
            error: (deviceError as Error).message 
          });
        }
      }

      // Calculate percentages from total sessions
      const totalSessions = deviceResults.reduce((sum, device) => sum + device.sessions, 0);
      if (totalSessions > 0) {
        deviceResults.forEach(device => {
          device.percentage = (device.sessions / totalSessions) * 100;
        });
      }

      logger.info('Parsed SEMrush device distribution', { 
        domain, 
        period,
        devicesCount: deviceResults.length,
        totalSessions,
        devices: deviceResults.map(d => `${d.device}: ${d.percentage.toFixed(1)}%`)
      });
      
      return deviceResults;

    } catch (error) {
      logger.error('Failed to fetch SEMrush device distribution', { 
        domain, 
        period, 
        error: (error as Error).message 
      });
      return [];
    }
  }

  /**
   * Normalize channel names to match our system
   */
  private normalizeChannelName(channel: string): string {
    const channelMap: Record<string, string> = {
      'search': 'Organic Search',
      'paid': 'Paid Search',
      'social': 'Social Media',
      'direct': 'Direct',
      'referral': 'Referral',
      'email': 'Email',
      'display': 'Display'
    };

    const normalized = channel.toLowerCase().trim();
    return channelMap[normalized] || channel;
  }

  /**
   * Normalize device names to match our system
   */
  private normalizeDeviceName(device: string): string {
    const deviceMap: Record<string, string> = {
      'desktop': 'Desktop',
      'mobile': 'Mobile',
      'tablet': 'Tablet'
    };

    const normalized = device.toLowerCase().trim();
    return deviceMap[normalized] || device;
  }



  /**
   * Fetch comprehensive 15-month historical data for a domain
   */
  public async fetchHistoricalData(domain: string): Promise<Map<string, SemrushMetricData>> {
    logger.info('Starting SEMrush historical data fetch with authentic monthly data', { domain });
    
    const periods = this.generateHistoricalPeriods();
    const results = new Map<string, SemrushMetricData>();

    logger.info('Generated historical periods', { domain, periods, count: periods.length });

    // Fetch data for each period using correct SEMrush historical date format
    for (const period of periods) {
      try {
        logger.info('Fetching SEMrush data for period', { domain, period });

        // Fetch all metrics in parallel for this period
        const [mainMetrics, deviceDistribution] = await Promise.all([
          this.fetchMainMetrics(domain, period),
          this.fetchDeviceDistribution(domain, period)
        ]);

        const periodData: SemrushMetricData = {
          bounceRate: mainMetrics.bounceRate || 0,
          sessionDuration: mainMetrics.sessionDuration || 0,
          pagesPerSession: mainMetrics.pagesPerSession || 0,
          sessionsPerUser: mainMetrics.sessionsPerUser || 0,
          trafficChannels: mainMetrics.trafficChannels || [], // Now from Summary endpoint
          deviceDistribution: deviceDistribution || []
        };

        results.set(period, periodData);
        
        logger.info('Successfully fetched SEMrush data for period', { 
          domain, 
          period,
          bounceRate: periodData.bounceRate,
          sessionDuration: periodData.sessionDuration,
          trafficChannelsCount: periodData.trafficChannels.length,
          devicesCount: periodData.deviceDistribution.length
        });

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.error('Failed to fetch SEMrush data for period', {
          domain,
          period,
          error: (error as Error).message
        });
        
        // Continue with empty data for this period
        results.set(period, {
          bounceRate: 0,
          sessionDuration: 0,
          pagesPerSession: 0,
          sessionsPerUser: 0,
          trafficChannels: [],
          deviceDistribution: []
        });
      }
    }

    logger.info('Completed SEMrush historical data fetch', { 
      domain, 
      totalPeriods: results.size,
      successfulPeriods: Array.from(results.values()).filter(data => data.bounceRate > 0).length
    });

    return results;
  }

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/summary`;
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: 'example.com',
        export_columns: 'target,visits,users',
        display_date: '2024-01-01'
      });

      const response = await fetch(`${url}?${params}`);
      return response.status !== 401 && response.status !== 403;
    } catch (error) {
      logger.error('SEMrush connection test failed', { error: (error as Error).message });
      return false;
    }
  }
}

export const semrushService = new SemrushService();