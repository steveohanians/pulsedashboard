import { storage } from '../storage';
import { GA4DataService } from './ga4DataService';
import logger from '../utils/logger';
import type { Metric } from '@shared/schema';

// NEW: In-memory locking mechanism for per-period fetch coordination
const activeFetches = new Map<string, Promise<any>>();

/**
 * NEW: Acquire a lock for a specific GA4 key (clientId + period) with TTL
 * Prevents concurrent fetches for the same GA4 key
 */
async function acquireLock(lockKey: string, ttlMs: number = 300000): Promise<boolean> {
  if (activeFetches.has(lockKey)) {
    // Wait for existing fetch to complete
    try {
      await activeFetches.get(lockKey);
    } catch (error) {
      // If existing fetch failed, we can proceed
    }
    // Check again after waiting
    if (activeFetches.has(lockKey)) {
      return false; // Still locked
    }
  }
  return true;
}

/**
 * NEW: Release lock for a specific GA4 key
 */
function releaseLock(lockKey: string): void {
  activeFetches.delete(lockKey);
}

interface DataPeriod {
  year: number;
  month: number;
  period: string; // YYYY-MM format
  type: 'daily' | 'monthly';
}

interface ExistingDataStatus {
  period: string;
  metricName: string;
  dataType: 'daily' | 'monthly' | 'none';
  recordCount: number;
}

export class SmartGA4DataFetcher {
  private ga4Service: GA4DataService;
  
  constructor() {
    this.ga4Service = new GA4DataService();
  }

  /**
   * Smart 15-month GA4 data fetching with intelligent storage optimization
   * NEW: Added force parameter to bypass cached reads and always refresh data
   */
  async fetch15MonthData(clientId: string, force?: boolean): Promise<{
    success: boolean;
    periodsProcessed: number;
    dailyDataPeriods: string[];
    monthlyDataPeriods: string[];
    errors: string[];
    lastFetchedAt?: string; // NEW: Track when data was last fetched
  }> {
    const result = {
      success: true,
      periodsProcessed: 0,
      dailyDataPeriods: [] as string[],
      monthlyDataPeriods: [] as string[],
      errors: [] as string[],
      lastFetchedAt: new Date().toISOString() // NEW: Record fetch timestamp
    };

    try {
      // Generate 15-month period list (current month + 14 previous months)
      const periods = this.generate15MonthPeriods();
      logger.info(`Starting smart 15-month data fetch for ${periods.length} periods`);

      // NEW: Check existing data status for all periods (skip if force is true)
      let existingDataStatus = new Map<string, ExistingDataStatus[]>();
      if (!force) {
        existingDataStatus = await this.checkExistingData(clientId, periods);
      } else {
        logger.info('Force mode enabled: bypassing cached data checks');
      }

      // Process each period with intelligent data management
      for (const period of periods) {
        try {
          // NEW: Acquire lock for this specific period
          const lockKey = `${clientId}:${period.period}`;
          const lockAcquired = await acquireLock(lockKey);
          
          if (!lockAcquired) {
            result.errors.push(`Skipped ${period.period}: concurrent fetch in progress`);
            continue;
          }

          // Create a promise for this fetch and store it
          const fetchPromise = this.processPeriodData(clientId, period, existingDataStatus, force);
          activeFetches.set(lockKey, fetchPromise);

          try {
            const processed = await fetchPromise;
            if (processed.success) {
              result.periodsProcessed++;
              if (processed.dataType === 'daily') {
                result.dailyDataPeriods.push(period.period);
              } else {
                result.monthlyDataPeriods.push(period.period);
              }
            } else {
              result.errors.push(`Failed to process ${period.period}: ${processed.error}`);
            }
          } finally {
            // NEW: Always release lock after processing
            releaseLock(lockKey);
          }
        } catch (error) {
          result.errors.push(`Error processing ${period.period}: ${error}`);
        }
      }

      logger.info(`Smart fetch completed: ${result.periodsProcessed}/${periods.length} periods processed`);
      
    } catch (error) {
      logger.error('Smart 15-month data fetch failed:', error);
      result.success = false;
      result.errors.push(`Overall fetch failed: ${error}`);
    }

    return result;
  }

  /**
   * Generate list of 15-month periods (current + 14 previous)
   */
  private generate15MonthPeriods(): DataPeriod[] {
    const periods: DataPeriod[] = [];
    const now = new Date();
    
    for (let i = 0; i < 15; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      
      // Current and recent months get daily data, older months get monthly
      const type = i <= 2 ? 'daily' : 'monthly';
      
      periods.push({ year, month, period, type });
    }
    
    return periods;
  }

