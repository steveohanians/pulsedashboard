import logger from '../../utils/logging/logger';
import type { SemrushMetricData } from './semrushService.js';
import type { InsertMetric } from '@shared/schema.js';

export interface ProcessedMetricData {
  metrics: InsertMetric[];
  trafficChannelMetrics: InsertMetric[];
  deviceDistributionMetrics: InsertMetric[];
}

export class SemrushDataProcessor {
  
  /**
   * Calculate median value from an array of numbers
   * Handles edge cases: empty arrays, single values, even/odd lengths
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    
    if (values.length === 1) {
      return values[0];
    }
    
    // Sort values in ascending order
    const sortedValues = [...values].sort((a, b) => a - b);
    const midIndex = Math.floor(sortedValues.length / 2);
    
    // For even length arrays, return average of two middle values
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
    }
    
    // For odd length arrays, return middle value
    return sortedValues[midIndex];
  }

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
   * Convert SEMrush data to our database metric format for competitors
   */
  public processCompetitorData(
    competitorId: string, 
    historicalData: Map<string, SemrushMetricData>
  ): ProcessedMetricData {
    logger.info('Processing SEMrush data for competitor', { 
      competitorId, 
      periodsCount: historicalData.size 
    });

    const metrics: InsertMetric[] = [];
    const trafficChannelMetrics: InsertMetric[] = [];
    const deviceDistributionMetrics: InsertMetric[] = [];

    for (const [period, data] of Array.from(historicalData.entries())) {
      // Process main metrics for competitor
      this.processCompetitorMainMetrics(competitorId, period, data, metrics);
      
      // Process traffic channels for competitor
      this.processCompetitorTrafficChannels(competitorId, period, data.trafficChannels, trafficChannelMetrics);
      
      // Process device distribution for competitor
      this.processCompetitorDeviceDistribution(competitorId, period, data.deviceDistribution, deviceDistributionMetrics);
    }

    logger.info('Completed SEMrush competitor data processing', {
      competitorId,
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
          cdPortfolioCompanyId: companyId,
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
          cdPortfolioCompanyId: companyId,
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
          cdPortfolioCompanyId: companyId,
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
   * Process main analytics metrics for competitors
   */
  private processCompetitorMainMetrics(
    competitorId: string,
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
          clientId: null,
          competitorId: competitorId,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: null,
          metricName: metric.name,
          value: { value: metric.value, source: 'semrush' },
          sourceType: 'Competitor',
          timePeriod: period,
          channel: null
        });
      }
    }
  }

  /**
   * Process traffic channel data for competitors
   */
  private processCompetitorTrafficChannels(
    competitorId: string,
    period: string,
    channels: SemrushMetricData['trafficChannels'],
    trafficChannelMetrics: InsertMetric[]
  ): void {
    for (const channel of channels) {
      if (channel.percentage > 0) {
        trafficChannelMetrics.push({
          clientId: null,
          competitorId: competitorId,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: null,
          metricName: 'Traffic Channels',
          value: { 
            percentage: channel.percentage,
            sessions: channel.sessions,
            source: 'semrush'
          },
          sourceType: 'Competitor',
          timePeriod: period,
          channel: channel.channel
        });
      }
    }
  }

  /**
   * Process device distribution data for competitors
   */
  private processCompetitorDeviceDistribution(
    competitorId: string,
    period: string,
    devices: SemrushMetricData['deviceDistribution'],
    deviceDistributionMetrics: InsertMetric[]
  ): void {
    for (const device of devices) {
      if (device.percentage > 0) {
        deviceDistributionMetrics.push({
          clientId: null,
          competitorId: competitorId,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: null,
          metricName: 'Device Distribution',
          value: {
            percentage: device.percentage,
            sessions: device.sessions,
            source: 'semrush'
          },
          sourceType: 'Competitor',
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
        
        logger.info(`🧮 Calculating average for ${metricName} in ${period}`, {
          companiesCount: allCompanyMetrics.size,
          companyIds: Array.from(allCompanyMetrics.keys())
        });
        
        for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
          const metric = data.metrics.find((m: InsertMetric) => 
            m.metricName === metricName && m.timePeriod === period
          );
          if (metric && metric.value && typeof metric.value === 'object' && 'value' in metric.value) {
            const value = metric.value.value as number;
            values.push(value);
            logger.info(`🧮 Found ${metricName} value: ${value} for company ${companyId}`);
          } else {
            logger.warn(`🧮 No ${metricName} value found for company ${companyId} in ${period}`);
          }
        }

        if (values.length > 0) {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          logger.info(`🧮 CALCULATED AVERAGE: ${metricName} = ${average} from values [${values.join(', ')}]`);
          avgMetrics.push({
            clientId: null,
            competitorId: null,
            cdPortfolioCompanyId: null,
            benchmarkCompanyId: null,
            metricName,
            value: { value: average, source: 'cd_portfolio_average' },
            sourceType: 'CD_Avg',
            timePeriod: period,
            channel: null
          });
        } else {
          logger.warn(`🧮 No values found for ${metricName} in ${period}`);
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

    // First, try to collect data for the exact requested period
    let foundDataForPeriod = false;
    for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
      const relevantMetrics = metricName === 'Traffic Channels' 
        ? data.trafficChannelMetrics 
        : data.deviceDistributionMetrics;

      for (const metric of relevantMetrics) {
        if (metric.timePeriod === period && metric.channel) {
          foundDataForPeriod = true;
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

    // If no data found for exact period, use most recent available data
    if (!foundDataForPeriod) {
      logger.info(`No CD Portfolio ${metricName} data for ${period}, finding most recent data`);
      
      // Find the most recent time period with data
      const availablePeriods = new Set<string>();
      for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
        const relevantMetrics = metricName === 'Traffic Channels' 
          ? data.trafficChannelMetrics 
          : data.deviceDistributionMetrics;
        
        for (const metric of relevantMetrics) {
          if (metric.channel && metric.timePeriod) {
            availablePeriods.add(metric.timePeriod);
          }
        }
      }

      if (availablePeriods.size > 0) {
        // Sort periods and get the most recent one
        const sortedPeriods = Array.from(availablePeriods).sort().reverse();
        const mostRecentPeriod = sortedPeriods[0];
        logger.info(`Using most recent CD Portfolio ${metricName} data from ${mostRecentPeriod} for ${period}`);

        // Collect data from the most recent period
        for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
          const relevantMetrics = metricName === 'Traffic Channels' 
            ? data.trafficChannelMetrics 
            : data.deviceDistributionMetrics;

          for (const metric of relevantMetrics) {
            if (metric.timePeriod === mostRecentPeriod && metric.channel) {
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
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: null,
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

  /**
   * Convert SEMrush data to our database metric format for benchmark companies
   */
  public processBenchmarkCompanyData(
    companyId: string, 
    historicalData: Map<string, SemrushMetricData>
  ): ProcessedMetricData {
    logger.info('Processing SEMrush data for Benchmark company', { 
      companyId, 
      periodsCount: historicalData.size 
    });

    const metrics: InsertMetric[] = [];
    const trafficChannelMetrics: InsertMetric[] = [];
    const deviceDistributionMetrics: InsertMetric[] = [];

    for (const [period, data] of Array.from(historicalData.entries())) {
      // Process main metrics for benchmark company
      this.processBenchmarkMainMetrics(companyId, period, data, metrics);
      
      // Process traffic channels for benchmark company
      this.processBenchmarkTrafficChannels(companyId, period, data.trafficChannels, trafficChannelMetrics);
      
      // Process device distribution for benchmark company
      this.processBenchmarkDeviceDistribution(companyId, period, data.deviceDistribution, deviceDistributionMetrics);
    }

    logger.info('Completed SEMrush benchmark data processing', {
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
   * Calculate Industry averages from all benchmark companies
   */
  public calculateIndustryAverages(
    allCompanyMetrics: Map<string, ProcessedMetricData>,
    periods: string[]
  ): ProcessedMetricData {
    logger.info('Calculating Industry averages', { 
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
        
        logger.info(`🧮 Calculating industry average for ${metricName} in ${period}`, {
          companiesCount: allCompanyMetrics.size,
          companyIds: Array.from(allCompanyMetrics.keys())
        });
        
        for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
          const metric = data.metrics.find((m: InsertMetric) => 
            m.metricName === metricName && m.timePeriod === period
          );
          if (metric && metric.value && typeof metric.value === 'object' && 'value' in metric.value) {
            const value = metric.value.value as number;
            values.push(value);
            logger.info(`🧮 Found ${metricName} value: ${value} for benchmark company ${companyId}`);
          } else {
            logger.warn(`🧮 No ${metricName} value found for benchmark company ${companyId} in ${period}`);
          }
        }

        if (values.length > 0) {
          const average = this.calculateMedian(values);
          logger.info(`🧮 CALCULATED INDUSTRY AVERAGE: ${metricName} = ${average} from values [${values.join(', ')}]`);
          avgMetrics.push({
            clientId: null,
            competitorId: null,
            cdPortfolioCompanyId: null,
            benchmarkCompanyId: null,
            metricName,
            value: { value: average, source: 'industry_average' },
            sourceType: 'Industry_Avg',
            timePeriod: period,
            channel: null
          });
        } else {
          // 🔧 FALLBACK: Use most recent available data for missing periods
          const fallbackAverage = this.findMostRecentAverage(allCompanyMetrics, metricName, period, periods);
          if (fallbackAverage !== null) {
            logger.info(`🧮 USING FALLBACK: ${metricName} = ${fallbackAverage} (most recent data) for ${period}`);
            avgMetrics.push({
              clientId: null,
              competitorId: null,
              cdPortfolioCompanyId: null,
              benchmarkCompanyId: null,
              metricName,
              value: { value: fallbackAverage, source: 'industry_average_fallback' },
              sourceType: 'Industry_Avg',
              timePeriod: period,
              channel: null
            });
          } else {
            logger.warn(`🧮 No values found for ${metricName} in ${period} and no fallback available`);
          }
        }
      }

      // Calculate traffic channel averages
      this.calculateIndustryChannelAverages(
        allCompanyMetrics,
        period,
        'Traffic Channels',
        avgTrafficChannels
      );

      // Calculate device distribution averages
      this.calculateIndustryChannelAverages(
        allCompanyMetrics,
        period,
        'Device Distribution',
        avgDeviceDistribution
      );
    }

    logger.info('Completed Industry averages calculation', {
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
   * Find the most recent industry average for a metric when current period data is missing
   */
  private findMostRecentAverage(
    allCompanyMetrics: Map<string, ProcessedMetricData>,
    metricName: string,
    currentPeriod: string,
    allPeriods: string[]
  ): number | null {
    // Sort periods in descending order to find most recent
    const sortedPeriods = [...allPeriods].sort().reverse();
    const currentIndex = sortedPeriods.indexOf(currentPeriod);
    
    // Look for data in previous periods
    for (let i = currentIndex + 1; i < sortedPeriods.length; i++) {
      const checkPeriod = sortedPeriods[i];
      const values: number[] = [];
      
      for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
        const metric = data.metrics.find((m: InsertMetric) => 
          m.metricName === metricName && m.timePeriod === checkPeriod
        );
        if (metric && metric.value && typeof metric.value === 'object' && 'value' in metric.value) {
          values.push(metric.value.value as number);
        }
      }
      
      if (values.length > 0) {
        const average = this.calculateMedian(values);
        logger.info(`🔄 Found fallback average for ${metricName}: ${average} from period ${checkPeriod}`);
        return average;
      }
    }
    
    return null;
  }

  /**
   * Process main analytics metrics for benchmark companies
   */
  private processBenchmarkMainMetrics(
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
          clientId: null,
          competitorId: null,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: companyId,
          metricName: metric.name,
          value: { value: metric.value, source: 'semrush' },
          sourceType: 'Benchmark',
          timePeriod: period,
          channel: null
        });
      }
    }
  }

  /**
   * Process traffic channels for benchmark companies
   */
  private processBenchmarkTrafficChannels(
    companyId: string,
    period: string,
    trafficChannels: Record<string, any>,
    trafficChannelMetrics: InsertMetric[]
  ): void {
    for (const [channel, data] of Object.entries(trafficChannels)) {
      if (data && typeof data === 'object' && 'percentage' in data) {
        trafficChannelMetrics.push({
          clientId: null,
          competitorId: null,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: companyId,
          metricName: 'Traffic Channels',
          value: {
            percentage: data.percentage,
            sessions: data.sessions || 0,
            source: 'semrush'
          },
          sourceType: 'Benchmark',
          timePeriod: period,
          channel
        });
      }
    }
  }

  /**
   * Process device distribution for benchmark companies
   */
  private processBenchmarkDeviceDistribution(
    companyId: string,
    period: string,
    deviceDistribution: Record<string, any>,
    deviceDistributionMetrics: InsertMetric[]
  ): void {
    for (const [device, data] of Object.entries(deviceDistribution)) {
      if (data && typeof data === 'object' && 'percentage' in data) {
        deviceDistributionMetrics.push({
          clientId: null,
          competitorId: null,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: companyId,
          metricName: 'Device Distribution',
          value: {
            percentage: data.percentage,
            sessions: data.sessions || 0,
            source: 'semrush'
          },
          sourceType: 'Benchmark',
          timePeriod: period,
          channel: device
        });
      }
    }
  }

  /**
   * Calculate industry channel-based averages (traffic channels, device distribution)
   */
  private calculateIndustryChannelAverages(
    allCompanyMetrics: Map<string, ProcessedMetricData>,
    period: string,
    metricName: string,
    targetArray: InsertMetric[]
  ): void {
    const channelData = new Map<string, { percentages: number[], sessions: number[] }>();

    // First, try to collect data for the exact requested period
    let foundDataForPeriod = false;
    for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
      const relevantMetrics = metricName === 'Traffic Channels' 
        ? data.trafficChannelMetrics 
        : data.deviceDistributionMetrics;

      for (const metric of relevantMetrics) {
        if (metric.timePeriod === period && metric.channel) {
          foundDataForPeriod = true;
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

    // If no data found for exact period, use most recent available data
    if (!foundDataForPeriod) {
      logger.info(`No Benchmark ${metricName} data for ${period}, finding most recent data`);
      
      // Find the most recent time period with data
      const availablePeriods = new Set<string>();
      for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
        const relevantMetrics = metricName === 'Traffic Channels' 
          ? data.trafficChannelMetrics 
          : data.deviceDistributionMetrics;
        
        for (const metric of relevantMetrics) {
          if (metric.channel && metric.timePeriod) {
            availablePeriods.add(metric.timePeriod);
          }
        }
      }

      if (availablePeriods.size > 0) {
        // Sort periods and get the most recent one
        const sortedPeriods = Array.from(availablePeriods).sort().reverse();
        const mostRecentPeriod = sortedPeriods[0];
        logger.info(`Using most recent Benchmark ${metricName} data from ${mostRecentPeriod} for ${period}`);

        // Collect data from the most recent period
        for (const [companyId, data] of Array.from(allCompanyMetrics.entries())) {
          const relevantMetrics = metricName === 'Traffic Channels' 
            ? data.trafficChannelMetrics 
            : data.deviceDistributionMetrics;

          for (const metric of relevantMetrics) {
            if (metric.timePeriod === mostRecentPeriod && metric.channel) {
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
      }
    }

    // Calculate averages for each channel
    for (const [channel, data] of Array.from(channelData.entries())) {
      if (data.percentages.length > 0) {
        const avgPercentage = this.calculateMedian(data.percentages);
        const avgSessions = this.calculateMedian(data.sessions);

        targetArray.push({
          clientId: null,
          competitorId: null,
          cdPortfolioCompanyId: null,
          benchmarkCompanyId: null,
          metricName,
          value: {
            percentage: avgPercentage,
            sessions: avgSessions,
            source: 'industry_average'
          },
          sourceType: 'Industry_Avg',
          timePeriod: period,
          channel
        });
      }
    }
  }
}

export const semrushDataProcessor = new SemrushDataProcessor();