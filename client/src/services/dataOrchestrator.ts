/**
 * Data Orchestrator Service
 * Coordinates all data processing services and provides a unified API for the dashboard
 */

import { periodService } from './periodService';
import { metricProcessingService } from './metricProcessingService';
import { trafficChannelService } from './trafficChannelService';
import { deviceDistributionService } from './deviceDistributionService';
import { debugLog, DATA_SOURCE_CONFIG } from '@/config/dataSourceConfig';

interface DashboardData {
  client: any;
  metrics: any[];
  averagedMetrics?: Record<string, Record<string, number>>;
  timeSeriesData?: any;
  competitors: any[];
  insights: any[];
  isTimeSeries?: boolean;
  periods?: string[];
  trafficChannelMetrics?: any[];
}

interface OrchestrationResult {
  metrics: Record<string, Record<string, number>>;
  trafficChannels: any[];
  deviceDistribution: any[];
  periodMetadata: {
    ga4Period: string;
    semrushPeriod: string;
    displayPeriod: string;
    isAligned: boolean;
    warning?: string;
  };
  dataQuality: {
    hasClientData: boolean;
    hasCompetitorData: boolean;
    hasPortfolioData: boolean;
    completeness: number;
    warnings: string[];
  };
}

export class DataOrchestrator {
  private static instance: DataOrchestrator;

  static getInstance(): DataOrchestrator {
    if (!this.instance) {
      this.instance = new DataOrchestrator();
    }
    return this.instance;
  }

  /**
   * Main orchestration method - coordinates all services
   */
  orchestrateData(
    dashboardData: DashboardData | undefined,
    timePeriod: string
  ): OrchestrationResult | null {
    if (!dashboardData) {
      debugLog('ORCHESTRATOR', 'No dashboard data available');
      return null;
    }

    const startTime = performance.now();

    // Get period metadata
    const periodMetadata = periodService.getPeriodMetadata(timePeriod);
    
    // Process metrics
    const processedMetrics = metricProcessingService.processMetricsForPeriod(
      dashboardData.metrics || [],
      dashboardData.averagedMetrics,
      {
        targetPeriod: timePeriod,
        isTimeSeries: dashboardData.isTimeSeries
      }
    );

    // Process traffic channels
    const trafficChannels = trafficChannelService.processChannels(
      dashboardData,
      dashboardData.isTimeSeries || false,
      dashboardData.timeSeriesData,
      dashboardData.metrics || [],
      dashboardData.competitors || [],
      dashboardData.client
    );

    // Process device distribution
    const deviceDistribution = deviceDistributionService.processDevices(
      dashboardData.metrics || [],
      dashboardData.competitors || [],
      dashboardData.client
    );

    // Assess data quality
    const dataQuality = this.assessDataQuality(
      processedMetrics,
      trafficChannels,
      deviceDistribution,
      dashboardData
    );

    const processingTime = performance.now() - startTime;
    debugLog('ORCHESTRATOR', `Data orchestration completed in ${processingTime.toFixed(2)}ms`, {
      metricsCount: Object.keys(processedMetrics).length,
      trafficSources: trafficChannels.length,
      deviceSources: deviceDistribution.length
    });

    return {
      metrics: processedMetrics,
      trafficChannels,
      deviceDistribution,
      periodMetadata,
      dataQuality
    };
  }

  /**
   * Assess overall data quality and completeness
   */
  private assessDataQuality(
    metrics: Record<string, Record<string, number>>,
    trafficChannels: any[],
    deviceDistribution: any[],
    dashboardData: DashboardData
  ): OrchestrationResult['dataQuality'] {
    const warnings: string[] = [];

    // Check for client data
    const hasClientData = Object.values(metrics).some(m => 'Client' in m);
    if (!hasClientData) {
      warnings.push('Client data is missing or incomplete');
    }

    // Check for competitor data
    const hasCompetitorData = dashboardData.metrics?.some(m => m.sourceType === 'Competitor') || false;
    if (!hasCompetitorData && dashboardData.competitors?.length > 0) {
      warnings.push('Competitor data is not available for this period');
    }

    // Check for portfolio data (CD_Avg)
    const hasPortfolioData = Object.values(metrics).some(m => 'CD_Avg' in m);
    if (!hasPortfolioData) {
      warnings.push('Portfolio average data is not available');
    }

    // Check data source alignment
    const periodMetadata = periodService.getPeriodMetadata(dashboardData.isTimeSeries ? 'Last Month' : 'Last Month');
    if (!periodMetadata.isAligned) {
      warnings.push(periodMetadata.warning || 'Data sources are showing different time periods');
    }

    // Calculate completeness score
    const dataPoints = [hasClientData, hasCompetitorData, hasPortfolioData];
    const completeness = dataPoints.filter(Boolean).length / dataPoints.length;

    return {
      hasClientData,
      hasCompetitorData,
      hasPortfolioData,
      completeness,
      warnings
    };
  }

  /**
   * Get data source information for transparency
   */
  getDataSourceInfo(timePeriod: string): {
    ga4: {
      period: string;
      delay: number;
      hasDaily: boolean;
    };
    semrush: {
      period: string;
      delay: number;
      hasDaily: boolean;
    };
  } {
    const periodMetadata = periodService.getPeriodMetadata(timePeriod);

    return {
      ga4: {
        period: periodMetadata.ga4Period,
        delay: DATA_SOURCE_CONFIG.GA4.dataDelay,
        hasDaily: DATA_SOURCE_CONFIG.GA4.hasDaily
      },
      semrush: {
        period: periodMetadata.semrushPeriod,
        delay: DATA_SOURCE_CONFIG.SEMRUSH.dataDelay,
        hasDaily: DATA_SOURCE_CONFIG.SEMRUSH.hasDaily
      }
    };
  }

  /**
   * Check if new data might be available
   */
  shouldRefreshData(): boolean {
    // Check if we've entered a new month
    if (periodService.isNewMonth()) {
      debugLog('ORCHESTRATOR', 'New month detected, data refresh recommended');
      return true;
    }

    return false;
  }

  /**
   * Get formatted metric value
   */
  formatMetricValue(value: number, metricName: string): string {
    return metricProcessingService.formatMetricValue(value, metricName);
  }

  /**
   * Get device data in simplified format for charts
   */
  getSimplifiedDeviceData(sourceType: string): { Desktop: number; Mobile: number } {
    // This will be called after orchestrateData, so we need to store the result
    // For now, return default - in production, we'd cache the orchestration result
    return { Desktop: 55, Mobile: 45 };
  }
}

// Export singleton instance
export const dataOrchestrator = DataOrchestrator.getInstance();