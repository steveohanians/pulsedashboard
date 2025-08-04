import logger from '../../utils/logger.js';
import type { SemrushMetricData } from './semrushService.js';
import type { InsertMetric } from '@shared/schema.js';

export interface ProcessedMetricData {
  metrics: InsertMetric[];
  trafficChannelMetrics: InsertMetric[];
  deviceDistributionMetrics: InsertMetric[];
}

export class SemrushDataProcessor {
  
  /**
   * Convert SEMrush data to our database metric format
   */
  public processCompanyData(
    companyId: string, 
    historicalData: Map<string, SemrushMetricData>
  ): ProcessedMetricData {
    logger.info('Processing SEMrush data for CD Portfolio company', { 
      companyId, 
      periodsCount: historicalData.size 
    });

    const metrics: InsertMetric[] = [];
    const trafficChannelMetrics: InsertMetric[] = [];
    const deviceDistributionMetrics: InsertMetric[] = [];

    for (const [period, data] of Array.from(historicalData.entries())) {
      // Process main metrics
      this.processMainMetrics(companyId, period, data, metrics);
      
      // Process traffic channels
      this.processTrafficChannels(companyId, period, data.trafficChannels, trafficChannelMetrics);
      
      // Process device distribution
      this.processDeviceDistribution(companyId, period, data.deviceDistribution, deviceDistributionMetrics);
    }

    logger.info('Completed SEMrush data processing', {
      companyId,
      mainMetrics: metrics.length,
      trafficChannelMetrics: trafficChannelMetrics.length,
      deviceDistributionMetrics: deviceDistributionMetrics.length
    });

    return {
      metrics,
      trafficChannelMetrics,
      deviceDistributionMetrics
    };
  }

  /**
   * Process main analytics metrics
   */
  private processMainMetrics(
    companyId: string,
    period: string,
    data: SemrushMetricData,
    metrics: InsertMetric[]
  ): void {
    const mainMetrics = [
      { name: 'Bounce Rate', value: data.bounceRate },
      { name: 'Session Duration', value: data.sessionDuration },
      { name: 'Pages per Session', value: data.pagesPerSession },
      { name: 'Sessions per User', value: data.sessionsPerUser }
    ];

    for (const metric of mainMetrics) {
      if (metric.value > 0) { // Only store non-zero values
        metrics.push({
          clientId: null, // CD Portfolio companies don't have clientId
          competitorId: null,
          metricName: metric.name,
          value: { value: metric.value, source: 'semrush' },
          sourceType: 'CD_Portfolio',
          timePeriod: period,
          channel: null
        });
      }
    }
  }

  /**
   * Process traffic channel data
   */
  private processTrafficChannels(
    companyId: string,
    period: string,
    channels: SemrushMetricData['trafficChannels'],
    trafficChannelMetrics: InsertMetric[]
  ): void {
    for (const channel of channels) {
      if (channel.percentage > 0) {
        trafficChannelMetrics.push({
          clientId: null,
          competitorId: null,
          metricName: 'Traffic Channels',
          value: { 
            percentage: channel.percentage,
            sessions: channel.sessions,
            source: 'semrush'
          },
          sourceType: 'CD_Portfolio',
          timePeriod: period,
          channel: channel.channel
        });
      }
    }
  }

  /**
   * Process device distribution data
   */
  private processDeviceDistribution(
    companyId: string,
    period: string,
    devices: SemrushMetricData['deviceDistribution'],
    deviceDistributionMetrics: InsertMetric[]
  ): void {
    for (const device of devices) {
      if (device.percentage > 0) {
        deviceDistributionMetrics.push({
          clientId: null,
          competitorId: null,
          metricName: 'Device Distribution',
          value: {
            percentage: device.percentage,
            sessions: device.sessions,
            source: 'semrush'
          },
          sourceType: 'CD_Portfolio',
          timePeriod: period,
          channel: device.device
        });
      }
    }
  }

