import logger from '../../utils/logging/logger';

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

export interface SemrushBalanceResponse {
  unitsLeft: number;
  unitsLimit: number;
  nextResetTime: number; // Unix timestamp
  resetPeriod: string; // e.g., "monthly", "daily"
}

export interface SemrushBalanceStatus {
  hasUnits: boolean;
  unitsRemaining: number;
  unitsLimit: number;
  percentageUsed: number;
  nextResetTime: Date;
  resetPeriod: string;
  lowBalanceWarning: boolean;
  criticalBalanceWarning: boolean;
}

import { requireSemrushApiKey } from '../../config';
import { ISemrushValidator } from '../../utils/company/validation';

export class SemrushService implements ISemrushValidator {
  private apiKey: string;
  private baseUrl = 'https://api.semrush.com/analytics/ta/api/v3'; // Analytics API v3 for traffic data
  private balanceUrl = 'https://www.semrush.com/users/countapiunits.html';
  private lastBalanceCheck: Date | null = null;
  private cachedBalance: SemrushBalanceStatus | null = null;
  private balanceCacheTimeout = 5 * 60 * 1000; // Cache balance for 5 minutes

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
      // Check API balance before making the request (estimate 5 units for this call)
      const hasBalance = await this.checkSufficientBalance(5);
      if (!hasBalance) {
        throw new Error('Insufficient SEMrush API units available for main metrics request');
      }

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
        
        // Check if this is a quota exceeded error (Error 131)
        if (response.status === 403 || errorText.includes('LIMIT EXCEEDED') || errorText.includes('Error 131')) {
          logger.error('SEMrush API quota exceeded (Error 131)', { 
            domain, 
            period, 
            status: response.status, 
            error: errorText 
          });
          // Force refresh balance cache after quota error
          await this.checkBalance(true);
          throw new Error('SEMrush API quota exceeded. Please check your balance and try again later.');
        }
        
