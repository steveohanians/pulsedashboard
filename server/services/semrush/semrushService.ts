import logger from '../../utils/logger.ts';

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

export class SemrushService {
  private apiKey: string;
  private baseUrl = 'https://api.semrush.com/analytics/ta/api/v3'; // Analytics API v3 for traffic data

  constructor() {
    this.apiKey = process.env.SEMRUSH_API_KEY!;
    if (!this.apiKey) {
      throw new Error('SEMRUSH_API_KEY environment variable is required');
    }
  }

  /**
   * Generate 15 months of historical periods starting from last completed month
   */
  private generateHistoricalPeriods(): string[] {
    const periods: string[] = [];
    const now = new Date();
    
    // Start from last completed month (current month - 1)
    let currentDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
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
        export_columns: 'target,visits,users,pages_per_visit,time_on_site,bounce_rate',
        display_date: displayDate
      });

      logger.info('Fetching SEMrush main metrics', { domain, period, url: `${url}?${params}` });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      logger.debug('SEMrush main metrics response', { domain, period, response: text });

      if (text.includes('ERROR')) {
        logger.warn('SEMrush API returned error', { domain, period, error: text });
        return {};
      }

      // Parse CSV-like response from SEMrush v3 API
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        logger.warn('No data returned from SEMrush', { domain, period });
        return {};
      }

      // Headers: target,visits,users,pages_per_visit,time_on_site,bounce_rate
      const data = lines[1].split(';');
      
      const metrics = {
        bounceRate: parseFloat(data[5]) || 0, // bounce_rate column (already as decimal)
        sessionDuration: parseFloat(data[4]) || 0, // time_on_site column (seconds)
        pagesPerSession: parseFloat(data[3]) || 0, // pages_per_visit column
        sessionsPerUser: parseFloat(data[1]) / parseFloat(data[2]) || 0 // visits/users ratio
      };

      logger.info('Parsed SEMrush main metrics', { domain, metrics });
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
    try {
      const url = `${this.baseUrl}/sources`;
      
      // Convert period (YYYY-MM) to Analytics API v3 date format (YYYY-MM-DD)
      const [year, month] = period.split('-');
      const displayDate = `${year}-${month}-01`; // Use first day of month for historical data
      
      const params = new URLSearchParams({
        key: this.apiKey,
        target: domain, // Sources API uses 'target' (singular)
        export_columns: 'target,from_target,traffic_share,traffic,channel',
        display_date: displayDate,
        display_limit: '50'
      });

      logger.info('Fetching SEMrush traffic channels', { domain, period });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush traffic channels API error: ${response.status}`);
      }

      const text = await response.text();
      logger.debug('SEMrush traffic channels response', { domain, period, response: text });

      if (text.includes('ERROR')) {
        logger.info('SEMrush traffic channels not available in current subscription', { domain, period, error: text.trim() });
        return [];
      }

      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        logger.warn('No traffic channel data returned', { domain, period });
        return [];
      }

      // Headers: target,direct,search_organic,search_paid,social_organic,referral
      const data = lines[1].split(';');
      
      const totalVisits = data.slice(1).reduce((sum, visits) => sum + (parseInt(visits) || 0), 0);
      
      if (totalVisits === 0) {
        logger.warn('No traffic data available', { domain, period });
        return [];
      }

      const channels = [
        {
          channel: 'Direct',
          sessions: parseInt(data[1]) || 0,
          percentage: ((parseInt(data[1]) || 0) / totalVisits) * 100 // Convert to percentage
        },
        {
          channel: 'Organic Search',
          sessions: parseInt(data[2]) || 0,
          percentage: ((parseInt(data[2]) || 0) / totalVisits) * 100 // Convert to percentage
        },
        {
          channel: 'Paid Search',
          sessions: parseInt(data[3]) || 0,
          percentage: ((parseInt(data[3]) || 0) / totalVisits) * 100 // Convert to percentage
        },
        {
          channel: 'Social Media',
          sessions: parseInt(data[4]) || 0,
          percentage: ((parseInt(data[4]) || 0) / totalVisits) * 100 // Convert to percentage
        },
        {
          channel: 'Referral',
          sessions: parseInt(data[5]) || 0,
          percentage: ((parseInt(data[5]) || 0) / totalVisits) * 100 // Convert to percentage
        }
      ].filter(channel => channel.sessions > 0); // Only include channels with data

      logger.info('Parsed SEMrush traffic channels', { domain, channelsCount: channels.length, totalVisits });
      return channels;

    } catch (error) {
      logger.error('Failed to fetch SEMrush traffic channels', { 
        domain, 
        period, 
        error: (error as Error).message 
      });
      return [];
    }
  }

  /**
   * Fetch device distribution using summary endpoint
   */
  private async fetchDeviceDistribution(domain: string, period: string): Promise<SemrushMetricData['deviceDistribution']> {
    try {
      const url = `${this.baseUrl}/summary`;
      
      // Convert period (YYYY-MM) to Analytics API v3 date format (YYYY-MM-DD)
      const [year, month] = period.split('-');
      const displayDate = `${year}-${month}-01`; // Use first day of month for historical data
      
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: domain,
        export_columns: 'target,desktop_visits,mobile_visits,desktop_share,mobile_share',
        display_date: displayDate,
        device_type: 'desktop,mobile'
      });

      logger.info('Fetching SEMrush device distribution', { domain, period });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush devices API error: ${response.status}`);
      }

      const text = await response.text();
      logger.debug('SEMrush device distribution response', { domain, period, response: text });

      if (text.includes('ERROR')) {
        logger.info('SEMrush device distribution not available in current subscription', { domain, period, error: text.trim() });
        return [];
      }

      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        logger.warn('No device distribution data returned', { domain, period });
        return [];
      }

      // Headers: target,desktop_visits,mobile_visits,desktop_share,mobile_share
      const data = lines[1].split(';');
      
      const devices = [
        {
          device: 'Desktop',
          sessions: parseInt(data[1]) || 0,
          percentage: (parseFloat(data[3]) || 0) * 100 // Convert decimal to percentage
        },
        {
          device: 'Mobile',
          sessions: parseInt(data[2]) || 0,
          percentage: (parseFloat(data[4]) || 0) * 100 // Convert decimal to percentage
        }
      ].filter(device => device.sessions > 0); // Only include devices with data

      logger.info('Parsed SEMrush device distribution', { domain, devicesCount: devices.length });
      return devices;

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
        const [mainMetrics, trafficChannels, deviceDistribution] = await Promise.all([
          this.fetchMainMetrics(domain, period),
          this.fetchTrafficChannels(domain, period),
          this.fetchDeviceDistribution(domain, period)
        ]);

        const periodData: SemrushMetricData = {
          bounceRate: mainMetrics.bounceRate || 0,
          sessionDuration: mainMetrics.sessionDuration || 0,
          pagesPerSession: mainMetrics.pagesPerSession || 0,
          sessionsPerUser: mainMetrics.sessionsPerUser || 0,
          trafficChannels: trafficChannels || [],
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