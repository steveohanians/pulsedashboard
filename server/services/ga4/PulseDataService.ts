// Using existing Google Auth setup from ga4ServiceAccountManager
import { storage } from '../../storage';
import logger from '../../utils/logging/logger';

interface GA4MetricData {
  bounceRate: number;
  sessionDuration: number;
  pagesPerSession: number;
  sessionsPerUser: number;
  trafficChannels: Array<{ channel: string; sessions: number; percentage: number }>;
  deviceDistribution: Array<{ device: string; sessions: number; percentage: number }>;
  totalSessions: number;
  totalUsers: number;
}

interface GA4DailyData {
  date: string;
  metrics: {
    bounceRate: number;
    sessionDuration: number;
    pagesPerSession: number;
    sessionsPerUser: number;
    totalSessions: number;
    totalUsers: number;
  };
}

interface GA4PropertyAccess {
  propertyId: string;
  serviceAccountId: string;
  accessToken: string;
}

export class GA4DataService {
  
  /**
   * Get GA4 property access info for a client with token refresh
   */
  private async getPropertyAccess(clientId: string): Promise<GA4PropertyAccess | null> {
    try {
      const propertyAccess = await storage.getGA4PropertyAccessByClient(clientId);
      if (!propertyAccess || !propertyAccess.accessVerified) {
        logger.warn(`No verified GA4 property access for client: ${clientId}`);
        return null;
      }

      // Get service account with access token
      let serviceAccount = await storage.getGA4ServiceAccount(propertyAccess.serviceAccountId);
      if (!serviceAccount || !serviceAccount.accessToken) {
        logger.warn(`No access token for service account: ${propertyAccess.serviceAccountId}`);
        return null;
      }

      // Check if token is expired and refresh if needed
      if (serviceAccount.tokenExpiry && new Date() > serviceAccount.tokenExpiry) {
        logger.info(`Access token expired for service account ${serviceAccount.id}, refreshing...`);
        
        if (!serviceAccount.refreshToken) {
          logger.error(`No refresh token available for service account: ${serviceAccount.id}`);
          return null;
        }

        try {
          const refreshedTokens = await this.refreshAccessToken(serviceAccount.refreshToken);
          
          // Update service account with new tokens
          await this.updateServiceAccountTokens(serviceAccount.id, refreshedTokens.access_token, new Date(refreshedTokens.expiry_date));

          // Update the serviceAccount object for this request
          serviceAccount.accessToken = refreshedTokens.access_token;
          serviceAccount.tokenExpiry = new Date(refreshedTokens.expiry_date);
          
          logger.info(`Successfully refreshed access token for service account: ${serviceAccount.id}`);
        } catch (error) {
          logger.error(`Failed to refresh access token for service account ${serviceAccount.id}:`, error);
          return null;
        }
      }

      return {
        propertyId: propertyAccess.propertyId,
        serviceAccountId: propertyAccess.serviceAccountId,
        accessToken: serviceAccount.accessToken
      };
    } catch (error) {
      logger.error('Error getting GA4 property access:', error);
      return null;
    }
  }

