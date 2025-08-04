/**
 * GA4 Data Manager
 * 
 * Main orchestrator for all GA4 data operations. Provides a clean, 
 * high-level interface for fetching, processing, and storing GA4 data.
 */

import logger from '../../utils/logger';
import { GA4AuthenticationService } from './GA4AuthenticationService';
import { GA4APIService } from './GA4APIService';
import { GA4DataProcessor } from './GA4DataProcessor';
import { GA4StorageService } from './GA4StorageService';
import { DATA_MANAGEMENT } from './constants';
import type { 
  GA4MetricData, 
  GA4DailyMetric, 
  FetchResult, 
  SmartFetchOptions, 
  DataPeriod,
  ExistingDataStatus 
} from './types';

export class GA4DataManager {
  private authService: GA4AuthenticationService;
  private apiService: GA4APIService;
  private processor: GA4DataProcessor;
  private storageService: GA4StorageService;

  constructor() {
    this.authService = new GA4AuthenticationService();
    this.apiService = new GA4APIService();
    this.processor = new GA4DataProcessor();
    this.storageService = new GA4StorageService();
  }

  /**
   * Fetch and store GA4 data for a specific period
   */
  async fetchPeriodData(
    clientId: string, 
    startDate: string, 
    endDate: string, 
    period?: string
  ): Promise<GA4MetricData | null> {
    try {
      logger.info(`Fetching GA4 data for client ${clientId}, period ${startDate} to ${endDate}`);

      // Get authenticated property access
      const propertyAccess = await this.authService.getPropertyAccess(clientId);
      if (!propertyAccess) {
        logger.warn(`No GA4 property access for client: ${clientId}`);
        return null;
      }

      // Fetch data from GA4 API
      const rawData = await this.apiService.fetchBatchData(propertyAccess, startDate, endDate);

      // Process the raw data
      const processedData = this.processor.processGA4Response(
        rawData.mainMetrics,
        rawData.trafficChannels,
        rawData.deviceData
      );

      if (!processedData) {
        logger.error('Failed to process GA4 data');
        return null;
      }

      // Store the data if period is provided
      if (period) {
        await this.storageService.storeGA4Metrics(clientId, period, processedData);
      }

      logger.info(`Successfully fetched GA4 data for client ${clientId}`);
      return processedData;

    } catch (error) {
      logger.error(`Error fetching GA4 data for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Fetch and store daily GA4 data for a specific period (WITH TRAFFIC CHANNELS & DEVICE DATA)
   */
  async fetchDailyData(
    clientId: string, 
    startDate: string, 
    endDate: string, 
    period: string
  ): Promise<GA4DailyMetric[] | null> {
    try {
      logger.info(`Fetching daily GA4 data for client ${clientId}, period ${period}`);

      // Get authenticated property access
      const propertyAccess = await this.authService.getPropertyAccess(clientId);
      if (!propertyAccess) {
        logger.warn(`No GA4 property access for client: ${clientId}`);
        return null;
      }

      // Fetch daily main metrics AND period-level traffic channels + device data
      const [rawDailyData, rawBatchData] = await Promise.all([
        this.apiService.fetchDailyMainMetrics(propertyAccess, startDate, endDate),
        this.apiService.fetchBatchData(propertyAccess, startDate, endDate)
      ]);

      // Process the daily data
      const processedDailyData = this.processor.processDailyGA4Response(rawDailyData);

      if (!processedDailyData) {
        logger.error('Failed to process daily GA4 data');
        return null;
      }

      // ALSO process and store the period-level Traffic Channels and Device Data
      const processedPeriodData = this.processor.processGA4Response(
        rawBatchData.mainMetrics,
        rawBatchData.trafficChannels,
        rawBatchData.deviceData
      );

      if (processedPeriodData) {
        // Store period-level data (Traffic Channels & Device Distribution)
        await this.storageService.storeGA4Metrics(clientId, period, processedPeriodData);
        logger.info(`Stored Traffic Channels and Device data for period ${period}`);
      } else {
        logger.error(`Failed to process period data for ${period}`);
      }

      // Store the daily data
      await this.storageService.storeDailyGA4Metrics(clientId, period, processedDailyData);

      logger.info(`Successfully fetched ${processedDailyData.length} days of GA4 data for client ${clientId}`);
      return processedDailyData;

    } catch (error) {
      logger.error(`Error fetching daily GA4 data for client ${clientId}:`, error);
      return null;
    }
  }

  /**
   * Clear all existing GA4 data for client
   */
  async clearAllClientData(clientId: string): Promise<void> {
    try {
      logger.info(`Clearing all existing GA4 data for client ${clientId}`);
      await this.storageService.clearAllClientData(clientId);
      logger.info(`Successfully cleared all GA4 data for client ${clientId}`);
    } catch (error) {
      logger.error(`Error clearing data for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * 🚀 COMPLETE GA4 DATA SYNC - Your single command for full data refresh
   * 
   * This method executes the complete GA4 data synchronization process:
   * 
   * 1. CLEARS all existing GA4 data from databases and JSON files
   * 2. FETCHES 15 months of fresh GA4 data using proper logic:
   *    - Month 1: Daily data for Bounce Rate, Session Duration, Pages per Session, Sessions per User
   *             + Monthly data for Traffic Channels, Device Distribution  
   *    - Months 2-15: Monthly data for all 6 chart types
   * 3. PROCESSES and STORES all data with correct mapping
   * 4. ENSURES all 6 charts refresh with authentic GA4 data
   * 
   * Call this method when you need complete GA4 data refresh.
   */
  async executeCompleteGA4DataSync(clientId: string): Promise<{
    success: boolean;
    summary: string;
    periodsProcessed: number;
    dailyDataPeriods: string[];
    monthlyDataPeriods: string[];
    errors: string[];
    chartsRefreshed: string[];
  }> {
    try {
      logger.info(`🚀 EXECUTING COMPLETE GA4 DATA SYNC for client ${clientId}`);
      
      // Step 1: Clear all existing GA4 data (databases + JSON files)
      logger.info(`Step 1: Clearing all existing GA4 data for client ${clientId}`);
      await this.clearAllClientData(clientId);
      
      // Step 2: Execute 15-month smart fetch with force refresh
      logger.info(`Step 2: Fetching 15 months of fresh GA4 data for client ${clientId}`);
      const result = await this.smartFetch({ 
        clientId, 
        periods: DATA_MANAGEMENT.DEFAULT_PERIODS,
        forceRefresh: true 
      });
      
      // Step 3: Generate summary
      const chartsRefreshed = [
        'Bounce Rate',
        'Session Duration', 
        'Pages per Session',
        'Sessions per User',
        'Traffic Channels',
        'Device Distribution'
      ];
      
      const summary = result.success 
        ? `✅ Successfully synced ${result.periodsProcessed} periods: ${result.dailyDataPeriods.length} with daily data, ${result.monthlyDataPeriods.length} with monthly data`
        : `❌ Sync failed: ${result.errors.join(', ')}`;
      
      logger.info(`🚀 COMPLETE GA4 DATA SYNC FINISHED for client ${clientId}: ${summary}`);
      
      return {
        success: result.success,
        summary,
        periodsProcessed: result.periodsProcessed,
        dailyDataPeriods: result.dailyDataPeriods,
        monthlyDataPeriods: result.monthlyDataPeriods,
        errors: result.errors,
        chartsRefreshed: result.success ? chartsRefreshed : []
      };
      
    } catch (error) {
      const errorMessage = `Complete GA4 data sync failed: ${error}`;
      logger.error(`❌ ${errorMessage} for client ${clientId}`);
      
      return {
        success: false,
        summary: `❌ ${errorMessage}`,
        periodsProcessed: 0,
        dailyDataPeriods: [],
        monthlyDataPeriods: [],
        errors: [errorMessage],
        chartsRefreshed: []
      };
    }
  }

  /**
   * Smart 15-month data fetching with intelligent optimization
   */
  async smartFetch(options: SmartFetchOptions): Promise<FetchResult> {
    const { clientId, periods = DATA_MANAGEMENT.DEFAULT_PERIODS, forceRefresh = false } = options;
    
    const result: FetchResult = {
      success: true,
      periodsProcessed: 0,
      dailyDataPeriods: [],
      monthlyDataPeriods: [],
      errors: []
    };

    try {
      logger.info(`Starting smart ${periods}-month data fetch for client ${clientId}`);

      // Generate period list
      const periodList = this.generatePeriods(periods);
      
      // Check existing data status
      const existingDataStatus = await this.storageService.checkExistingData(clientId, periodList);

      // Process each period intelligently
      for (const period of periodList) {
        try {
          const processed = await this.processPeriodIntelligently(
            clientId, 
            period, 
            existingDataStatus,
            forceRefresh
          );

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
        } catch (error) {
          result.errors.push(`Error processing ${period.period}: ${error}`);
        }
      }

      logger.info(`Smart fetch completed: ${result.periodsProcessed}/${periodList.length} periods processed`);

    } catch (error) {
      logger.error('Smart fetch failed:', error);
      result.success = false;
      result.errors.push(`Overall fetch failed: ${error}`);
    }

    return result;
  }

  /**
   * Refresh data for current period
   */
  async refreshCurrentPeriod(clientId: string): Promise<boolean> {
    try {
      const currentDate = new Date();
      const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const dateRange = this.getDateRangeForPeriod(period);

      logger.info(`Refreshing current period data for client ${clientId}, period ${period}`);

      // Clear existing data
      await this.storageService.clearClientDataForPeriod(clientId, period);

      // Fetch fresh data
      const freshData = await this.fetchPeriodData(clientId, dateRange.startDate, dateRange.endDate, period);

      if (!freshData) {
        logger.error(`Failed to refresh data for client ${clientId}, period ${period}`);
        return false;
      }

      logger.info(`Successfully refreshed data for client ${clientId}, period ${period}`);
      return true;

    } catch (error) {
      logger.error(`Error refreshing current period for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Validate client GA4 access
   */
  async validateClientAccess(clientId: string): Promise<boolean> {
    try {
      const propertyAccess = await this.authService.getPropertyAccess(clientId);
      if (!propertyAccess) {
        return false;
      }

      return await this.apiService.validatePropertyAccess(propertyAccess);
    } catch (error) {
      logger.error(`Error validating client access for ${clientId}:`, error);
      return false;
    }
  }



  /**
   * Generate period list for smart fetching
   */
  private generatePeriods(count: number): DataPeriod[] {
    const periods: DataPeriod[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${String(month).padStart(2, '0')}`;
      
      // Recent 1 month gets daily data, older periods get monthly summaries
      const type = i < DATA_MANAGEMENT.DAILY_DATA_THRESHOLD_MONTHS ? 'daily' : 'monthly';
      
      const dateRange = this.getDateRangeForPeriod(period);
      
      periods.push({
        year,
        month,
        period,
        type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
    }
    
    return periods;
  }

  /**
   * Process a period intelligently based on existing data
   */
  private async processPeriodIntelligently(
    clientId: string,
    period: DataPeriod,
    existingDataStatus: Map<string, ExistingDataStatus[]>,
    forceRefresh: boolean
  ): Promise<{ success: boolean; dataType: 'daily' | 'monthly'; error?: string }> {
    
    const periodStatus = existingDataStatus.get(period.period) || [];
    
    // Determine if we need to fetch data
    const needsData = this.determineDataNeeds(period, periodStatus, forceRefresh);
    
    if (!needsData.fetch) {
      logger.debug(`Skipping ${period.period}: ${needsData.reason}`);
      return { success: true, dataType: needsData.existingType! };
    }

    // Handle data optimization: replace daily with monthly for older periods
    if (needsData.replaceDaily) {
      const monthlyData = await this.fetchPeriodData(
        clientId, 
        period.startDate, 
        period.endDate, 
        period.period
      );
      
      if (monthlyData) {
        await this.storageService.replaceDailyWithMonthly(clientId, period, monthlyData);
        return { success: true, dataType: 'monthly' };
      }
    }

    // Fetch new data based on period requirements
    if (period.type === 'daily') {
      const dailyData = await this.fetchDailyData(clientId, period.startDate, period.endDate, period.period);
      return { 
        success: !!dailyData, 
        dataType: 'daily', 
        error: dailyData ? undefined : 'Failed to fetch daily data' 
      };
    } else {
      const monthlyData = await this.fetchPeriodData(clientId, period.startDate, period.endDate, period.period);
      return { 
        success: !!monthlyData, 
        dataType: 'monthly', 
        error: monthlyData ? undefined : 'Failed to fetch monthly data' 
      };
    }
  }

  /**
   * Determine if period needs data fetching
   */
  private determineDataNeeds(
    period: DataPeriod, 
    periodStatus: ExistingDataStatus[], 
    forceRefresh: boolean
  ): { 
    fetch: boolean; 
    reason: string; 
    existingType?: 'daily' | 'monthly'; 
    replaceDaily?: boolean 
  } {
    
    if (forceRefresh) {
      return { fetch: true, reason: 'Force refresh requested' };
    }

    const hasDaily = periodStatus.some(s => s.dataType === 'daily');
    const hasMonthly = periodStatus.some(s => s.dataType === 'monthly');

    // If we have data and it matches the required type, skip
    if (period.type === 'daily' && hasDaily) {
      return { fetch: false, reason: 'Daily data already exists', existingType: 'daily' };
    }
    
    if (period.type === 'monthly' && hasMonthly) {
      return { fetch: false, reason: 'Monthly data already exists', existingType: 'monthly' };
    }

    // If we need monthly but have daily, replace with monthly summary
    if (period.type === 'monthly' && hasDaily) {
      return { 
        fetch: true, 
        reason: 'Replacing daily with monthly summary', 
        replaceDaily: true 
      };
    }

    // If we need daily but have monthly, fetch daily (upgrade)
    if (period.type === 'daily' && hasMonthly) {
      return { fetch: true, reason: 'Upgrading from monthly to daily data' };
    }

    // No data exists, fetch as required
    return { fetch: true, reason: 'No existing data found' };
  }

  /**
   * Get date range for a period (YYYY-MM format)
   */
  private getDateRangeForPeriod(period: string): { startDate: string; endDate: string } {
    const [year, month] = period.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
}