        const errorMessage = `SEMrush API error: ${response.status} ${response.statusText} - ${errorText}`;
        logger.error('SEMrush API HTTP error', { domain, period, status: response.status, error: errorText });
        throw new Error(errorMessage);
      }

      const text = await response.text();
      // Force logging of API response to investigate Claroty issue
      logger.info('SEMrush API Response', { domain, period, responseText: text.substring(0, 500) });
      logger.debug('SEMrush main metrics response', { domain, period, response: text });

      if (text.includes('ERROR')) {
        // Check for quota exceeded errors in the response text
        if (text.includes('LIMIT EXCEEDED') || text.includes('Error 131')) {
          logger.error('SEMrush API quota exceeded in response', { domain, period, error: text });
          await this.checkBalance(true); // Force refresh balance cache
          throw new Error('SEMrush API quota exceeded. Please check your balance and try again later.');
        }
        
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
      // Check API balance before making device distribution requests (estimate 6 units for 2 device calls)
      const hasBalance = await this.checkSufficientBalance(6);
      if (!hasBalance) {
        throw new Error('Insufficient SEMrush API units available for device distribution request');
      }

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
            const errorText = await response.text();
            
            // Check if this is a quota exceeded error
            if (response.status === 403 || errorText.includes('LIMIT EXCEEDED') || errorText.includes('Error 131')) {
              logger.error(`SEMrush ${deviceType} API quota exceeded (Error 131)`, { 
                domain, 
                period, 
                deviceType,
                status: response.status, 
                error: errorText 
              });
              await this.checkBalance(true); // Force refresh balance cache
              throw new Error(`SEMrush API quota exceeded during ${deviceType} request. Please check your balance and try again later.`);
            }
            
            logger.warn(`SEMrush ${deviceType} API error: ${response.status}`, { domain, period });
            continue;
          }

          const text = await response.text();
          logger.debug(`SEMrush ${deviceType} response`, { domain, period, response: text.substring(0, 200) });

          if (text.includes('ERROR')) {
            // Check for quota exceeded errors in the response text
            if (text.includes('LIMIT EXCEEDED') || text.includes('Error 131')) {
              logger.error(`SEMrush ${deviceType} quota exceeded in response`, { domain, period, deviceType, error: text.trim() });
              await this.checkBalance(true); // Force refresh balance cache
              throw new Error(`SEMrush API quota exceeded during ${deviceType} request. Please check your balance and try again later.`);
            }
            
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
   * Fetch comprehensive 15-month historical data for a domain (legacy version)
   */
  public async fetchHistoricalData(domain: string): Promise<Map<string, SemrushMetricData>> {
    return this.fetchHistoricalDataOptimized(domain, false);
  }

  /**
   * Fetch historical data with optional incremental sync and parallel processing
   */
  public async fetchHistoricalDataOptimized(
    domain: string, 
    incrementalSync: boolean = false,
    companyId?: string
  ): Promise<Map<string, SemrushMetricData>> {
    logger.info('Starting SEMrush historical data fetch with optimizations', { 
      domain, 
      incrementalSync, 
      companyId: companyId || 'unknown' 
    });
    
    // Check balance before starting the data fetch operation
    const balance = await this.checkBalance();
    if (!balance.hasUnits) {
      logger.error('Cannot proceed with historical data fetch - no SEMrush API units available', {
        domain,
        unitsRemaining: balance.unitsRemaining,
        nextResetTime: balance.nextResetTime
      });
      throw new Error(`SEMrush API has no remaining units. Next reset: ${balance.nextResetTime.toISOString()}`);
    }
    
    const periods = this.generateHistoricalPeriods();
    let periodsToFetch = periods;

    // Check existing metrics for incremental sync
    if (incrementalSync && companyId) {
      periodsToFetch = await this.getMissingPeriods(companyId, periods);
      logger.info('Incremental sync analysis', { 
        domain,
        totalPeriods: periods.length,
        missingPeriods: periodsToFetch.length,
        skipCount: periods.length - periodsToFetch.length
      });
    }

    if (periodsToFetch.length === 0) {
      logger.info('No missing data found, skipping SEMrush fetch', { domain, companyId });
      return new Map<string, SemrushMetricData>();
    }

    // Estimate total API units needed (approximately 11 units per period: 5 for main metrics + 6 for device distribution)
    const estimatedUnitsNeeded = periodsToFetch.length * 11;
    if (balance.unitsRemaining < estimatedUnitsNeeded) {
      logger.warn('SEMrush API balance may not be sufficient for full historical fetch', {
        domain,
        periodsToFetch: periodsToFetch.length,
        estimatedUnitsNeeded,
        unitsRemaining: balance.unitsRemaining,
        percentageUsed: balance.percentageUsed
      });
      
      // If balance is critically low, limit the number of periods to fetch
      if (balance.criticalBalanceWarning && periodsToFetch.length > 3) {
        periodsToFetch = periodsToFetch.slice(-3); // Only fetch the last 3 periods
        logger.warn('Limited periods to fetch due to critically low API balance', {
          domain,
          originalCount: periods.length,
          limitedCount: periodsToFetch.length,
          unitsRemaining: balance.unitsRemaining
        });
      }
    }

    logger.info('Fetching SEMrush data for periods', { 
      domain, 
      periods: periodsToFetch, 
      count: periodsToFetch.length,
      estimatedUnitsNeeded: periodsToFetch.length * 11,
      unitsRemaining: balance.unitsRemaining
    });

    // Use parallel processing with rate limiting (10 req/sec = 100ms between requests)
    const results = await this.fetchPeriodsInParallel(domain, periodsToFetch);

    logger.info('Completed SEMrush historical data fetch', { 
      domain, 
      totalPeriods: results.size,
      successfulPeriods: Array.from(results.values()).filter(data => data.bounceRate > 0).length
    });

    return results;
  }

  /**
   * Check database for missing periods that need to be fetched
   */
  private async getMissingPeriods(companyId: string, allPeriods: string[]): Promise<string[]> {
    try {
      const { storage } = await import('../../storage');
      const existingMetrics = await storage.getMetricsByCompanyId(companyId);
      
      // Get periods that already have main metrics (bounce rate, session duration, etc.)
      const existingPeriods = new Set<string>();
      existingMetrics.forEach(metric => {
        if (metric.timePeriod && ['Bounce Rate', 'Session Duration', 'Pages per Session'].includes(metric.metricName)) {
          existingPeriods.add(metric.timePeriod);
        }
      });

      // Find missing periods
      const missingPeriods = allPeriods.filter(period => !existingPeriods.has(period));
      
      logger.debug('Missing periods analysis', {
        companyId,
        totalPeriods: allPeriods.length,
        existingPeriods: existingPeriods.size,
        missingPeriods: missingPeriods.length,
        missing: missingPeriods
      });

      return missingPeriods;
    } catch (error) {
      logger.warn('Failed to check existing metrics, falling back to full sync', {
        companyId,
        error: (error as Error).message
      });
      return allPeriods; // Fallback to fetching all periods
    }
  }

  /**
   * Fetch periods in parallel with rate limiting and retry logic
   */
  private async fetchPeriodsInParallel(domain: string, periods: string[]): Promise<Map<string, SemrushMetricData>> {
    const results = new Map<string, SemrushMetricData>();
    const MAX_CONCURRENT = 3; // Conservative limit to respect API constraints
    const BATCH_DELAY = 300; // 300ms between batches to stay under 10 req/sec

    // Process periods in batches to control concurrency
    for (let i = 0; i < periods.length; i += MAX_CONCURRENT) {
      const batch = periods.slice(i, i + MAX_CONCURRENT);
      
      logger.debug('Processing batch', { domain, batch, batchIndex: Math.floor(i / MAX_CONCURRENT) + 1 });

      // Process batch in parallel with retry logic
      const batchPromises = batch.map(period => this.fetchPeriodWithRetry(domain, period));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process batch results
      batchResults.forEach((result, index) => {
        const period = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          results.set(period, result.value);
          logger.debug('Successfully fetched period data', { domain, period });
        } else {
          const error = result.status === 'rejected' ? result.reason : 'Unknown error';
          logger.warn('Failed to fetch period data', { domain, period, error: error?.message || error });
          
          // Add empty data for failed periods
          results.set(period, {
            bounceRate: 0,
            sessionDuration: 0,
            pagesPerSession: 0,
            sessionsPerUser: 0,
            trafficChannels: [],
            deviceDistribution: []
          });
        }
      });

      // Add delay between batches to respect rate limits
      if (i + MAX_CONCURRENT < periods.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return results;
  }

  /**
   * Fetch single period with retry logic
   */
  private async fetchPeriodWithRetry(domain: string, period: string, maxRetries: number = 3): Promise<SemrushMetricData | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Fetching SEMrush data for period', { domain, period, attempt });

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
          trafficChannels: mainMetrics.trafficChannels || [],
          deviceDistribution: deviceDistribution || []
        };

        logger.info('Successfully fetched SEMrush data for period', { 
          domain, 
          period,
          bounceRate: periodData.bounceRate,
          sessionDuration: periodData.sessionDuration,
          trafficChannelsCount: periodData.trafficChannels.length,
          devicesCount: periodData.deviceDistribution.length
        });

        return periodData;

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to fetch SEMrush data for period (attempt ${attempt}/${maxRetries})`, {
          domain,
          period,
          error: lastError.message
        });

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s delay
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    logger.error('Failed to fetch SEMrush data for period after all retries', {
      domain,
      period,
      error: lastError?.message
    });

    return null;
  }

  /**
   * Check SEMrush API balance using the free balance endpoint
   * This endpoint is FREE and doesn't consume API units
   */
  public async checkBalance(forceFresh: boolean = false): Promise<SemrushBalanceStatus> {
    // Use cached balance if available and not expired (unless forceFresh is true)
    if (!forceFresh && this.cachedBalance && this.lastBalanceCheck) {
      const timeSinceLastCheck = Date.now() - this.lastBalanceCheck.getTime();
      if (timeSinceLastCheck < this.balanceCacheTimeout) {
        logger.debug('Using cached SEMrush balance', {
          cachedBalance: this.cachedBalance,
          cacheAgeMs: timeSinceLastCheck
        });
        return this.cachedBalance;
      }
    }

    try {
      logger.info('Checking SEMrush API balance (free endpoint)');
      
      const params = new URLSearchParams({
        key: this.apiKey
      });

      const response = await fetch(`${this.balanceUrl}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('SEMrush balance check HTTP error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Balance check failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      logger.debug('SEMrush balance check response', { responseText: text.substring(0, 200) });

      // Parse the response - SEMrush returns CSV-like format
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('Invalid balance response format');
      }

      // Expected format: units_left;units_limit;reset_time;reset_period
      const data = lines[1].split(';');
      if (data.length < 4) {
        throw new Error('Incomplete balance data received');
      }

      const unitsLeft = parseInt(data[0]) || 0;
      const unitsLimit = parseInt(data[1]) || 0;
      const resetTime = parseInt(data[2]) || 0;
      const resetPeriod = data[3] || 'unknown';

      const percentageUsed = unitsLimit > 0 ? ((unitsLimit - unitsLeft) / unitsLimit) * 100 : 0;
      const lowBalanceWarning = percentageUsed >= 80; // Warn at 80% usage
      const criticalBalanceWarning = percentageUsed >= 95; // Critical at 95% usage

      const balanceStatus: SemrushBalanceStatus = {
        hasUnits: unitsLeft > 0,
        unitsRemaining: unitsLeft,
        unitsLimit: unitsLimit,
        percentageUsed: Math.round(percentageUsed * 10) / 10, // Round to 1 decimal
        nextResetTime: new Date(resetTime * 1000), // Convert Unix timestamp
        resetPeriod: resetPeriod,
        lowBalanceWarning: lowBalanceWarning,
        criticalBalanceWarning: criticalBalanceWarning
      };

      // Cache the result
      this.cachedBalance = balanceStatus;
      this.lastBalanceCheck = new Date();

      // Log balance status
      if (criticalBalanceWarning) {
        logger.error('SEMrush API balance critically low!', {
          unitsRemaining: unitsLeft,
          unitsLimit: unitsLimit,
          percentageUsed: balanceStatus.percentageUsed,
          nextResetTime: balanceStatus.nextResetTime,
          resetPeriod: resetPeriod
        });
      } else if (lowBalanceWarning) {
        logger.warn('SEMrush API balance running low', {
          unitsRemaining: unitsLeft,
          unitsLimit: unitsLimit,
          percentageUsed: balanceStatus.percentageUsed,
          nextResetTime: balanceStatus.nextResetTime,
          resetPeriod: resetPeriod
        });
      } else {
        logger.info('SEMrush API balance check completed', {
          unitsRemaining: unitsLeft,
          unitsLimit: unitsLimit,
          percentageUsed: balanceStatus.percentageUsed,
          hasUnits: balanceStatus.hasUnits
        });
      }

      return balanceStatus;

    } catch (error) {
      logger.error('Failed to check SEMrush API balance', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      
      // Return a default status indicating we couldn't check balance
      // In production, you might want to fail more gracefully or retry
      return {
        hasUnits: false,
        unitsRemaining: 0,
        unitsLimit: 0,
        percentageUsed: 100,
        nextResetTime: new Date(),
        resetPeriod: 'unknown',
        lowBalanceWarning: true,
        criticalBalanceWarning: true
      };
    }
  }

  /**
   * Check if we have sufficient API units before making a request
   * @param requiredUnits Estimated units needed for the operation (default: 10)
   */
  private async checkSufficientBalance(requiredUnits: number = 10): Promise<boolean> {
    try {
      const balance = await this.checkBalance();
      
      if (!balance.hasUnits) {
        logger.error('SEMrush API has no remaining units', {
          unitsRemaining: balance.unitsRemaining,
          requiredUnits: requiredUnits,
          nextResetTime: balance.nextResetTime
        });
        return false;
      }

      if (balance.unitsRemaining < requiredUnits) {
        logger.error('Insufficient SEMrush API units for request', {
          unitsRemaining: balance.unitsRemaining,
          requiredUnits: requiredUnits,
          nextResetTime: balance.nextResetTime
        });
        return false;
      }

      // Log warnings for low balance
      if (balance.criticalBalanceWarning) {
        logger.warn('Proceeding with critically low API balance', {
          unitsRemaining: balance.unitsRemaining,
          percentageUsed: balance.percentageUsed,
          requiredUnits: requiredUnits
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to check API balance before request', {
        error: (error as Error).message,
        requiredUnits: requiredUnits
      });
      // In case of balance check failure, allow the request to proceed
      // The actual API call will fail with proper error if there's no balance
      return true;
    }
  }

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
    try {
      // First check balance to ensure we have units
      const balance = await this.checkBalance();
      if (!balance.hasUnits) {
        logger.warn('SEMrush API has no remaining units for connection test');
        return false;
      }

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

  /**
   * Get current balance status (public method for external use)
   */
  public async getBalanceStatus(): Promise<SemrushBalanceStatus> {
    return this.checkBalance();
  }
}

export const semrushService = new SemrushService();