  /**
   * Fetch GA4 data for specific date range
   */
  async fetchGA4Data(clientId: string, startDate: string, endDate: string): Promise<GA4MetricData | null> {
    try {
      const propertyAccess = await this.getPropertyAccess(clientId);
      if (!propertyAccess) {
        return null;
      }

      logger.info('Making GA4 Reporting API request', {
        propertyId: propertyAccess.propertyId,
        hasAccessToken: !!propertyAccess.accessToken,
        tokenPrefix: propertyAccess.accessToken.substring(0, 20) + '...',
        startDate,
        endDate
      });

      // Make actual GA4 API calls to fetch real data
      const [mainMetricsResponse, channelsResponse, deviceResponse] = await Promise.all([
        this.fetchMainMetrics(propertyAccess.propertyId, propertyAccess.accessToken, startDate, endDate),
        this.fetchTrafficChannels(propertyAccess.propertyId, propertyAccess.accessToken, startDate, endDate),
        this.fetchDeviceData(propertyAccess.propertyId, propertyAccess.accessToken, startDate, endDate)
      ]);

      logger.info('GA4 Reporting API response', {
        status: 200,
        propertyId: propertyAccess.propertyId
      });

      // Process main metrics
      const mainRow = mainMetricsResponse.rows?.[0];
      if (!mainRow?.metricValues) {
        throw new Error('No metric data returned from GA4');
      }

      const bounceRate = parseFloat(mainRow.metricValues[0]?.value || '0') * 100; // Convert to percentage
      const sessionDuration = parseFloat(mainRow.metricValues[1]?.value || '0'); // Already in seconds
      const pagesPerSession = parseFloat(mainRow.metricValues[2]?.value || '0');
      const sessionsPerUser = parseFloat(mainRow.metricValues[3]?.value || '0');
      const totalSessions = parseInt(mainRow.metricValues[4]?.value || '0');
      const totalUsers = parseInt(mainRow.metricValues[5]?.value || '0');

      // Process traffic channels
      const trafficChannels = channelsResponse.rows?.map((row: any) => {
        const channel = row.dimensionValues?.[0]?.value || 'Unknown';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        const percentage = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
        return { channel, sessions, percentage };
      }) || [];

      // Process device distribution
      const deviceDistribution = deviceResponse.rows?.map((row: any) => {
        const device = row.dimensionValues?.[0]?.value || 'Unknown';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        const percentage = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
        return { device, sessions, percentage };
      }) || [];

      const result: GA4MetricData = {
        bounceRate,
        sessionDuration,
        pagesPerSession,
        sessionsPerUser,
        trafficChannels,
        deviceDistribution,
        totalSessions,
        totalUsers
      };

      logger.info('Successfully processed GA4 data', {
        propertyId: propertyAccess.propertyId,
        bounceRate: `${bounceRate.toFixed(1)}%`,
        sessionDuration: `${sessionDuration.toFixed(0)}s`,
        pagesPerSession: pagesPerSession.toFixed(2),
        totalSessions,
        channelsCount: trafficChannels.length,
        devicesCount: deviceDistribution.length
      });

      return result;

    } catch (error) {
      logger.error('Error fetching GA4 data:', {
        error: (error as Error).message,
        clientId,
        startDate,
        endDate
      });
      return null;
    }
  }

  /**
   * Convert date period (YYYY-MM) to GA4 date range format
   */
  getDateRangeForPeriod(period: string): { startDate: string; endDate: string } {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1); // month - 1 because Date months are 0-indexed
    const endDate = new Date(year, month, 0); // Day 0 gives last day of previous month
    
    return {
      startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Store GA4 data as metrics in the database
   */
  async storeGA4Metrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    try {
      // Store main metrics
      await storage.createMetric({
        clientId,
        metricName: 'Bounce Rate',
        value: data.bounceRate,
        sourceType: 'Client',
        timePeriod: period
      });

      await storage.createMetric({
        clientId,
        metricName: 'Session Duration',
        value: data.sessionDuration,
        sourceType: 'Client',
        timePeriod: period
      });

      await storage.createMetric({
        clientId,
        metricName: 'Pages per Session',
        value: data.pagesPerSession,
        sourceType: 'Client',
        timePeriod: period
      });

      await storage.createMetric({
        clientId,
        metricName: 'Sessions per User',
        value: data.sessionsPerUser,
        sourceType: 'Client',
        timePeriod: period
      });

      // Store traffic channels as JSON
      await storage.createMetric({
        clientId,
        metricName: 'Traffic Channels',
        value: data.trafficChannels,
        sourceType: 'Client',
        timePeriod: period
      });

      // Store device distribution as JSON
      await storage.createMetric({
        clientId,
        metricName: 'Device Distribution',
        value: data.deviceDistribution,
        sourceType: 'Client',
        timePeriod: period
      });

      logger.info('Successfully stored GA4 metrics', {
        clientId,
        period,
        metricsStored: 6
      });

    } catch (error) {
      logger.error('Error storing GA4 metrics:', error);
      throw error;
    }
  }

