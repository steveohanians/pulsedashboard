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
    logger.info('Fetching historical data from SEMrush', { domain });
    
    try {
      // Check API balance before making requests
      await this.checkSufficientBalance(20); // Estimate 20 units for historical data
      
      const historicalData = new Map<string, any>();
      
      // Get last 12 months of data
      const months = this.generateLast12Months();
      
      for (const month of months) {
        try {
          // Apply rate limiting
          await this.rateLimiter.waitForToken();
          
          const params = new URLSearchParams({
            key: this.apiKey,
            domain: domain,
            date: month,
            format: 'json',
            export_columns: 'Dn,Ad,At,Mp,Dt,Sh'
          });
          
          const response = await fetch(`${this.baseUrl}?${params}`);
          
          if (!response.ok) {
            logger.warn('SEMrush API request failed for month', { 
              domain, 
              month, 
              status: response.status 
            });
            continue;
          }
          
          const data = await response.json();
          
          if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
            historicalData.set(month, data);
            logger.debug('SEMrush data retrieved for month', { 
              domain, 
              month, 
              records: data.data.length 
            });
          }
          
        } catch (error) {
          logger.warn('Error fetching SEMrush data for month', { 
            domain, 
            month, 
            error: (error as Error).message 
          });
        }
      }
      
      logger.info('SEMrush historical data fetch completed', { 
        domain, 
        periodsWithData: historicalData.size 
      });
      
      return historicalData;
      
    } catch (error) {
      logger.error('Failed to fetch SEMrush historical data', { 
        domain, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Optimized version of fetchHistoricalData with incremental sync support
   */
  public async fetchHistoricalDataOptimized(
    domain: string, 
    incrementalSync: boolean = false, 
    companyId?: string
  ): Promise<Map<string, any>> {
    logger.info('Fetching optimized historical data from SEMrush', { 
      domain, 
      incrementalSync, 
      companyId 
    });
    
    try {
      // For incremental sync, we could check what data we already have
      // For now, just use the regular fetch method
      if (incrementalSync && companyId) {
        // TODO: Implement incremental sync logic by checking existing data
        logger.info('Incremental sync requested - fetching only missing data', { 
          domain, 
          companyId 
        });
      }
      
      return await this.fetchHistoricalData(domain);
      
    } catch (error) {
      logger.error('Failed to fetch optimized SEMrush historical data', { 
        domain, 
        incrementalSync, 
        companyId, 
        error: (error as Error).message 
      });
      throw error;
    }
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
   * Generate last 12 months in YYYY-MM format
   */
  private generateLast12Months(): string[] {
    const months: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    
    return months;
  }
}

// Export service instance for use by other modules
export const semrushService = new SemrushService();