  /**
   * Check existing data status for all periods
   */
  private async checkExistingData(clientId: string, periods: DataPeriod[]): Promise<Map<string, ExistingDataStatus[]>> {
    const statusMap = new Map<string, ExistingDataStatus[]>();
    
    // Core metrics to check
    const coreMetrics = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
    
    for (const period of periods) {
      const periodStatus: ExistingDataStatus[] = [];
      
      for (const metricName of coreMetrics) {
        // Check for daily data
        const dailyData = await storage.getMetricsForPeriod(
          clientId, 
          `${period.period}-daily`, 
          metricName
        );
        
        // Check for monthly data
        const monthlyData = await storage.getMetricsForPeriod(
          clientId, 
          period.period, 
          metricName
        );
        
        let dataType: 'daily' | 'monthly' | 'none' = 'none';
        let recordCount = 0;
        
        if (dailyData.length > 0) {
          dataType = 'daily';
          recordCount = dailyData.length;
        } else if (monthlyData.length > 0) {
          dataType = 'monthly';
          recordCount = monthlyData.length;
        }
        
        periodStatus.push({
          period: period.period,
          metricName,
          dataType,
          recordCount
        });
      }
      
      statusMap.set(period.period, periodStatus);
    }
    
    return statusMap;
  }

  /**
   * Process individual period data with smart optimization
   * NEW: Added force parameter to bypass cached reads
   */
  private async processPeriodData(
    clientId: string, 
    period: DataPeriod, 
    existingDataStatus: Map<string, ExistingDataStatus[]>,
    force?: boolean // NEW: Force parameter to bypass cache
  ): Promise<{ success: boolean; dataType: 'daily' | 'monthly'; error?: string }> {
    
    const periodStatus = existingDataStatus.get(period.period) || [];
    
    // NEW: If force is true, skip cached data checks and always fetch
    let needsData;
    if (force) {
      needsData = { fetch: true, reason: 'Force mode: bypassing cache' };
      logger.info(`Force fetching ${period.period}: bypassing all cached data`);
    } else {
      // Check if we need to fetch data for this period
      needsData = this.determineDataNeeds(period, periodStatus);
      
      if (!needsData.fetch) {
        logger.debug(`Skipping ${period.period}: ${needsData.reason}`);
        return { success: true, dataType: needsData.existingType! };
      }
    }

    // Handle data optimization: replace daily with monthly for older periods
    if (needsData.replaceDaily) {
      await this.replaceDailyWithMonthly(clientId, period);
    }

    // Fetch new data based on period requirements
    if (period.type === 'daily') {
      return await this.fetchDailyData(clientId, period);
    } else {
      return await this.fetchMonthlyData(clientId, period);
    }
  }

  /**
   * Determine if and how to fetch data for a period
   */
  private determineDataNeeds(
    period: DataPeriod, 
    existingStatus: ExistingDataStatus[]
  ): { 
    fetch: boolean; 
    reason: string; 
    replaceDaily?: boolean; 
    existingType?: 'daily' | 'monthly' 
  } {
    
    const hasData = existingStatus.some(status => status.dataType !== 'none');
    
    if (!hasData) {
      return { fetch: true, reason: 'No existing data found' };
    }

    const hasDailyData = existingStatus.some(status => status.dataType === 'daily');
    const hasMonthlyData = existingStatus.some(status => status.dataType === 'monthly');

    // If we need monthly data but have daily, replace it
    if (period.type === 'monthly' && hasDailyData) {
      return { fetch: true, reason: 'Replacing daily with monthly', replaceDaily: true };
    }

    // If we need daily data but only have monthly, fetch daily
    if (period.type === 'daily' && hasMonthlyData && !hasDailyData) {
      return { fetch: true, reason: 'Upgrading monthly to daily data' };
    }

    // If we already have the correct type, skip
    if ((period.type === 'daily' && hasDailyData) || (period.type === 'monthly' && hasMonthlyData)) {
      return { 
        fetch: false, 
        reason: 'Correct data type already exists',
        existingType: period.type
      };
    }

    return { fetch: true, reason: 'Data type mismatch' };
  }