  /**
   * Store daily GA4 metrics for authentic temporal data
   */
  async storeDailyGA4Metrics(clientId: string, dailyData: Array<{date: string, metrics: any}>, period: string): Promise<void> {
    try {
      if (!dailyData || dailyData.length === 0) {
        logger.warn('No daily data to store for client:', clientId);
        return;
      }

      // Store each day's metrics as individual records
      for (const dayData of dailyData) {
        const { date, metrics } = dayData;
        
        // Store each metric type with the specific date
        await storage.createMetric({
          clientId,
          metricName: 'Bounce Rate',
          value: metrics.bounceRate.toString(),
          sourceType: 'Client',
          timePeriod: `${period}-daily-${date}` // Format: 2025-06-daily-20250603
        });

        await storage.createMetric({
          clientId,
          metricName: 'Session Duration',
          value: metrics.sessionDuration.toString(),
          sourceType: 'Client',
          timePeriod: `${period}-daily-${date}`
        });

        await storage.createMetric({
          clientId,
          metricName: 'Pages per Session',
          value: metrics.pagesPerSession.toString(),
          sourceType: 'Client',
          timePeriod: `${period}-daily-${date}`
        });

        await storage.createMetric({
          clientId,
          metricName: 'Sessions per User',
          value: metrics.sessionsPerUser.toString(),
          sourceType: 'Client',
          timePeriod: `${period}-daily-${date}`
        });
      }

      logger.info('Successfully stored daily GA4 metrics', {
        clientId,
        period,
        daysStored: dailyData.length,
        metricsPerDay: 4
      });

    } catch (error) {
      logger.error('Error storing daily GA4 metrics:', error);
      throw error;
    }
  }

