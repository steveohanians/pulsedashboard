import logger from '../../utils/logging/logger.js';
import { semrushService } from './semrushService.js';
import { semrushDataProcessor } from './dataProcessor.js';
import type { IStorage } from '../../storage.js';
import type { Competitor } from '@shared/schema.js';

export interface CompetitorIntegrationResult {
  success: boolean;
  competitorId: string;
  periodsProcessed: number;
  metricsStored: number;
  trafficChannelsStored: number;
  deviceDistributionStored: number;
  error?: string;
}

export class CompetitorIntegration {
  constructor(private storage: IStorage) {}

  /**
   * Complete integration process for a new competitor
   */
  public async processNewCompetitor(competitor: Competitor): Promise<CompetitorIntegrationResult> {
    logger.info('Starting SEMrush integration for new competitor', { 
      competitorId: competitor.id,
      competitorLabel: competitor.label,
      domain: competitor.domain
    });

    const result: CompetitorIntegrationResult = {
      success: false,
      competitorId: competitor.id,
      periodsProcessed: 0,
      metricsStored: 0,
      trafficChannelsStored: 0,
      deviceDistributionStored: 0
    };

    try {
      // Step 1: Extract domain from competitor URL
      const domain = this.extractDomain(competitor.domain);
      logger.info('Extracted domain from competitor URL', { 
        competitorId: competitor.id, 
        domain, 
        originalUrl: competitor.domain 
      });

      // Step 2: Fetch 15 months of historical data from SEMrush
      const historicalData = await semrushService.fetchHistoricalData(domain);
      result.periodsProcessed = historicalData.size;

      if (historicalData.size === 0) {
        throw new Error('No historical data retrieved from SEMrush');
      }

      // Step 3: Process and convert SEMrush data to our schema for competitors
      const processedData = semrushDataProcessor.processCompetitorData(competitor.id, historicalData);

      // Step 4: Store the competitor's metrics in database
      await this.storeCompetitorMetrics(competitor.id, processedData);
      result.metricsStored = processedData.metrics.length;
      result.trafficChannelsStored = processedData.trafficChannelMetrics.length;
      result.deviceDistributionStored = processedData.deviceDistributionMetrics.length;

      result.success = true;
      
      logger.info('Successfully completed SEMrush integration for competitor', {
        competitorId: competitor.id,
        competitorLabel: competitor.label,
        periodsProcessed: result.periodsProcessed,
        metricsStored: result.metricsStored,
        trafficChannelsStored: result.trafficChannelsStored,
        deviceDistributionStored: result.deviceDistributionStored
      });

    } catch (error) {
      result.error = (error as Error).message;
      logger.error('Failed to process SEMrush integration for competitor', {
        competitorId: competitor.id,
        competitorLabel: competitor.label,
        error: result.error,
        stack: (error as Error).stack
      });
      
      // Re-throw the error so competitor creation fails completely
      throw error;
    }

    return result;
  }

  /**
   * Extract domain from URL for SEMrush API calls
   */
  private extractDomain(url: string): string {
    try {
      // Remove protocol if present
      let domain = url.replace(/^https?:\/\//, '');
      
      // Remove www. if present
      domain = domain.replace(/^www\./, '');
      
      // Remove trailing path
      domain = domain.split('/')[0];
      
      logger.info('Domain extraction successful', { original: url, extracted: domain });
      return domain;
    } catch (error) {
      logger.error('Domain extraction failed', { url, error: (error as Error).message });
      throw new Error(`Failed to extract domain from URL: ${url}`);
    }
  }

  /**
   * Store competitor metrics in database
   */
  private async storeCompetitorMetrics(competitorId: string, processedData: any): Promise<void> {
    logger.info('Storing SEMrush competitor metrics in database', { 
      competitorId,
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

    logger.info('Successfully stored all SEMrush competitor metrics', { competitorId });
  }
}

// Note: CompetitorIntegration instances are created with storage injection in routes.ts
// This allows proper dependency injection while maintaining singleton pattern per route setup