  /**
   * Calculate CD Portfolio averages from all portfolio companies
   */
  public calculatePortfolioAverages(
    allCompanyMetrics: Map<string, ProcessedMetricData>,
    periods: string[]
  ): ProcessedMetricData {
    logger.info('Calculating CD Portfolio averages', { 
      companiesCount: allCompanyMetrics.size,
      periodsCount: periods.length 
    });

    const avgMetrics: InsertMetric[] = [];
    const avgTrafficChannels: InsertMetric[] = [];
    const avgDeviceDistribution: InsertMetric[] = [];

    const metricNames = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];

    for (const period of periods) {
      // Calculate main metric averages
      for (const metricName of metricNames) {
        const values: number[] = [];
        
        for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
          const metric = data.metrics.find((m: InsertMetric) => 
            m.metricName === metricName && m.timePeriod === period
          );
          if (metric && metric.value && typeof metric.value === 'object' && 'value' in metric.value) {
            values.push(metric.value.value as number);
          }
        }

        if (values.length > 0) {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          avgMetrics.push({
            clientId: null,
            competitorId: null,
            metricName,
            value: { value: average, source: 'cd_portfolio_average' },
            sourceType: 'CD_Avg',
            timePeriod: period,
            channel: null
          });
        }
      }

      // Calculate traffic channel averages
      this.calculateChannelAverages(
        allCompanyMetrics,
        period,
        'Traffic Channels',
        avgTrafficChannels
      );

      // Calculate device distribution averages
      this.calculateChannelAverages(
        allCompanyMetrics,
        period,
        'Device Distribution',
        avgDeviceDistribution
      );
    }

    logger.info('Completed CD Portfolio averages calculation', {
      avgMetrics: avgMetrics.length,
      avgTrafficChannels: avgTrafficChannels.length,
      avgDeviceDistribution: avgDeviceDistribution.length
    });

    return {
      metrics: avgMetrics,
      trafficChannelMetrics: avgTrafficChannels,
      deviceDistributionMetrics: avgDeviceDistribution
    };
  }

  /**
   * Calculate channel-based averages (traffic channels, device distribution)
   */
  private calculateChannelAverages(
    allCompanyMetrics: Map<string, ProcessedMetricData>,
    period: string,
    metricName: string,
    targetArray: InsertMetric[]
  ): void {
    const channelData = new Map<string, { percentages: number[], sessions: number[] }>();

    // Collect all channel data for this period
    for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
      const relevantMetrics = metricName === 'Traffic Channels' 
        ? data.trafficChannelMetrics 
        : data.deviceDistributionMetrics;

      for (const metric of relevantMetrics) {
        if (metric.timePeriod === period && metric.channel) {
          if (!channelData.has(metric.channel)) {
            channelData.set(metric.channel, { percentages: [], sessions: [] });
          }
          
          const channelInfo = channelData.get(metric.channel)!;
          if (metric.value && typeof metric.value === 'object' && 'percentage' in metric.value) {
            channelInfo.percentages.push(metric.value.percentage as number);
            channelInfo.sessions.push((metric.value.sessions as number) || 0);
          }
        }
      }
    }

    // Calculate averages for each channel
    for (const [channel, data] of Array.from(channelData.entries())) {
      if (data.percentages.length > 0) {
        const avgPercentage = data.percentages.reduce((sum: number, val: number) => sum + val, 0) / data.percentages.length;
        const avgSessions = data.sessions.reduce((sum: number, val: number) => sum + val, 0) / data.sessions.length;

        targetArray.push({
          clientId: null,
          competitorId: null,
          metricName,
          value: {
            percentage: avgPercentage,
            sessions: avgSessions,
            source: 'cd_portfolio_average'
          },
          sourceType: 'CD_Avg',
          timePeriod: period,
          channel
        });
      }
    }
  }
}

export const semrushDataProcessor = new SemrushDataProcessor();