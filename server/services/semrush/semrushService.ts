import logger from '../../utils/logging/logger';
import { createSemrushRateLimiter, type ApiRateLimiter } from '../../utils/apiRateLimiter';

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
  private rateLimiter: ApiRateLimiter;

  constructor() {
    this.apiKey = requireSemrushApiKey();
    this.rateLimiter = createSemrushRateLimiter();
    
    logger.info('SemrushService initialized with rate limiting', {
      maxRequestsPerSecond: 8,
      burstCapacity: 10
    });
  }

  /**
   * Parse a number from a potentially localized string
   * Handles thousand separators, spaces, and other formatting
   */
  private parseRobustNumber(value: string): number {
    if (!value || typeof value !== 'string') {
      throw new Error(`Invalid value for number parsing: ${value}`);
    }
    
    // Remove thousand separators, spaces, and other non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    if (!cleanValue) {
      throw new Error(`No digits found in value: ${value}`);
    }
    
    const parsed = Number(cleanValue);
    if (isNaN(parsed)) {
      throw new Error(`Cannot parse number from: ${value} (cleaned: ${cleanValue})`);
    }
    
    return parsed;
  }

  /**
   * Parse reset time from various formats SEMrush might return
   */
  private parseResetTime(value: string, fieldName?: string): Date {
    if (!value) {
      throw new Error('Empty reset time value');
    }
    
    // Try to parse as number first (Unix timestamp)
    const numericValue = this.parseRobustNumber(value);
    
    // Handle different reset time formats:
    // - epoch seconds (< 1e12): multiply by 1000
    // - epoch milliseconds (>= 1e12): use directly
    // - reset_in (seconds from now): add to current time
    
    if (fieldName && fieldName.toLowerCase().includes('reset_in')) {
      // This is "seconds until reset", not an absolute timestamp
      return new Date(Date.now() + numericValue * 1000);
    }
    
    if (numericValue < 1e12) {
      // Assume epoch seconds
      return new Date(numericValue * 1000);
    } else {
      // Assume epoch milliseconds
      return new Date(numericValue);
    }
  }

  /**
   * Check SEMrush API balance using the free balance endpoint with improved parsing
   * This endpoint is FREE and doesn't consume API units
   */
  public async checkBalance(forceFresh: boolean = false): Promise<SemrushBalanceStatus> {
    // Use cached balance if available and not expired (unless forceFresh is true)
    if (!forceFresh && this.cachedBalance && this.lastBalanceCheck) {
      const timeSinceLastCheck = Date.now() - this.lastBalanceCheck.getTime();
      if (timeSinceLastCheck < this.balanceCacheTimeout) {
        logger.debug('Using cached SEMrush balance', {
          cachedBalance: {
            hasUnits: this.cachedBalance.hasUnits,
            unitsRemaining: this.cachedBalance.unitsRemaining,
            nextResetTime: this.cachedBalance.nextResetTime.toISOString()
          },
          cacheAgeMs: timeSinceLastCheck
        });
        return this.cachedBalance;
      }
    }

    try {
      logger.info('Checking SEMrush API balance (free endpoint)');
      
      // Add type=ta parameter to query Traffic Analytics quota specifically
      const params = new URLSearchParams({
        key: this.apiKey,
        type: 'ta' // Traffic Analytics - matches the v3 API we're using
      });

      // Apply rate limiting before making the API call
      await this.rateLimiter.waitForToken();
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

      const text = await response.text().then(t => t.trim());
      
      // Log raw response for debugging (mask API key)
      const maskedResponse = text.replace(this.apiKey, '***API_KEY***');
      logger.info('SEMrush balance response received', { 
        rawFirst200: maskedResponse.substring(0, 200),
        responseLength: text.length,
        forceFresh
      });

      let unitsLeft: number;
      let unitsLimit: number;
      let resetTime: Date;
      let resetPeriod: string;

      // Detect format: JSON vs CSV vs Simple Number
      if (text.startsWith('{') || text.startsWith('[')) {
        // JSON format
        logger.debug('Parsing SEMrush response as JSON');
        const jsonData = JSON.parse(text);
        const data = Array.isArray(jsonData) ? jsonData[0] : jsonData;
        
        unitsLeft = this.parseRobustNumber(String(data.units_left || data.unitsLeft || data.remaining || 0));
        unitsLimit = this.parseRobustNumber(String(data.units_limit || data.unitsLimit || data.limit || 0));
        resetPeriod = String(data.reset_period || data.resetPeriod || 'unknown');
        
        const resetValue = data.reset_time || data.resetTime || data.reset_in || data.resetIn;
        resetTime = this.parseResetTime(String(resetValue), Object.keys(data).find(k => k.includes('reset')));
        
      } else if (/^\d+$/.test(text)) {
        // Simple number format - just the units remaining
        logger.debug('Parsing SEMrush response as simple number');
        unitsLeft = this.parseRobustNumber(text);
        unitsLimit = 10000000; // Default high limit for simple responses
        resetPeriod = 'monthly';
        
        // Set reset time to end of current month
        const now = new Date();
        resetTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        logger.debug('Simple number parsing successful', {
          unitsLeft: `${text} -> ${unitsLeft}`,
          unitsLimit: unitsLimit,
          resetTime: resetTime.toISOString(),
          resetPeriod
        });
        
      } else {
        // CSV format
        logger.debug('Parsing SEMrush response as CSV');
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          throw new Error(`Invalid CSV response: only ${lines.length} lines`);
        }

        // Parse header to find field positions
        const headers = lines[0].split(';').map(h => h.toLowerCase().trim());
        const data = lines[1].split(';').map(d => d.trim());
        
        logger.debug('CSV parsing details', {
          headersCount: headers.length,
          dataCount: data.length,
          headers: headers,
          sampleData: data.slice(0, 4) // First 4 fields for debugging
        });
        
        if (data.length !== headers.length) {
          throw new Error(`CSV mismatch: ${headers.length} headers, ${data.length} data fields`);
        }

        // Find field indices by name (case-insensitive)
        const findIndex = (names: string[]): number => {
          for (const name of names) {
            const index = headers.findIndex(h => h.includes(name));
            if (index !== -1) {
              logger.debug(`Found field "${name}" at index ${index}`);
              return index;
            }
          }
          return -1;
        };

        const unitsLeftIndex = findIndex(['units_left', 'unitsleft', 'remaining']);
        const unitsLimitIndex = findIndex(['units_limit', 'unitslimit', 'limit']);
        const resetTimeIndex = findIndex(['reset_time', 'resettime', 'reset_in', 'resetin']);
        const resetPeriodIndex = findIndex(['reset_period', 'resetperiod', 'period']);

        if (unitsLeftIndex === -1) {
          throw new Error(`Cannot find units left field. Available headers: [${headers.join(', ')}]`);
        }
        if (unitsLimitIndex === -1) {
          throw new Error(`Cannot find units limit field. Available headers: [${headers.join(', ')}]`);
        }
        if (resetTimeIndex === -1) {
          throw new Error(`Cannot find reset time field. Available headers: [${headers.join(', ')}]`);
        }

        unitsLeft = this.parseRobustNumber(data[unitsLeftIndex]);
        unitsLimit = this.parseRobustNumber(data[unitsLimitIndex]);
        resetTime = this.parseResetTime(data[resetTimeIndex], headers[resetTimeIndex]);
        resetPeriod = resetPeriodIndex >= 0 ? data[resetPeriodIndex] : 'unknown';

        logger.debug('CSV parsing successful', {
          unitsLeft: `${data[unitsLeftIndex]} -> ${unitsLeft}`,
          unitsLimit: `${data[unitsLimitIndex]} -> ${unitsLimit}`,
          resetTime: `${data[resetTimeIndex]} -> ${resetTime.toISOString()}`,
          resetPeriod
        });
      }

      const percentageUsed = unitsLimit > 0 ? ((unitsLimit - unitsLeft) / unitsLimit) * 100 : 0;
      const lowBalanceWarning = percentageUsed >= 80;
      const criticalBalanceWarning = percentageUsed >= 95;

      const balanceStatus: SemrushBalanceStatus = {
        hasUnits: unitsLeft > 0,
        unitsRemaining: unitsLeft,
        unitsLimit: unitsLimit,
        percentageUsed: Math.round(percentageUsed * 10) / 10,
        nextResetTime: resetTime,
        resetPeriod: resetPeriod,
        lowBalanceWarning: lowBalanceWarning,
        criticalBalanceWarning: criticalBalanceWarning
      };

      // Cache the result
      this.cachedBalance = balanceStatus;
      this.lastBalanceCheck = new Date();

      // Log balance status with appropriate level
      logger.info('SEMrush balance parsed successfully', {
        unitsRemaining: unitsLeft,
        unitsLimit: unitsLimit,
        percentageUsed: balanceStatus.percentageUsed,
        nextResetTime: balanceStatus.nextResetTime.toISOString(),
        resetPeriod: resetPeriod,
        hasUnits: balanceStatus.hasUnits
      });

      return balanceStatus;

    } catch (error) {
      logger.error('Failed to check/parse SEMrush API balance', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        forceFresh
      });
      
      // For parsing errors, don't return fake "no units" status
      throw new Error(`SEMrush balance check failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if we have sufficient API units before making a request
   * @param requiredUnits Estimated units needed for the operation (default: 10)
   */
  private async checkSufficientBalance(requiredUnits: number = 10): Promise<boolean> {
    try {
      // Force fresh balance check if we previously had no units
      const forceFresh = this.cachedBalance?.hasUnits === false;
      const balance = await this.checkBalance(forceFresh);
      
      if (!balance.hasUnits) {
        const errorMessage = `SEMrush API has no remaining units. Next reset: ${balance.nextResetTime.toISOString()}`;
        logger.error('SEMrush API has no remaining units', {
          unitsRemaining: balance.unitsRemaining,
          unitsLimit: balance.unitsLimit,
          requiredUnits: requiredUnits,
          nextResetTime: balance.nextResetTime.toISOString(),
          resetPeriod: balance.resetPeriod,
          forceFreshUsed: forceFresh
        });
        
        throw new Error(errorMessage);
      }

      if (balance.unitsRemaining < requiredUnits) {
        const errorMessage = `Insufficient SEMrush API units: ${balance.unitsRemaining} remaining, ${requiredUnits} required. Next reset: ${balance.nextResetTime.toISOString()}`;
        logger.error('Insufficient SEMrush API units for request', {
          unitsRemaining: balance.unitsRemaining,
          unitsLimit: balance.unitsLimit,
          requiredUnits: requiredUnits,
          nextResetTime: balance.nextResetTime.toISOString(),
          resetPeriod: balance.resetPeriod
        });
        
        throw new Error(errorMessage);
      }

      return true;
    } catch (error) {
      // Re-throw the error to surface it to the user
      throw error;
    }
  }

  /**
   * Fetch historical data from SEMrush API for a given domain
   * Required by ISemrushValidator interface
   */
  public async fetchHistoricalData(domain: string): Promise<Map<string, any>> {
    return this.fetchHistoricalDataOptimized(domain, false);
  }

  /**
   * Optimized version of fetchHistoricalData with incremental sync support
   */
  public async fetchHistoricalDataOptimized(
    domain: string, 
    incrementalSync: boolean = false,
    companyId?: string
  ): Promise<Map<string, any>> {
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
      return new Map<string, any>();
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

    logger.info('Starting SEMrush data fetch', { 
      domain, 
      totalPeriods: periodsToFetch.length,
      estimatedUnitsNeeded,
      currentBalance: balance.unitsRemaining
    });

    const results = new Map<string, any>();

    // Process periods sequentially to respect rate limits and preserve API units
    for (let i = 0; i < periodsToFetch.length; i++) {
      const period = periodsToFetch[i];
      
      try {
        const periodData = await this.fetchPeriodWithRetry(domain, period);
        
        if (periodData) {
          results.set(period, periodData);
          logger.info(`Successfully processed period ${i + 1}/${periodsToFetch.length}`, { 
            domain, 
            period,
            totalPeriods: results.size 
          });
        } else {
          logger.warn(`No data available for period ${period}`, { domain, period });
        }
        
        // Brief pause between periods to be respectful to the API
        if (i < periodsToFetch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        logger.error(`Failed to fetch data for period ${period}`, { 
          domain, 
          period, 
          error: (error as Error).message 
        });
        
        // Continue with other periods even if one fails
        continue;
      }
    }

    logger.info('Completed SEMrush historical data fetch', { 
      domain, 
      requestedPeriods: periodsToFetch.length,
      successfulPeriods: results.size,
      failedPeriods: periodsToFetch.length - results.size
    });

    return results;
  }

  /**
   * Test SEMrush API connection
   */
  public async testConnection(): Promise<boolean> {
    logger.info('Testing SEMrush API connection');
    
    try {
      // Use the balance check as a connection test since it's free
      await this.checkBalance(true); // Force fresh check
      logger.info('SEMrush API connection test successful');
      return true;
      
    } catch (error) {
      logger.error('SEMrush API connection test failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * Generate 15 months of historical periods starting from last completed month
   * Attempts to fetch the freshest available data and gracefully falls back
   * when recent months aren't available yet via existing error handling
   */
  private generateHistoricalPeriods(): string[] {
    const periods: string[] = [];
    const now = new Date();
    
    // Start from last completed month - let API calls determine actual availability
    // The existing error handling and fallback logic will gracefully handle
    // cases where the most recent months don't have data yet
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
   * Check which periods are missing from existing data for incremental sync
   */
  private async getMissingPeriods(companyId: string, allPeriods: string[]): Promise<string[]> {
    // This would need access to storage to check existing metrics
    // For now, return all periods to maintain compatibility
    return allPeriods;
  }

  /**
   * Fetch single period with retry logic
   */
  private async fetchPeriodWithRetry(domain: string, period: string, maxRetries: number = 3): Promise<any | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Fetching SEMrush data for period', { domain, period, attempt });

        // Fetch all metrics in parallel for this period
        const [mainMetrics, deviceDistribution] = await Promise.all([
          this.fetchMainMetrics(domain, period),
          this.fetchDeviceDistribution(domain, period)
        ]);

        const periodData = {
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
   * Fetch main website metrics from SEMrush using v3 API
   */
  private async fetchMainMetrics(domain: string, period: string): Promise<any> {
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

      // Apply rate limiting before making the API call
      await this.rateLimiter.waitForToken();
      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('SEMrush API HTTP error', { domain, period, status: response.status, error: errorText });
        throw new Error(`SEMrush API error: ${response.status} ${response.statusText} - ${errorText}`);
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
      const trafficChannels = [];
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
      throw error;
    }
  }

  /**
   * Fetch device distribution data from SEMrush
   */
  private async fetchDeviceDistribution(domain: string, period: string): Promise<any[]> {
    try {
      // Placeholder - would fetch device distribution data
      // For now return empty array to prevent errors
      return [];
    } catch (error) {
      logger.error('Failed to fetch device distribution', { domain, period, error: (error as Error).message });
      return [];
    }
  }
}

// Export service instance for use by other modules
export const semrushService = new SemrushService();