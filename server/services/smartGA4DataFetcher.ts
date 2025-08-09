import { storage } from '../storage';
import { GA4DataService } from './ga4DataService';
import logger from '../utils/logger';
import type { Metric } from '@shared/schema';

// Lock tracking with proper typing for better maintainability
interface LockInfo {
  promise: Promise<{ success: boolean; dataType: 'daily' | 'monthly'; error?: string }>;
  timestamp: number;
}

// In-memory locking mechanism for per-period fetch coordination
const activeFetches = new Map<string, LockInfo>();

/**
 * Acquire a lock for a specific GA4 key (clientId + period) with TTL enforcement
 * Prevents concurrent fetches for the same GA4 key and cleans up stale locks
 */
async function acquireLock(lockKey: string, ttlMs: number = 300000): Promise<boolean> {
  const now = Date.now();
  
  // Clean up expired locks to prevent memory leaks
  for (const [key, lockInfo] of Array.from(activeFetches.entries())) {
    if (now - lockInfo.timestamp > ttlMs) {
      activeFetches.delete(key);
      logger.warn(`Cleaned up expired lock: ${key}`);
    }
  }
  
  const existingLock = activeFetches.get(lockKey);
  if (existingLock) {
    // Wait for existing fetch to complete, but with timeout protection
    try {
      await Promise.race([
        existingLock.promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Lock timeout')), ttlMs))
      ]);
    } catch (error) {
      // If existing fetch failed or timed out, clean up and proceed
      activeFetches.delete(lockKey);
    }
    
    // Double-check lock status after waiting
    return !activeFetches.has(lockKey);
  }
  
  return true; // No existing lock, can proceed
}

/**
 * Release lock for a specific GA4 key
 */
function releaseLock(lockKey: string): void {
  activeFetches.delete(lockKey);
}

/**
 * Validate clientId format for security
 */
function validateClientId(clientId: string): boolean {
  return typeof clientId === 'string' && 
         clientId.length > 0 && 
         clientId.length <= 100 && 
         /^[a-zA-Z0-9-_]+$/.test(clientId);
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
   * Enhanced with force parameter to bypass cached reads and always refresh data
   */
  async fetch15MonthData(clientId: string, force?: boolean): Promise<{
    success: boolean;
    periodsProcessed: number;
    dailyDataPeriods: string[];
    monthlyDataPeriods: string[];
    errors: string[];
    lastFetchedAt: string;
  }> {
    // Input validation for security
    if (!validateClientId(clientId)) {
      throw new Error('Invalid clientId format');
    }

    const result = {
      success: true,
      periodsProcessed: 0,
      dailyDataPeriods: [] as string[],
      monthlyDataPeriods: [] as string[],
      errors: [] as string[],
      lastFetchedAt: new Date().toISOString()
    };

    const acquiredLocks = new Set<string>(); // Track locks for cleanup

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
        const lockKey = `${clientId}:${period.period}`;
        
        try {
          // Acquire lock for this specific period
          const lockAcquired = await acquireLock(lockKey);
          
          if (!lockAcquired) {
            result.errors.push(`Skipped ${period.period}: concurrent fetch in progress`);
            continue;
          }

          // Track acquired lock for cleanup
          acquiredLocks.add(lockKey);

          // Create and store the fetch promise with proper typing
          const fetchPromise = this.processPeriodData(clientId, period, existingDataStatus, force);
          activeFetches.set(lockKey, {
            promise: fetchPromise,
            timestamp: Date.now()
          });

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
              result.errors.push(`Failed to process ${period.period}: ${processed.error || 'Unknown error'}`);
            }
          } finally {
            // Always release lock after processing
            releaseLock(lockKey);
            acquiredLocks.delete(lockKey);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing ${period.period}: ${errorMessage}`);
          
          // Ensure lock is released on error
          if (acquiredLocks.has(lockKey)) {
            releaseLock(lockKey);
            acquiredLocks.delete(lockKey);
          }
        }
      }

      logger.info(`Smart fetch completed: ${result.periodsProcessed}/${periods.length} periods processed`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Smart 15-month data fetch failed:', { error: errorMessage, clientId });
      result.success = false;
      result.errors.push(`Overall fetch failed: ${errorMessage}`);
    } finally {
      // Ensure all acquired locks are released on any exit path
      for (const lockKey of Array.from(acquiredLocks)) {
        releaseLock(lockKey);
      }
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
      
      // Enhanced GA4 service call with metadata logging
      const success = await this.ga4Service.fetchAndStoreMonthlyData(
        clientId, 
        period.period, 
        startDate, 
        endDate
      );
      
      if (success) {
        // Consolidated success logging with metadata
        logger.info(`Successfully fetched daily GA4 data for ${period.period}`, {
          clientId,
          period: period.period,
          lastFetchedAt: new Date().toISOString(),
          source: 'ga4',
          dataType: 'daily'
        });
        return { success: true, dataType: 'daily' };
      } else {
        return { success: false, dataType: 'daily', error: 'GA4 API request failed' };
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
      
      // Enhanced GA4 service call with metadata logging
      const success = await this.ga4Service.fetchAndStoreMonthlyData(
        clientId, 
        period.period, 
        startDate, 
        endDate
      );
      
      if (success) {
        // Consolidated success logging with metadata
        logger.info(`Successfully fetched monthly GA4 data for ${period.period}`, {
          clientId,
          period: period.period,
          lastFetchedAt: new Date().toISOString(),
          source: 'ga4',
          dataType: 'monthly'
        });
        return { success: true, dataType: 'monthly' };
      } else {
        return { success: false, dataType: 'monthly', error: 'GA4 API request failed' };
      }
      
    } catch (error) {
      logger.error(`Failed to fetch monthly data for ${period.period}:`, error);
      return { success: false, dataType: 'monthly', error: String(error) };
    }
  }
}

/**
 * Main exported function for smart GA4 data fetching with force parameter support
 * Provides a clean interface for external callers while maintaining internal class structure
 */
export async function smartGA4DataFetcher(options: { 
  clientId: string; 
  force?: boolean 
}): Promise<{
  success: boolean;
  periodsProcessed: number;
  dailyDataPeriods: string[];
  monthlyDataPeriods: string[];
  errors: string[];
  lastFetchedAt: string;
}> {
  if (!options || !options.clientId) {
    throw new Error('ClientId is required');
  }
  
  const fetcher = new SmartGA4DataFetcher();
  return await fetcher.fetch15MonthData(options.clientId, options.force);
}