import logger from '../../utils/logging/logger';
import { semrushService } from './semrushService';
import { semrushDataProcessor } from './dataProcessor';
import { BenchmarkSyncManager } from '../BenchmarkSyncManager';
import { sseEventEmitter } from '../sse/sseEventEmitter';
import type { IStorage } from '../../storage';
import type { BenchmarkCompany, UpdateBenchmarkCompany } from '@shared/schema';

export interface BenchmarkIntegrationResult {
  success: boolean;
  companyId: string;
  periodsProcessed: number;
  metricsStored: number;
  trafficChannelsStored: number;
  deviceDistributionStored: number;
  averagesUpdated: boolean;
  error?: string;
  syncJobId?: string;
}

export interface BenchmarkSyncOptions {
  incrementalSync?: boolean;
  syncJobId?: string;
  emitProgressEvents?: boolean;
}

export class BenchmarkIntegration {
  private syncManager: BenchmarkSyncManager;

  constructor(private storage: IStorage) {
    this.syncManager = new BenchmarkSyncManager(storage);
  }

  /**
   * Complete integration process for a new Benchmark company with state tracking
   */
  public async processNewBenchmarkCompany(
    company: BenchmarkCompany, 
    options: BenchmarkSyncOptions = {}
  ): Promise<BenchmarkIntegrationResult> {
    const { incrementalSync = false, syncJobId, emitProgressEvents = true } = options;

    logger.info('Starting SEMrush integration for benchmark company', { 
      companyId: company.id,
      companyName: company.name,
      websiteUrl: company.websiteUrl,
      incrementalSync,
      syncJobId: syncJobId || 'standalone'
    });

    const result: BenchmarkIntegrationResult = {
      success: false,
      companyId: company.id,
      periodsProcessed: 0,
      metricsStored: 0,
      trafficChannelsStored: 0,
      deviceDistributionStored: 0,
      averagesUpdated: false,
      syncJobId
    };

    try {
      // Step 0: Update company sync status to processing
      await this.updateCompanySyncStatus(company.id, 'processing', emitProgressEvents);

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncProgress({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          stage: 'extracting_domain',
          message: `Extracting domain from ${company.websiteUrl}`,
          progress: 10
        });
      }

      // Step 1: Extract domain from website URL
      const domain = this.extractDomain(company.websiteUrl);
      logger.info('Extracted domain from URL', { companyId: company.id, domain, originalUrl: company.websiteUrl });

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncProgress({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          stage: 'fetching_data',
          message: `Fetching SEMrush data for ${domain}${incrementalSync ? ' (incremental)' : ''}`,
          progress: 20
        });
      }

      // Step 2: Fetch historical data from SEMrush (with optimizations)
      const historicalData = incrementalSync 
        ? await semrushService.fetchHistoricalDataOptimized(domain, true, company.id)
        : await semrushService.fetchHistoricalDataOptimized(domain, false);
      
      result.periodsProcessed = historicalData.size;