  /**
   * Fetch daily metrics breakdown for authentic temporal data
   */
  async fetchDailyGA4Data(clientId: string, startDate: string, endDate: string): Promise<Array<{date: string, metrics: any}> | null> {
    try {
      const propertyAccess = await this.getPropertyAccess(clientId);
      if (!propertyAccess) {
        return null;
      }

      logger.info('Making GA4 Daily Metrics API request', {
        propertyId: propertyAccess.propertyId,
        startDate,
        endDate
      });

      // Fetch daily breakdown for main metrics
      const dailyMetricsResponse = await this.fetchDailyMainMetrics(propertyAccess.propertyId, propertyAccess.accessToken, startDate, endDate);

      // Process daily data
      const dailyData = dailyMetricsResponse.rows?.map((row: any) => {
        const date = row.dimensionValues?.[0]?.value || '';
        const bounceRate = parseFloat(row.metricValues?.[0]?.value || '0') * 100;
        const sessionDuration = parseFloat(row.metricValues?.[1]?.value || '0');
        const pagesPerSession = parseFloat(row.metricValues?.[2]?.value || '0');
        const sessionsPerUser = parseFloat(row.metricValues?.[3]?.value || '0');
        const totalSessions = parseInt(row.metricValues?.[4]?.value || '0');
        const totalUsers = parseInt(row.metricValues?.[5]?.value || '0');

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

      logger.info(`Fetched ${dailyData.length} days of GA4 data for client ${clientId}`);
      return dailyData;

    } catch (error) {
      logger.error('Error fetching daily GA4 data:', error);
      return null;
    }
  }

  /**
   * Fetch daily main metrics with date dimension
   */
  private async fetchDailyMainMetrics(propertyId: string, accessToken: string, startDate: string, endDate: string) {
    const reportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }], // Add date dimension for daily breakdown
      metrics: [
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
        { name: 'sessionsPerUser' },
        { name: 'sessions' },
        { name: 'totalUsers' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }] // Sort by date
    };

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GA4 daily main metrics API error:', { status: response.status, error: errorText });
      throw new Error(`GA4 API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Fetch main metrics from GA4 API (aggregated for period)
   */
  private async fetchMainMetrics(propertyId: string, accessToken: string, startDate: string, endDate: string) {
    const reportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
        { name: 'sessionsPerUser' },
        { name: 'sessions' },
        { name: 'totalUsers' }
      ]
    };

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GA4 main metrics API error:', { status: response.status, error: errorText });
      throw new Error(`GA4 API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Fetch traffic channels from GA4 API
   */
  private async fetchTrafficChannels(propertyId: string, accessToken: string, startDate: string, endDate: string) {
    const reportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      metrics: [{ name: 'sessions' }]
    };

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GA4 traffic channels API error:', { status: response.status, error: errorText });
      throw new Error(`GA4 API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Fetch device data from GA4 API
   */
  private async fetchDeviceData(propertyId: string, accessToken: string, startDate: string, endDate: string) {
    const reportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }]
    };

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GA4 device data API error:', { status: response.status, error: errorText });
      throw new Error(`GA4 API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Refresh an expired access token using the refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in * 1000) // Convert to timestamp
    };
  }

  /**
   * Update service account tokens in database
   */
  private async updateServiceAccountTokens(serviceAccountId: string, accessToken: string, tokenExpiry: Date): Promise<void> {
    const { db } = await import('../db');
    const { ga4ServiceAccounts } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(ga4ServiceAccounts)
      .set({
        accessToken,
        tokenExpiry
      })
      .where(eq(ga4ServiceAccounts.id, serviceAccountId));
  }

  /**
   * Fetch and store monthly summarized GA4 data for a period
   */
  async fetchAndStoreMonthlyData(clientId: string, period: string, startDate: string, endDate: string): Promise<boolean> {
    try {
      const propertyAccess = await this.getPropertyAccess(clientId);
      if (!propertyAccess) {
        logger.warn(`No GA4 property access for client: ${clientId}`);
        return false;
      }

      // Fetch aggregated data for the entire month
      const monthlyData = await this.fetchGA4MonthlyMetrics(propertyAccess.propertyId, propertyAccess.accessToken, startDate, endDate);
      
      if (!monthlyData) {
        logger.error(`Failed to fetch monthly GA4 data for ${period}`);
        return false;
      }

      // Store monthly metrics
      await this.storeMonthlyMetrics(clientId, period, monthlyData);
      
      logger.info(`Successfully stored monthly GA4 data for ${period}`);
      return true;
      
    } catch (error) {
      logger.error(`Error in fetchAndStoreMonthlyData for ${period}:`, error);
      return false;
    }
  }

  /**
   * Fetch aggregated monthly metrics from GA4
   */
  private async fetchGA4MonthlyMetrics(propertyId: string, accessToken: string, startDate: string, endDate: string): Promise<GA4MetricData | null> {
    try {
      const body = {
        requests: [{
          property: `properties/${propertyId}`,
          dateRanges: [{
            startDate,
            endDate
          }],
          metrics: [
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'screenPageViewsPerSession' },
            { name: 'sessionsPerUser' },
            { name: 'sessions' },
            { name: 'totalUsers' }
          ],
          dimensions: [],
          keepEmptyRows: true
        }]
      };

      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        logger.error(`GA4 API error: ${response.status} - ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.reports?.[0]?.rows?.[0]) {
        logger.warn('No data returned from GA4 API for monthly fetch');
        return null;
      }

      const row = data.reports[0].rows[0];
      const values = row.metricValues;

      return {
        bounceRate: parseFloat(values[0].value || '0') * 100, // Convert to percentage
        sessionDuration: parseFloat(values[1].value || '0'),
        pagesPerSession: parseFloat(values[2].value || '0'),
        sessionsPerUser: parseFloat(values[3].value || '0'),
        totalSessions: parseInt(values[4].value || '0'),
        totalUsers: parseInt(values[5].value || '0'),
        trafficChannels: [], // Not needed for monthly summary
        deviceDistribution: [] // Not needed for monthly summary
      };

    } catch (error) {
      logger.error('Error fetching monthly GA4 metrics:', error);
      return null;
    }
  }

  /**
   * Store monthly summarized metrics
   */
  private async storeMonthlyMetrics(clientId: string, period: string, data: GA4MetricData): Promise<void> {
    const metrics = [
      { name: 'Bounce Rate', value: data.bounceRate.toFixed(2) },
      { name: 'Session Duration', value: data.sessionDuration.toFixed(2) },
      { name: 'Pages per Session', value: data.pagesPerSession.toFixed(2) },
      { name: 'Sessions per User', value: data.sessionsPerUser.toFixed(2) }
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

    logger.debug(`Stored ${metrics.length} monthly metrics for ${period}`);
  }
}

export const ga4DataService = new GA4DataService();