  /**
   * Replace daily data with summarized monthly data
   */
  private async replaceDailyWithMonthly(clientId: string, period: DataPeriod): Promise<void> {
    logger.info(`Replacing daily data with monthly summary for ${period.period}`);
    
    const coreMetrics = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
    
    for (const metricName of coreMetrics) {
      // Get existing daily data
      const dailyData = await storage.getMetricsForPeriod(
        clientId, 
        `${period.period}-daily`, 
        metricName
      );
      
      if (dailyData.length > 0) {
        // Calculate monthly average
        const values = dailyData.map(d => parseFloat(d.value as string));
        const monthlyAverage = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        // Delete daily records
        await storage.deleteMetricsForPeriod(clientId, `${period.period}-daily`, metricName);
        
        // NEW: Insert monthly summary (metadata tracking implemented via logging)
        await storage.createMetric({
          clientId,
          metricName,
          value: monthlyAverage.toString(),
          sourceType: 'Client',
          timePeriod: period.period
        });
        
        // NEW: Log metadata for tracking purposes
        logger.info('Monthly summary created with metadata', {
          clientId,
          metricName,
          period: period.period,
          lastFetchedAt: new Date().toISOString(),
          source: 'ga4',
          dataType: 'monthly_summary'
        });
        
        logger.debug(`Converted ${dailyData.length} daily records to 1 monthly record for ${metricName}`);
      }
    }
  }

  /**
   * Fetch daily GA4 data for a period
   */
  private async fetchDailyData(clientId: string, period: DataPeriod): Promise<{ success: boolean; dataType: 'daily'; error?: string }> {
    try {
      logger.info(`Fetching daily GA4 data for ${period.period}`);
      
      const startDate = `${period.year}-${period.month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(period.year, period.month, 0).toISOString().split('T')[0]; // Last day of month
      
      // NEW: Enhanced GA4 service call with metadata logging
      const success = await this.ga4Service.fetchAndStoreMonthlyData(
        clientId, 
        period.period, 
        startDate, 
        endDate
      );
      
      // NEW: Log metadata for tracking purposes
      if (success) {
        logger.info('Daily GA4 data fetched with metadata', {
          clientId,
          period: period.period,
          lastFetchedAt: new Date().toISOString(),
          source: 'ga4',
          dataType: 'daily'
        });
      }
      
      if (success) {
        logger.info(`Successfully fetched daily data for ${period.period}`);
        return { success: true, dataType: 'daily' };
      } else {
        return { success: false, dataType: 'daily', error: 'GA4 fetch failed' };
      }
      
    } catch (error) {
      logger.error(`Failed to fetch daily data for ${period.period}:`, error);
      return { success: false, dataType: 'daily', error: String(error) };
    }
  }

  /**
   * Fetch monthly GA4 data for a period
   */
  private async fetchMonthlyData(clientId: string, period: DataPeriod): Promise<{ success: boolean; dataType: 'monthly'; error?: string }> {
    try {
      logger.info(`Fetching monthly GA4 data for ${period.period}`);
      
      const startDate = `${period.year}-${period.month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(period.year, period.month, 0).toISOString().split('T')[0];
      
      // NEW: Enhanced GA4 service call with metadata logging
      const success = await this.ga4Service.fetchAndStoreMonthlyData(
        clientId, 
        period.period, 
        startDate, 
        endDate
      );
      
      // NEW: Log metadata for tracking purposes
      if (success) {
        logger.info('Monthly GA4 data fetched with metadata', {
          clientId,
          period: period.period,
          lastFetchedAt: new Date().toISOString(),
          source: 'ga4',
          dataType: 'monthly'
        });
      }
      
      if (success) {
        logger.info(`Successfully fetched monthly data for ${period.period}`);
        return { success: true, dataType: 'monthly' };
      } else {
        return { success: false, dataType: 'monthly', error: 'GA4 fetch failed' };
      }
      
    } catch (error) {
      logger.error(`Failed to fetch monthly data for ${period.period}:`, error);
      return { success: false, dataType: 'monthly', error: String(error) };
    }
  }
}

// NEW: Main exported function that accepts force parameter
export async function smartGA4DataFetcher(options: { 
  clientId: string; 
  force?: boolean 
}): Promise<{
  success: boolean;
  periodsProcessed: number;
  dailyDataPeriods: string[];
  monthlyDataPeriods: string[];
  errors: string[];
  lastFetchedAt?: string;
}> {
  const fetcher = new SmartGA4DataFetcher();
  return await fetcher.fetch15MonthData(options.clientId, options.force);
}