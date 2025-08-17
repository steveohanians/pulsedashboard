/**
 * Unified Data Service - Single source of truth for all metric processing
 * Handles GA4 vs SEMrush timing differences in ONE place
 * Replaces: metricProcessingService, trafficChannelService, deviceDistributionService, dataOrchestrator
 */

import { parseMetricValue } from '@/utils/metricParser';
import { debugLog } from '@/config/dataSourceConfig';

interface DashboardMetric {
  metricName: string;
  value: string | number;
  sourceType: string;
  channel?: string;
  competitorId?: string;
  timePeriod?: string;
}

interface ProcessedMetrics {
  [metricName: string]: {
    [sourceType: string]: number;
  };
}

interface DataPeriods {
  client: string;           // GA4 period (month - 1)
  competitors: string;      // SEMrush period (month - 2)
  cdPortfolio: string;      // SEMrush period (month - 2)
  industryBenchmark: string; // SEMrush period (month - 2)
  displayPeriod: string;    // What we show to users
}

interface ProcessedDashboardData {
  metrics: ProcessedMetrics;
  trafficChannels: any[];
  deviceDistribution: any[];
  periods: DataPeriods;
  dataQuality: {
    hasClientData: boolean;
    hasCompetitorData: boolean;
    hasPortfolioData: boolean;
    hasIndustryData: boolean;
    completeness: number;
    warnings: string[];
  };
}

export class UnifiedDataService {
  private static instance: UnifiedDataService;
  
  static getInstance(): UnifiedDataService {
    if (!this.instance) {
      this.instance = new UnifiedDataService();
    }
    return this.instance;
  }

  /**
   * Main entry point - processes ALL dashboard data with proper timing alignment
   */
  processDashboardData(
    dashboardData: any,
    timePeriod: string
  ): ProcessedDashboardData | null {
    if (!dashboardData) {
      debugLog('UNIFIED', 'No dashboard data available');
      return null;
    }

    // Step 1: Determine the actual data periods for each source
    const periods = this.getDataPeriods(timePeriod);
    
    debugLog('UNIFIED', 'Data periods calculated', {
      client: periods.client,
      semrush: periods.competitors,
      display: periods.displayPeriod
    });

    // Step 2: Process all metrics with proper timing alignment
    const metrics = this.processMetrics(
      dashboardData.metrics || [],
      dashboardData.averagedMetrics,
      periods,
      timePeriod
    );
    
    // Step 3: Process traffic channels
    const trafficChannels = this.processTrafficChannels(
      dashboardData.metrics || [],
      dashboardData.competitors || [],
      dashboardData.client,
      periods
    );
    
    // Step 4: Process device distribution
    const deviceDistribution = this.processDeviceDistribution(
      dashboardData.metrics || [],
      dashboardData.competitors || [],
      dashboardData.client,
      periods
    );

    // Step 5: Assess data quality
    const dataQuality = this.assessDataQuality(
      metrics,
      trafficChannels,
      deviceDistribution,
      periods
    );
    
    return {
      metrics,
      trafficChannels,
      deviceDistribution,
      periods,
      dataQuality
    };
  }

  /**
   * Calculate the correct data periods based on current date
   * GA4: current month - 1
   * SEMrush: current month - 2
   */
  private getDataPeriods(timePeriod: string): DataPeriods {
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find((p: any) => p.type === 'year')?.value || String(now.getFullYear()));
    const ptMonth = parseInt(ptParts.find((p: any) => p.type === 'month')?.value || String(now.getMonth() + 1));
    
    // GA4: current PT month - 1
    const ga4Date = new Date(ptYear, ptMonth - 2, 1); // -1 for 0-index, -1 for last month
    
    // SEMrush: current PT month - 2  
    const semrushDate = new Date(ptYear, ptMonth - 3, 1); // -1 for 0-index, -2 for two months ago
    
    const periods: DataPeriods = {
      client: this.formatPeriod(ga4Date),
      competitors: this.formatPeriod(semrushDate),
      cdPortfolio: this.formatPeriod(semrushDate),
      industryBenchmark: this.formatPeriod(semrushDate),
      displayPeriod: this.getDisplayPeriod(timePeriod, ga4Date, semrushDate)
    };
    
