import logger from '../../utils/logging/logger';
import { semrushService } from './semrushService.js';
import { semrushDataProcessor } from './dataProcessor.js';
import type { IStorage } from '../../storage.js';
import type { BenchmarkCompany } from '@shared/schema.js';

export interface BenchmarkIntegrationResult {
  success: boolean;
  companyId: string;
  periodsProcessed: number;
  metricsStored: number;
  trafficChannelsStored: number;
  deviceDistributionStored: number;
  averagesUpdated: boolean;
  error?: string;
}

export class BenchmarkIntegration {
  constructor(private storage: IStorage) {}

  /**
   * Complete integration process for a new Benchmark company
   */
  public async processNewBenchmarkCompany(company: BenchmarkCompany): Promise<BenchmarkIntegrationResult> {
    logger.info('Starting SEMrush integration for new benchmark company', { 
      companyId: company.id,
      companyName: company.name,
      websiteUrl: company.websiteUrl
    });

    const result: BenchmarkIntegrationResult = {
      success: false,
      companyId: company.id,
      periodsProcessed: 0,
      metricsStored: 0,
      trafficChannelsStored: 0,
      deviceDistributionStored: 0,
      averagesUpdated: false
    };

    try {
      // Step 1: Extract domain from website URL
      const domain = this.extractDomain(company.websiteUrl);
      logger.info('Extracted domain from URL', { companyId: company.id, domain, originalUrl: company.websiteUrl });

      // Step 2: Fetch 15 months of historical data from SEMrush
      const historicalData = await semrushService.fetchHistoricalData(domain);
      result.periodsProcessed = historicalData.size;

      if (historicalData.size === 0) {
        throw new Error('No historical data retrieved from SEMrush');
      }

      // Step 3: Process and convert SEMrush data to our schema (using Benchmark instead of CD_Portfolio)
      const processedData = semrushDataProcessor.processBenchmarkCompanyData(company.id, historicalData);

      // Step 4: Store the company's metrics in database
      await this.storeCompanyMetrics(company.id, processedData);
      result.metricsStored = processedData.metrics.length;
      result.trafficChannelsStored = processedData.trafficChannelMetrics.length;
      result.deviceDistributionStored = processedData.deviceDistributionMetrics.length;

      // Step 5: Recalculate and update Industry averages
      await this.updateIndustryAverages();
      result.averagesUpdated = true;

      result.success = true;
      
      logger.info('Successfully completed SEMrush integration', {
        companyId: company.id,
        companyName: company.name,
        periodsProcessed: result.periodsProcessed,
        metricsStored: result.metricsStored,
        trafficChannelsStored: result.trafficChannelsStored,
        deviceDistributionStored: result.deviceDistributionStored
      });

    } catch (error) {
      result.error = (error as Error).message;
      logger.error('Failed to process SEMrush integration', {
        companyId: company.id,
        companyName: company.name,
        error: result.error,
        stack: (error as Error).stack
      });
    }

    return result;
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
