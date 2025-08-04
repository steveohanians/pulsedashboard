/**
 * Sample Data Manager
 * 
 * Main orchestrator for safe sample data generation that never overwrites GA4 data.
 */

import { storage } from '../../storage';
import logger from '../../utils/logger';
import { SampleDataValidator } from './SampleDataValidator';
import { SampleDataGenerator } from './SampleDataGenerator';
import { SAMPLE_DATA_CONFIG, METRIC_NAMES } from './constants';
import type { 
  SampleDataOptions, 
  GenerationResult, 
  TrendVariation,
  CompetitorConfig 
} from './types';

export class SampleDataManager {
  private validator: SampleDataValidator;

  constructor() {
    this.validator = new SampleDataValidator();
  }

  /**
   * Generate sample data for a client with comprehensive safety checks
   */
  async generateSampleData(options: SampleDataOptions): Promise<GenerationResult> {
    const { clientId, periods = SAMPLE_DATA_CONFIG.DEFAULT_PERIODS, forceGeneration = false, skipGA4Check = false } = options;
    
    const result: GenerationResult = {
      success: false,
      clientId,
      periodsGenerated: 0,
      metricsCreated: 0,
      competitorsGenerated: 0,
      errors: [],
      warnings: [],
      safetyChecks: {
        hasGA4Access: false,
        hasExistingGA4Data: false,
        hasGA4PropertyConfigured: false,
        isSafeForSampleData: false,
        reason: ''
      }
    };

    try {
      logger.info(`Starting sample data generation for client: ${clientId}`);

      // Validate client exists
      const clientExists = await this.validator.validateClientExists(clientId);
      if (!clientExists) {
        result.errors.push(`Client ${clientId} does not exist`);
        return result;
      }

      // Perform comprehensive safety checks
      const safetyCheck = await this.validator.validateClientSafety(clientId, skipGA4Check);
      result.safetyChecks = safetyCheck;

      if (!safetyCheck.isSafeForSampleData && !forceGeneration) {
        result.errors.push(`Sample data generation blocked: ${safetyCheck.reason}`);
        return result;
      }

      if (!safetyCheck.isSafeForSampleData && forceGeneration) {
        result.warnings.push(`Force generation enabled - bypassing safety checks: ${safetyCheck.reason}`);
      }

      // Generate period list
      const periodList = this.generatePeriodList(periods);

      // Validate no existing data conflicts
      if (!forceGeneration) {
        const isDataSafe = await this.validator.validateGeneratedData(clientId, periodList.map(p => p.period));
        if (!isDataSafe) {
          result.errors.push('Existing data found for some periods - generation blocked to prevent conflicts');
          return result;
        }
      }

      // Initialize data generator
      const generator = new SampleDataGenerator(clientId);
      
      // Generate competitor configuration
      const competitorConfig = generator.generateCompetitorConfig();
      
      // Generate client trend pattern
      const clientTrend: TrendVariation = { type: 'improving', magnitude: 0.15 };

      // Generate data for each period
      for (let i = 0; i < periodList.length; i++) {
        const period = periodList[i];
        
        try {
          // Generate client metrics
          const clientMetrics = generator.generatePeriodMetrics(i, clientTrend);
          await this.storeClientMetrics(clientId, period.period, clientMetrics);
          
          // Generate traffic channels
          const trafficChannels = generator.generateTrafficChannels(i);
          await this.storeTrafficChannels(clientId, period.period, trafficChannels);
          
          // Generate device distribution
          const deviceDistribution = generator.generateDeviceDistribution(i);
          await this.storeDeviceDistribution(clientId, period.period, deviceDistribution);
          
          result.metricsCreated += 6; // 4 main metrics + traffic + device
          result.periodsGenerated++;

          logger.debug(`Generated sample data for period ${period.period}`);

        } catch (error) {
          const errorMsg = `Failed to generate data for period ${period.period}: ${error}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Generate competitor data
      if (result.periodsGenerated > 0) {
        const competitorsGenerated = await this.generateCompetitorData(
          clientId, 
          periodList, 
          competitorConfig, 
          generator
        );
        result.competitorsGenerated = competitorsGenerated;
      }

      result.success = result.periodsGenerated > 0;
      
      logger.info(`Sample data generation completed for ${clientId}:`, {
        periodsGenerated: result.periodsGenerated,
        metricsCreated: result.metricsCreated,
        competitorsGenerated: result.competitorsGenerated,
        errors: result.errors.length,
        warnings: result.warnings.length
      });

    } catch (error) {
      const errorMsg = `Sample data generation failed for ${clientId}: ${error}`;
      result.errors.push(errorMsg);
      logger.error(errorMsg);
    }

    return result;
  }

  /**
   * Check if it's safe to generate sample data for a client
   */
  async checkGenerationSafety(clientId: string): Promise<GenerationResult['safetyChecks']> {
    return await this.validator.validateClientSafety(clientId);
  }

  /**
   * Generate competitor data for all periods
   */
  private async generateCompetitorData(
    clientId: string,
    periodList: Array<{ period: string; type: 'daily' | 'monthly' }>,
    competitorConfig: CompetitorConfig,
    generator: SampleDataGenerator
  ): Promise<number> {
    let competitorsGenerated = 0;

    for (let compIndex = 0; compIndex < competitorConfig.count; compIndex++) {
      const competitorDomain = competitorConfig.domains[compIndex];
      
      try {
        // Create competitor entry
        await storage.createCompetitor({
          clientId,
          domain: competitorDomain,
          isActive: true
        });

        // Generate metrics for each period
        for (let periodIndex = 0; periodIndex < periodList.length; periodIndex++) {
          const period = periodList[periodIndex];
          
          // Get client baseline for this period
          const clientMetrics = await storage.getClientMetricsByPeriod(clientId, period.period);
          const clientBaseline = this.extractClientBaseline(clientMetrics);
          
          if (clientBaseline) {
            const competitorMetrics = generator.generateCompetitorMetrics(
              clientBaseline, 
              compIndex, 
              periodIndex
            );
            
            await this.storeCompetitorMetrics(competitorDomain, period.period, competitorMetrics);
          }
        }

        competitorsGenerated++;
        logger.debug(`Generated competitor data for ${competitorDomain}`);

      } catch (error) {
        logger.error(`Failed to generate competitor ${competitorDomain}:`, error);
      }
    }

    return competitorsGenerated;
  }

  /**
   * Store client metrics
   */
  private async storeClientMetrics(clientId: string, period: string, metrics: any): Promise<void> {
    const metricsToStore = [
      { name: METRIC_NAMES.BOUNCE_RATE, value: metrics.bounceRate.toFixed(2) },
      { name: METRIC_NAMES.SESSION_DURATION, value: metrics.sessionDuration.toFixed(2) },
      { name: METRIC_NAMES.PAGES_PER_SESSION, value: metrics.pagesPerSession.toFixed(2) },
      { name: METRIC_NAMES.SESSIONS_PER_USER, value: metrics.sessionsPerUser.toFixed(2) }
    ];

    for (const metric of metricsToStore) {
      await storage.createMetric({
        clientId,
        metricName: metric.name,
        value: metric.value,
        sourceType: 'Client',
        timePeriod: period
      });
    }
  }

  /**
   * Store traffic channels data
   */
  private async storeTrafficChannels(clientId: string, period: string, channels: any): Promise<void> {
    await storage.createMetric({
      clientId,
      metricName: METRIC_NAMES.TRAFFIC_CHANNELS,
      value: JSON.stringify(channels),
      sourceType: 'Client',
      timePeriod: period
    });
  }

  /**
   * Store device distribution data
   */
  private async storeDeviceDistribution(clientId: string, period: string, devices: any): Promise<void> {
    await storage.createMetric({
      clientId,
      metricName: METRIC_NAMES.DEVICE_DISTRIBUTION,
      value: JSON.stringify(devices),
      sourceType: 'Client',
      timePeriod: period
    });
  }

  /**
   * Store competitor metrics
   */
  private async storeCompetitorMetrics(domain: string, period: string, metrics: any): Promise<void> {
    const metricsToStore = [
      { name: METRIC_NAMES.BOUNCE_RATE, value: metrics.bounceRate.toFixed(2) },
      { name: METRIC_NAMES.SESSION_DURATION, value: metrics.sessionDuration.toFixed(2) },
      { name: METRIC_NAMES.PAGES_PER_SESSION, value: metrics.pagesPerSession.toFixed(2) },
      { name: METRIC_NAMES.SESSIONS_PER_USER, value: metrics.sessionsPerUser.toFixed(2) }
    ];

    for (const metric of metricsToStore) {
      await storage.createMetric({
        clientId: domain, // Use domain as clientId for competitors
        metricName: metric.name,
        value: metric.value,
        sourceType: 'Competitor',
        timePeriod: period
      });
    }
  }

  /**
   * Extract client baseline metrics from stored data
   */
  private extractClientBaseline(clientMetrics: any[]): any | null {
    if (!clientMetrics || clientMetrics.length === 0) return null;

    const metricMap = new Map();
    clientMetrics.forEach(metric => {
      metricMap.set(metric.metricName, parseFloat(metric.value));
    });

    return {
      bounceRate: metricMap.get(METRIC_NAMES.BOUNCE_RATE) || 35,
      sessionDuration: metricMap.get(METRIC_NAMES.SESSION_DURATION) || 180,
      pagesPerSession: metricMap.get(METRIC_NAMES.PAGES_PER_SESSION) || 2.5,
      sessionsPerUser: metricMap.get(METRIC_NAMES.SESSIONS_PER_USER) || 1.5
    };
  }

  /**
   * Generate list of periods to create data for
   */
  private generatePeriodList(count: number): Array<{ period: string; type: 'daily' | 'monthly' }> {
    const periods = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${String(month).padStart(2, '0')}`;
      
      // Recent 3 months could be daily, older are monthly (for sample data, use monthly for simplicity)
      const type = 'monthly';
      
      periods.push({ period, type });
    }
    
    return periods;
  }
}