    return periods;
  }

  /**
   * Process metrics with standardized averaging for CD Portfolio and Industry Benchmark
   */
  private processMetrics(
    metrics: DashboardMetric[],
    averagedMetrics: Record<string, Record<string, number>> | undefined,
    periods: DataPeriods,
    timePeriod: string
  ): ProcessedMetrics {
    const result: ProcessedMetrics = {};
    const counts: Record<string, Record<string, number>> = {};

    // Filter metrics based on time period if needed
    const singlePeriodTarget = timePeriod === "Last Month" ? periods.client : null;
    const metricsToProcess = singlePeriodTarget 
      ? metrics.filter(m => !m.timePeriod || m.timePeriod === singlePeriodTarget)
      : metrics;

    // Process raw metrics with standardized averaging
    for (const metric of metricsToProcess) {
      const metricName = metric.metricName;
      const sourceType = this.normalizeSourceType(metric.sourceType);

      if (!result[metricName]) {
        result[metricName] = {};
        counts[metricName] = {};
      }
      if (!result[metricName][sourceType]) {
        result[metricName][sourceType] = 0;
        counts[metricName][sourceType] = 0;
      }

      let value = parseMetricValue(metric.value);

      // Apply standard conversions for ALL source types
      if (metricName === "Session Duration" && value > 60) {
        value = value / 60; // Convert seconds to minutes
      }

      result[metricName][sourceType] += value;
      counts[metricName][sourceType] += 1;
    }

    // Calculate averages - SAME LOGIC for CD Portfolio and Industry Benchmark
    for (const metricName in result) {
      for (const sourceType in result[metricName]) {
        if (counts[metricName][sourceType] > 0) {
          result[metricName][sourceType] = 
            result[metricName][sourceType] / counts[metricName][sourceType];
        }
      }
    }

    // Merge in pre-calculated averages if available
    if (averagedMetrics && typeof averagedMetrics === 'object') {
      for (const metricName in averagedMetrics) {
        if (!result[metricName]) {
          result[metricName] = {};
        }
        for (const sourceType in averagedMetrics[metricName]) {
          // Only use averagedMetrics if we don't already have this value
          if (!result[metricName][sourceType]) {
            result[metricName][sourceType] = averagedMetrics[metricName][sourceType];
          }
        }
      }
    }

    debugLog('UNIFIED', 'Processed metrics', {
      metricCount: Object.keys(result).length,
      sourceTypes: Array.from(new Set(Object.values(result).flatMap(m => Object.keys(m))))
    });

    return result;
  }

  /**
   * Process traffic channels with proper aggregation
   */
  private processTrafficChannels(
    metrics: DashboardMetric[],
    competitors: Array<{ id: string; domain: string }>,
    client: { name?: string } | undefined,
    periods: DataPeriods
  ): any[] {
    const trafficMetrics = metrics.filter(m => m.metricName === "Traffic Channels");
    const result: any[] = [];

    // Process Client data (GA4 - uses client period)
    const clientTraffic = this.aggregateTrafficBySource(
      trafficMetrics.filter(m => m.sourceType === "Client")
    );
    if (clientTraffic.length > 0) {
      result.push({
        sourceType: "Client",
        label: client?.name || "Client",
        channels: clientTraffic
      });
    }

    // Process CD Average (SEMrush - uses cdPortfolio period)
    const cdTraffic = this.aggregateTrafficBySource(
      trafficMetrics.filter(m => m.sourceType === "CD_Avg")
    );
    if (cdTraffic.length > 0) {
      result.push({
        sourceType: "CD_Avg",
        label: "Clear Digital Client Avg",
        channels: cdTraffic
      });
    }

    // Process Industry Average (SEMrush - uses industryBenchmark period)
    const industryTraffic = this.aggregateTrafficBySource(
      trafficMetrics.filter(m => m.sourceType === "Industry_Avg")
    );
    if (industryTraffic.length > 0) {
      result.push({
        sourceType: "Industry_Avg",
        label: "Industry Avg",
        channels: industryTraffic
      });
    }

    // Process Competitors (SEMrush - uses competitors period)
    competitors.forEach(competitor => {
      const competitorTraffic = this.aggregateTrafficBySource(
        trafficMetrics.filter(m => 
          m.sourceType === "Competitor" && m.competitorId === competitor.id
        )
      );
      if (competitorTraffic.length > 0) {
        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: this.cleanDomainName(competitor.domain),
          channels: competitorTraffic
        });
      }
    });

    return result;
  }

  /**
   * Process device distribution with proper aggregation
   */
  private processDeviceDistribution(
    metrics: DashboardMetric[],
    competitors: Array<{ id: string; domain: string }>,
    client: { name?: string } | undefined,
    periods: DataPeriods
  ): any[] {
    const deviceMetrics = metrics.filter(m => m.metricName === "Device Distribution");
    const result: any[] = [];

    debugLog('UNIFIED', 'Processing device distribution', {
      totalDeviceMetrics: deviceMetrics.length,
      competitors: competitors.length,
      sourceTypes: Array.from(new Set(deviceMetrics.map(m => m.sourceType)))
    });

    // Process Client data (GA4 - uses client period)
    const clientDevices = this.aggregateDevicesBySource(
      deviceMetrics.filter(m => m.sourceType === "Client")
    );
    if (clientDevices.length > 0) {
      result.push({
        sourceType: "Client",
        label: client?.name || "Client",
        devices: clientDevices
      });
    }

    // Process CD Average (SEMrush - uses cdPortfolio period)
    const cdDevices = this.aggregateDevicesBySource(
      deviceMetrics.filter(m => m.sourceType === "CD_Avg" || m.sourceType === "cd_avg")
    );
    if (cdDevices.length > 0) {
      result.push({
        sourceType: "CD_Avg",
        label: "Clear Digital Client Avg",
        devices: cdDevices
      });
    }

    // Process Industry Average (SEMrush - uses industryBenchmark period)
    const industryDevices = this.aggregateDevicesBySource(
      deviceMetrics.filter(m => m.sourceType === "Industry_Avg" || m.sourceType === "industry_avg" || m.sourceType === "Industry")
    );
    if (industryDevices.length > 0) {
      result.push({
        sourceType: "Industry_Avg",
        label: "Industry Avg",
        devices: industryDevices
      });
    } else {
      // If no Industry_Avg data, check if we have it in averagedMetrics format
      const industryMetric = metrics.find(m => 
        m.metricName === "Device Distribution" && 
        (m.sourceType === "Industry_Avg" || m.sourceType === "Industry")
      );
      if (industryMetric) {
        const devices = this.parseDeviceValue(industryMetric.value);
        if (devices.length > 0) {
          result.push({
            sourceType: "Industry_Avg",
            label: "Industry Avg",
            devices: devices
          });
        }
      }
    }

    // Process each Competitor individually
    competitors.forEach(competitor => {
      const competitorDevices = this.aggregateDevicesBySource(
        deviceMetrics.filter(m => 
          m.sourceType === "Competitor" && 
          m.competitorId === competitor.id
        )
      );
      
      if (competitorDevices.length > 0) {
        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: this.cleanDomainName(competitor.domain),
          devices: competitorDevices
        });
      } else {
        // Try to find competitor data in different format
        const competitorMetric = metrics.find(m => 
          m.metricName === "Device Distribution" && 
          m.sourceType === "Competitor" && 
          m.competitorId === competitor.id
        );
        
        if (competitorMetric) {
          const devices = this.parseDeviceValue(competitorMetric.value);
          if (devices.length > 0) {
            result.push({
              sourceType: `Competitor_${competitor.id}`,
              label: this.cleanDomainName(competitor.domain),
              devices: devices
            });
          }
        }
      }
    });

    debugLog('UNIFIED', 'Device distribution processed', {
      resultCount: result.length,
      sources: result.map(r => ({ source: r.sourceType, deviceCount: r.devices.length }))
    });

    return result;
  }

  /**
   * Helper: Parse device value from various formats
   */
  private parseDeviceValue(value: any): any[] {
    const devices: any[] = [];
    
    if (Array.isArray(value)) {
      // Already an array
      value.forEach(item => {
        const deviceName = item.device || item.name || item.category;
        const deviceValue = parseFloat(item.percentage || item.value || 0);
        if (deviceName && !isNaN(deviceValue)) {
          devices.push({
            name: deviceName,
            value: deviceValue,
            percentage: deviceValue,
            color: this.getDeviceColor(deviceName)
          });
        }
      });
    } else if (typeof value === 'string') {
      try {
        // Try to parse as JSON
        let jsonString = value;
        
        // Remove outer quotes if present
        if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
          jsonString = jsonString.slice(1, -1);
        }
        
        // Unescape JSON
        jsonString = jsonString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            const deviceName = item.device || item.name || item.category;
            const deviceValue = parseFloat(item.percentage || item.value || 0);
            if (deviceName && !isNaN(deviceValue)) {
              devices.push({
                name: deviceName,
                value: deviceValue,
                percentage: deviceValue,
                color: this.getDeviceColor(deviceName)
              });
            }
          });
        }
      } catch (e) {
        debugLog('UNIFIED', 'Failed to parse device JSON', { error: e, value: value?.substring?.(0, 100) });
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle object format { Desktop: 60, Mobile: 40 }
      Object.keys(value).forEach(deviceName => {
        const deviceValue = parseFloat(value[deviceName]);
        if (!isNaN(deviceValue)) {
          devices.push({
            name: deviceName,
            value: deviceValue,
            percentage: deviceValue,
            color: this.getDeviceColor(deviceName)
          });
        }
      });
    }
    
    return devices;
  }

  /**
   * Helper: Aggregate traffic channel data
   */
  private aggregateTrafficBySource(metrics: DashboardMetric[]): any[] {
    const channelMap = new Map<string, number>();
    const channelCounts = new Map<string, number>();

    metrics.forEach(metric => {
      // Handle different data formats
      let channelData: any[] = [];
      
      if (metric.channel) {
        // Individual channel record
        channelData = [{ channel: metric.channel, value: metric.value }];
      } else if (Array.isArray(metric.value)) {
        channelData = metric.value;
      } else if (typeof metric.value === 'string') {
        try {
          const parsed = JSON.parse(metric.value);
          if (Array.isArray(parsed)) channelData = parsed;
        } catch (e) {
          // Not JSON, skip
        }
      }

      channelData.forEach((item: any) => {
        const channelName = this.mapChannelName(item.channel || item.name);
        const value = parseFloat(item.percentage || item.value || 0);
        
        if (channelName && !isNaN(value)) {
          channelMap.set(
            channelName,
            (channelMap.get(channelName) || 0) + value
          );
          channelCounts.set(
            channelName,
            (channelCounts.get(channelName) || 0) + 1
          );
        }
      });
    });

    // Calculate averages and format
    const channels: any[] = [];
    channelMap.forEach((sum, name) => {
      const count = channelCounts.get(name) || 1;
      channels.push({
        name,
        value: Math.round((sum / count) * 10) / 10,
        percentage: Math.round((sum / count) * 10) / 10,
        color: this.getChannelColor(name)
      });
    });

    return this.sortChannels(channels);
  }

  /**
   * Helper: Aggregate device data (UPDATED)
   */
  private aggregateDevicesBySource(metrics: DashboardMetric[]): any[] {
    const deviceMap = new Map<string, number>();
    const deviceCounts = new Map<string, number>();

    debugLog('UNIFIED', 'Aggregating devices from metrics', { 
      count: metrics.length,
      sample: metrics[0]
    });

    metrics.forEach(metric => {
      const devices = this.parseDeviceValue(metric.value);
      
      // Also check if metric has channel field being used for device name
      if (metric.channel && !devices.length) {
        const deviceName = metric.channel;
        const value = parseFloat(String(metric.value));
        if (!isNaN(value)) {
          devices.push({
            name: deviceName,
            value: value,
            percentage: value,
            color: this.getDeviceColor(deviceName)
          });
        }
      }
      
      devices.forEach(device => {
        if (deviceMap.has(device.name)) {
          deviceMap.set(device.name, deviceMap.get(device.name)! + device.value);
          deviceCounts.set(device.name, deviceCounts.get(device.name)! + 1);
        } else {
          deviceMap.set(device.name, device.value);
          deviceCounts.set(device.name, 1);
        }
      });
    });

    // Calculate averages
    const result: any[] = [];
    deviceMap.forEach((sum, name) => {
      const count = deviceCounts.get(name) || 1;
      const avgValue = sum / count;
      result.push({
        name,
        value: Math.round(avgValue * 10) / 10,
        percentage: Math.round(avgValue * 10) / 10,
        color: this.getDeviceColor(name)
      });
    });

    // Ensure percentages add up to 100
    if (result.length > 0) {
      const total = result.reduce((sum, d) => sum + d.value, 0);
      if (total > 0 && Math.abs(total - 100) > 1) {
        // Normalize to 100%
        result.forEach(device => {
          device.value = Math.round((device.value / total) * 1000) / 10;
          device.percentage = device.value;
        });
      }
    }

    return result;
  }

  /**
   * Assess data quality and completeness
   */
  private assessDataQuality(
    metrics: ProcessedMetrics,
    trafficChannels: any[],
    deviceDistribution: any[],
    periods: DataPeriods
  ): any {
    const warnings: string[] = [];

    // Check for each data source
    const hasClientData = Object.values(metrics).some(m => 'Client' in m);
    const hasCompetitorData = Object.values(metrics).some(m => 'Competitor' in m);
    const hasPortfolioData = Object.values(metrics).some(m => 'CD_Avg' in m);
    const hasIndustryData = Object.values(metrics).some(m => 'Industry_Avg' in m);

    if (!hasClientData) warnings.push('Client data (GA4) is missing');
    if (!hasCompetitorData) warnings.push('Competitor data (SEMrush) is not available');
    if (!hasPortfolioData) warnings.push('Portfolio average data is not available');
    if (!hasIndustryData) warnings.push('Industry benchmark data is not available');

    // Add timing warning if periods don't match
    if (periods.client !== periods.competitors) {
      warnings.push(`Client data is from ${periods.client}, competitor/benchmark data is from ${periods.competitors}`);
    }

    const dataPoints = [hasClientData, hasCompetitorData, hasPortfolioData, hasIndustryData];
    const completeness = dataPoints.filter(Boolean).length / dataPoints.length;

    return {
      hasClientData,
      hasCompetitorData,
      hasPortfolioData,
      hasIndustryData,
      completeness,
      warnings
    };
  }

  /**
   * Helper functions
   */
  private normalizeSourceType(sourceType: string): string {
    const normalizations: Record<string, string> = {
      'cd_avg': 'CD_Avg',
      'industry_avg': 'Industry_Avg',
      'industry': 'Industry_Avg',
      'client': 'Client',
      'competitor': 'Competitor'
    };
    return normalizations[sourceType.toLowerCase()] || sourceType;
  }

  private formatPeriod(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  private getDisplayPeriod(timePeriod: string, ga4Date: Date, semrushDate: Date): string {
    if (timePeriod === "Last Month") {
      return ga4Date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    // Add other period types as needed
    return timePeriod;
  }

  private cleanDomainName(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '');
  }

  private mapChannelName(channel: string): string {
    // Map numeric channels to names (for Industry_Avg data)
    const numericMap: Record<string, string> = {
      '0': 'Organic Search',
      '1': 'Direct',
      '2': 'Social Media',
      '3': 'Paid Search',
      '4': 'Email',
      '5': 'Referral',
      '6': 'Other'
    };
    return numericMap[channel] || channel;
  }

  private getChannelColor(channelName: string): string {
    const colors: Record<string, string> = {
      'Organic Search': '#ef4444',
      'Direct': '#3b82f6',
      'Social Media': '#ef4444',
      'Paid Search': '#fbbf24',
      'Email': '#a78bfa',
      'Referral': '#e67e22',
      'Other': '#6b7280'
    };
    return colors[channelName] || '#6b7280';
  }

  private getDeviceColor(deviceName: string): string {
    const colors: Record<string, string> = {
      'Desktop': '#3b82f6',
      'Mobile': '#10b981',
      'Tablet': '#84cc16',
      'Other': '#64748b'
    };
    return colors[deviceName] || '#64748b';
  }

  private sortChannels(channels: any[]): any[] {
    const order = [
      'Organic Search',
      'Direct',
      'Social Media',
      'Paid Search',
      'Email',
      'Referral',
      'Other'
    ];
    
    return channels.sort((a, b) => {
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }
}

// Export singleton instance
export const unifiedDataService = UnifiedDataService.getInstance();