      if (historicalData.size === 0) {
        if (incrementalSync) {
          logger.info('No missing data found for company, sync completed', { companyId: company.id });
          result.success = true;
          await this.updateCompanySyncStatus(company.id, 'completed', emitProgressEvents);
          
          if (emitProgressEvents) {
            sseEventEmitter.emitBenchmarkSyncCompleted({
              jobId: syncJobId,
              companyId: company.id,
              companyName: company.name,
              status: 'completed',
              success: true,
              message: 'No missing data - already up to date'
            });
          }
          
          return result;
        } else {
          throw new Error('No historical data retrieved from SEMrush');
        }
      }

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncProgress({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          stage: 'processing_data',
          message: `Processing ${historicalData.size} periods of SEMrush data`,
          progress: 50
        });
      }

      // Step 3: Process and convert SEMrush data to our schema
      const processedData = semrushDataProcessor.processBenchmarkCompanyData(company.id, historicalData);

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncProgress({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          stage: 'storing_metrics',
          message: `Storing ${processedData.metrics.length} metrics in database`,
          progress: 70
        });
      }

      // Step 4: Store the company's metrics in database
      await this.storeCompanyMetrics(company.id, processedData);
      result.metricsStored = processedData.metrics.length;
      result.trafficChannelsStored = processedData.trafficChannelMetrics.length;
      result.deviceDistributionStored = processedData.deviceDistributionMetrics.length;

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncProgress({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          stage: 'updating_averages',
          message: 'Updating industry averages',
          progress: 90
        });
      }

      // Step 5: Skip industry averages update during individual company processing
      // (Industry averages will be updated once at the end of bulk sync)
      result.averagesUpdated = false;

      // Step 6: Update company sync status based on whether we stored any data
      const hasValidData = result.metricsStored > 0 || result.trafficChannelsStored > 0 || result.deviceDistributionStored > 0;
      const finalStatus = hasValidData ? 'completed' : 'failed';
      
      await this.updateCompanySyncStatus(company.id, finalStatus, emitProgressEvents);

      result.success = hasValidData;
      
      logger.info('Successfully completed SEMrush integration', {
        companyId: company.id,
        companyName: company.name,
        periodsProcessed: result.periodsProcessed,
        metricsStored: result.metricsStored,
        trafficChannelsStored: result.trafficChannelsStored,
        deviceDistributionStored: result.deviceDistributionStored,
        incrementalSync
      });

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncCompleted({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          success: result.success,
          status: finalStatus, // Include the actual status (verified/failed)
          message: result.success 
            ? `Successfully synced ${result.periodsProcessed} periods with ${result.metricsStored} metrics`
            : `No valid data found after processing ${result.periodsProcessed} periods`
        });
      }

    } catch (error) {
      result.error = (error as Error).message;
      logger.error('Failed to process SEMrush integration', {
        companyId: company.id,
        companyName: company.name,
        error: result.error,
        stack: (error as Error).stack,
        incrementalSync
      });

      // Update company sync status to error
      await this.updateCompanySyncStatus(company.id, 'failed', emitProgressEvents);

      if (emitProgressEvents) {
        sseEventEmitter.emitBenchmarkSyncError({
          jobId: syncJobId,
          companyId: company.id,
          companyName: company.name,
          error: result.error || 'Unknown error occurred during sync'
        });
      }
    }

    return result;
  }

  /**
   * Process multiple benchmark companies with state tracking
   */
  public async processBenchmarkCompanies(
    companies: BenchmarkCompany[],
    options: { incrementalSync?: boolean; jobType?: 'individual' | 'bulk' | 'incremental' } = {}
  ): Promise<{ jobId: string; results: BenchmarkIntegrationResult[] }> {
    const { incrementalSync = false, jobType = 'bulk' } = options;

    // Create sync job
    const jobId = await this.syncManager.createSyncJob({
      jobType,
      companyIds: companies.map(c => c.id),
      incrementalSync
    });

    logger.info('Started bulk benchmark sync job', { 
      jobId, 
      companies: companies.length, 
      incrementalSync,
      jobType 
    });

    const results: BenchmarkIntegrationResult[] = [];

    try {
      await this.syncManager.updateSyncProgress(jobId, { 
        processedCompanies: 0,
        phase: 'syncing',
        message: 'Starting bulk sync' 
      });

      // Process companies sequentially to respect rate limits
      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        
        // Update job progress
        await this.syncManager.updateSyncProgress(jobId, {
          processedCompanies: i,
          currentCompanyId: company.id,
          currentCompanyName: company.name,
          phase: 'syncing',
          message: `Processing ${company.name} (${i + 1}/${companies.length})`
        });

        // Process individual company
        const companyResult = await this.processNewBenchmarkCompany(company, {
          incrementalSync,
          syncJobId: jobId,
          emitProgressEvents: true
        });

        results.push(companyResult);

        // Update job with company completion
        await this.syncManager.updateSyncProgress(jobId, {
          processedCompanies: i + 1,
          currentCompanyId: undefined,
          currentCompanyName: undefined,
          phase: 'syncing',
          message: `Completed ${company.name} (${i + 1}/${companies.length})`
        });

        logger.info('Completed company in bulk job', { 
          jobId, 
          companyId: company.id,
          success: companyResult.success,
          progress: `${i + 1}/${companies.length}`
        });
      }

      // Complete the job
      await this.syncManager.completeSyncJob(jobId);

      logger.info('Completed bulk benchmark sync job', { 
        jobId, 
        totalCompanies: companies.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      await this.syncManager.failSyncJob(jobId, (error as Error).message);
      logger.error('Bulk benchmark sync job failed', { jobId, error: (error as Error).message });
      throw error;
    }

    return { jobId, results };
  }

  /**
   * Update benchmark company sync status
   */
  private async updateCompanySyncStatus(
    companyId: string, 
    status: "pending" | "processing" | "completed" | "failed", 
    emitEvents: boolean = true
  ): Promise<void> {
    try {
      const updates: UpdateBenchmarkCompany = {
        syncStatus: status,
        lastSyncAttempt: new Date()
      };

      if (status === 'completed') {
        updates.lastSyncCompleted = new Date();
      }

      await this.storage.updateBenchmarkCompany(companyId, updates);
      
      // Emit company status update via SSE if events are enabled
      if (emitEvents) {
        sseEventEmitter.emitCompanyStatus({
          companyId,
          syncStatus: status as "pending" | "processing" | "completed" | "failed",
          message: `Company sync status updated to ${status}`
        });
      }
      
      logger.debug('Updated benchmark company sync status', { companyId, status });
    } catch (error) {
      logger.error('Failed to update benchmark company sync status', {
        companyId,
        status,
        error: (error as Error).message
      });
    }
  }

  /**
   * Extract domain from website URL
   */
  private extractDomain(websiteUrl: string): string {
    try {
      // Remove protocol if present
      let domain = websiteUrl.replace(/^https?:\/\//, '');
      
      // Remove www. if present
      domain = domain.replace(/^www\./, '');
      
      // Remove path and query parameters
      domain = domain.split('/')[0].split('?')[0];
      
      // Remove port if present
      domain = domain.split(':')[0];
      
      return domain.toLowerCase().trim();
    } catch (error) {
      logger.error('Failed to extract domain from URL', { websiteUrl, error: (error as Error).message });
      throw new Error(`Invalid website URL: ${websiteUrl}`);
    }
  }

  /**
   * Store company metrics in database
   */
  private async storeCompanyMetrics(companyId: string, processedData: any): Promise<void> {
    logger.info('Storing SEMrush metrics in database', { 
      companyId,
      mainMetrics: processedData.metrics.length,
      trafficChannels: processedData.trafficChannelMetrics.length,
      deviceDistribution: processedData.deviceDistributionMetrics.length
    });

    // Store main metrics
    for (const metric of processedData.metrics) {
      await this.storage.createMetric(metric);
    }

    // Store traffic channel metrics
    for (const metric of processedData.trafficChannelMetrics) {
      await this.storage.createMetric(metric);
    }

    // Store device distribution metrics
    for (const metric of processedData.deviceDistributionMetrics) {
      await this.storage.createMetric(metric);
    }

    logger.info('Successfully stored all SEMrush metrics', { companyId });
  }

  /**
   * Recalculate and update Industry averages across all benchmark companies
   * Made public to support benchmark company deletion operations
   */
  public async updateIndustryAverages(): Promise<void> {
    logger.info('Updating Industry averages from benchmark companies');

    try {
      // Step 1: Get all Benchmark companies
      const benchmarkCompanies = await this.storage.getBenchmarkCompanies();
      
      if (benchmarkCompanies.length === 0) {
        logger.warn('No Benchmark companies found for average calculation');
        return;
      }

      // Step 2: Delete existing Industry_Avg metrics to recalculate fresh
      await this.clearExistingAverages();

      // Step 3: Get all company metrics grouped by company
      const allCompanyMetrics = new Map();
      
      for (const company of benchmarkCompanies) {
        const companyMetrics = await this.getCompanyMetrics(company.id);
        if (companyMetrics.metrics.length > 0) {
          allCompanyMetrics.set(company.id, companyMetrics);
        }
      }

      if (allCompanyMetrics.size === 0) {
        logger.warn('No company metrics found for average calculation');
        return;
      }

      // Step 4: Generate historical periods for averages
      const periods = this.generateHistoricalPeriods();
      logger.info('Generated historical periods for industry averages', { 
        periods: periods.slice(0, 3).concat(['...', periods[periods.length-1]]), 
        totalPeriods: periods.length 
      });

      // Step 5: Calculate new averages with error handling (using calculateIndustryAverages)
      const averageMetrics = semrushDataProcessor.calculateIndustryAverages(allCompanyMetrics, periods);
      
      if (!averageMetrics || averageMetrics.metrics.length === 0) {
        logger.error('No industry averages calculated - check company data quality');
        throw new Error('Failed to calculate industry averages from company data');
      }

      // Step 6: Store new averages with validation
      await this.storeIndustryAverages(averageMetrics);

      logger.info('Successfully updated Industry averages', {
        companiesIncluded: allCompanyMetrics.size,
        periodsProcessed: periods.length,
        avgMetricsStored: averageMetrics.metrics.length,
        avgTrafficChannelsStored: averageMetrics.trafficChannelMetrics.length,
        avgDeviceDistributionStored: averageMetrics.deviceDistributionMetrics.length
      });

    } catch (error) {
      logger.error('Failed to update Industry averages', { 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Clear existing Industry_Avg metrics
   */
  private async clearExistingAverages(): Promise<void> {
    logger.info('Clearing existing Industry_Avg metrics');
    await this.storage.deleteMetricsBySourceType('Industry_Avg');
  }

  /**
   * Get all metrics for a specific company
   */
  private async getCompanyMetrics(companyId: string): Promise<any> {
    logger.info('Getting benchmark company metrics', { companyId });
    
    // Get only metrics for this specific company
    const allMetrics = await this.storage.getMetricsByCompanyId(companyId);
    
    // Group metrics by type
    const metrics = allMetrics.filter(m => 
      ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'].includes(m.metricName)
    );
    
    const trafficChannelMetrics = allMetrics.filter(m => m.metricName === 'Traffic Channels');
    const deviceDistributionMetrics = allMetrics.filter(m => m.metricName === 'Device Distribution');
    
    return {
      metrics,
      trafficChannelMetrics,
      deviceDistributionMetrics
    };
  }

  /**
   * Store industry average metrics with robust error handling
   */
  private async storeIndustryAverages(averageMetrics: any): Promise<void> {
    logger.info('Storing industry average metrics', {
      mainMetrics: averageMetrics.metrics?.length || 0,
      trafficChannels: averageMetrics.trafficChannelMetrics?.length || 0,
      deviceDistribution: averageMetrics.deviceDistributionMetrics?.length || 0
    });

    let storedCount = 0;

    // Store average main metrics with error handling
    if (averageMetrics.metrics && averageMetrics.metrics.length > 0) {
      for (const metric of averageMetrics.metrics) {
        try {
          await this.storage.createMetric(metric);
          storedCount++;
        } catch (error) {
          logger.error('Failed to store industry average metric', { 
            metric: metric.metricName, 
            period: metric.timePeriod,
            error: (error as Error).message 
          });
          throw error;
        }
      }
    }

    // Store average traffic channel metrics
    if (averageMetrics.trafficChannelMetrics && averageMetrics.trafficChannelMetrics.length > 0) {
      for (const metric of averageMetrics.trafficChannelMetrics) {
        try {
          await this.storage.createMetric(metric);
          storedCount++;
        } catch (error) {
          logger.error('Failed to store traffic channel average', { 
            channel: metric.channel,
            period: metric.timePeriod,
            error: (error as Error).message 
          });
        }
      }
    }

    // Store average device distribution metrics
    if (averageMetrics.deviceDistributionMetrics && averageMetrics.deviceDistributionMetrics.length > 0) {
      for (const metric of averageMetrics.deviceDistributionMetrics) {
        try {
          await this.storage.createMetric(metric);
          storedCount++;
        } catch (error) {
          logger.error('Failed to store device distribution average', { 
            device: metric.channel,
            period: metric.timePeriod,
            error: (error as Error).message 
          });
        }
      }
    }

    if (storedCount === 0) {
      throw new Error('No industry averages were successfully stored');
    }

    logger.info('Successfully stored industry averages', { totalStored: storedCount });
  }

  /**
   * Generate 15 months of historical periods INCLUDING current month
   */
  private generateHistoricalPeriods(): string[] {
    const periods: string[] = [];
    const now = new Date();
    
    // Start from CURRENT month to include current data
    let currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    for (let i = 0; i < 15; i++) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      periods.push(`${year}-${month}`);
      currentDate.setMonth(currentDate.getMonth() - 1);
    }
    
    return periods.reverse();
  }

  /**
   * Test SEMrush API connectivity
   */
  public async testSemrushConnection(): Promise<boolean> {
    try {
      return await semrushService.testConnection();
    } catch (error) {
      logger.error('SEMrush connection test failed', { error: (error as Error).message });
      return false;
    }
  }
}
