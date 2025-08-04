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
  private baseUrl = 'https://api.semrush.com/analytics/ta/api/v3';

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
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: domain,
        display_date: period,
        export_columns: 'target,visits,users,pages_per_visit,visit_duration,bounce_rate'
      });

      logger.info('Fetching SEMrush main metrics', { domain, period, url: `${url}?${params}` });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      logger.debug('SEMrush main metrics response', { domain, period, response: text });

      // Parse CSV-like response from SEMrush v3 API
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        logger.warn('No data returned from SEMrush', { domain, period });
        return {};
      }

      // Skip header line, get data line
      const data = lines[1].split(';');
      
      return {
        bounceRate: parseFloat(data[5]) || 0, // bounce_rate column
        sessionDuration: parseFloat(data[4]) || 0, // visit_duration column  
        pagesPerSession: parseFloat(data[3]) || 0, // pages_per_visit column
        sessionsPerUser: parseFloat(data[1]) / parseFloat(data[2]) || 0 // visits/users ratio
      };

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
   * Fetch traffic channels from SEMrush v3 API
   */
  private async fetchTrafficChannels(domain: string, period: string): Promise<SemrushMetricData['trafficChannels']> {
    try {
      const url = `${this.baseUrl}/sources`;
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: domain,
        display_date: period,
        export_columns: 'target,source_type,visits,traffic_share'
      });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush traffic channels API error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        return [];
      }

      const channels: SemrushMetricData['trafficChannels'] = [];
      
      // Skip header, process data lines
      for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(';');
        if (data.length >= 4) {
          channels.push({
            channel: this.normalizeChannelName(data[1]), // source_type column
            sessions: parseInt(data[2]) || 0, // visits column
            percentage: parseFloat(data[3]) || 0 // traffic_share column
          });
        }
      }

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
   * Fetch device distribution from SEMrush v3 API
   */
  private async fetchDeviceDistribution(domain: string, period: string): Promise<SemrushMetricData['deviceDistribution']> {
    try {
      const url = `${this.baseUrl}/devices`;
      const params = new URLSearchParams({
        key: this.apiKey,
        targets: domain,
        display_date: period,
        export_columns: 'target,device_type,visits,traffic_share'
      });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        throw new Error(`SEMrush devices API error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        return [];
      }

      const devices: SemrushMetricData['deviceDistribution'] = [];
      
      // Skip header, process data lines
      for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(';');
        if (data.length >= 4) {
          devices.push({
            device: this.normalizeDeviceName(data[1]), // device_type column
            sessions: parseInt(data[2]) || 0, // visits column
            percentage: parseFloat(data[3]) || 0 // traffic_share column
          });
        }
      }

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
    logger.info('Starting SEMrush historical data fetch', { domain });
    
    const periods = this.generateHistoricalPeriods();
    const results = new Map<string, SemrushMetricData>();

    logger.info('Generated historical periods', { domain, periods, count: periods.length });

    // Fetch data for each period
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

        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error('Failed to fetch SEMrush data for period', { 
          domain, 
          period, 
          error: (error as Error).message 
        });
        
        // Store empty data for failed periods to maintain consistency
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
      totalPeriods: periods.length,
      successfulPeriods: Array.from(results.values()).filter(data => 
        data.bounceRate > 0 || data.sessionDuration > 0
      ).length
    });

    return results;
  }

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/main`;
      const params = new URLSearchParams({
        key: this.apiKey,
        domain: 'example.com',
        display_date: '2024-01'
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