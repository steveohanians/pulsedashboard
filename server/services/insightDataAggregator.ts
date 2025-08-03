import logger from '../utils/logger.js';
import type { IStorage } from '../storage.js';
import type { Metric, Competitor } from '@shared/schema';

export interface AggregatedMetricData {
  metricName: string;
  clientValue: number | null;
  cdAverage: number | null;
  industryAverage: number | null;
  competitorValues: number[];
  competitorNames: string[];
  previousPeriodValue: number | null;
  trendDirection: 'up' | 'down' | 'stable' | 'unknown';
  percentageChange: number | null;
}

export interface InsightGenerationContext {
  client: {
    id: string;
    name: string;
    industryVertical: string;
    businessSize: string;
  };
  period: string;
  previousPeriod: string;
  metrics: AggregatedMetricData[];
  totalCompetitors: number;
  hasIndustryData: boolean;
  hasCdPortfolioData: boolean;
}

export class InsightDataAggregator {
  constructor(private storage: IStorage) {}

  /**
   * Generate comprehensive context for AI insight generation
   */
  async aggregateDataForInsights(clientId: string, targetPeriod?: string): Promise<InsightGenerationContext> {
    try {
      // Calculate periods
      const periods = this.calculatePeriods(targetPeriod);
      
      // Get client information
      const client = await this.storage.getClient(clientId);
      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }

      // Get current and previous period metrics
      const [currentMetrics, previousMetrics, competitors] = await Promise.all([
        this.storage.getMetricsByClient(clientId, periods.current),
        this.storage.getMetricsByClient(clientId, periods.previous),
        this.storage.getCompetitorsByClient(clientId)
      ]);

      // Process metrics data
      const aggregatedMetrics = this.processMetricsData(
        currentMetrics,
        previousMetrics,
        competitors
      );

      // Build context
      const context: InsightGenerationContext = {
        client: {
          id: client.id,
          name: client.name,
          industryVertical: client.industryVertical,
          businessSize: client.businessSize
        },
        period: periods.current,
        previousPeriod: periods.previous,
        metrics: aggregatedMetrics,
        totalCompetitors: competitors.length,
        hasIndustryData: aggregatedMetrics.some(m => m.industryAverage !== null),
        hasCdPortfolioData: aggregatedMetrics.some(m => m.cdAverage !== null)
      };

      logger.info('Successfully aggregated data for AI insights', {
        clientId,
        period: periods.current,
        metricsCount: aggregatedMetrics.length,
        competitorsCount: competitors.length
      });

      return context;
    } catch (error) {
      logger.error('Error aggregating data for insights', {
        error: (error as Error).message,
        clientId,
        targetPeriod
      });
      throw error;
    }
  }

  /**
   * Calculate current and previous periods for analysis
   */
  private calculatePeriods(targetPeriod?: string): { current: string; previous: string } {
    if (targetPeriod) {
      const [year, month] = targetPeriod.split('-').map(Number);
      const currentDate = new Date(year, month - 1, 1);
      const previousDate = new Date(year, month - 2, 1);
      
      return {
        current: targetPeriod,
        previous: `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
      };
    }

    // Default to last month in Pacific Time
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')!.value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')!.value);
    
    const currentDate = new Date(ptYear, ptMonth - 2, 1); // Last month
    const previousDate = new Date(ptYear, ptMonth - 3, 1); // Month before last
    
    return {
      current: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      previous: `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
    };
  }

  /**
   * Process and aggregate metrics data with trend analysis
   */
  private processMetricsData(
    currentMetrics: Metric[],
    previousMetrics: Metric[],
    competitors: Competitor[]
  ): AggregatedMetricData[] {
    // Group current metrics by name
    const currentGrouped = this.groupMetricsByName(currentMetrics);
    const previousGrouped = this.groupMetricsByName(previousMetrics);
    
    const competitorMap = new Map(competitors.map(c => [c.id, c.domain || c.label || `Competitor ${c.id}`]));

    const result: AggregatedMetricData[] = [];

    for (const [metricName, currentData] of Object.entries(currentGrouped)) {
      const previousData = previousGrouped[metricName] || {};
      
      // Extract competitor data
      const competitorValues: number[] = [];
      const competitorNames: string[] = [];
      
      Object.entries(currentData).forEach(([sourceType, value]) => {
        if (sourceType.startsWith('Competitor_')) {
          const competitorId = sourceType.replace('Competitor_', '');
          const competitorName = competitorMap.get(competitorId) || `Competitor ${competitorId}`;
          competitorValues.push(typeof value === 'number' ? value : parseFloat(String(value)));
          competitorNames.push(competitorName);
        }
      });

      // Calculate trend
      const currentClientValue = currentData.Client ? (typeof currentData.Client === 'number' ? currentData.Client : parseFloat(String(currentData.Client))) : null;
      const previousClientValue = previousData.Client ? (typeof previousData.Client === 'number' ? previousData.Client : parseFloat(String(previousData.Client))) : null;
      
      const { trendDirection, percentageChange } = this.calculateTrend(
        currentClientValue,
        previousClientValue
      );

      result.push({
        metricName,
        clientValue: currentClientValue,
        cdAverage: currentData.CD_Avg ? (typeof currentData.CD_Avg === 'number' ? currentData.CD_Avg : parseFloat(String(currentData.CD_Avg))) : null,
        industryAverage: currentData.Industry_Avg ? (typeof currentData.Industry_Avg === 'number' ? currentData.Industry_Avg : parseFloat(String(currentData.Industry_Avg))) : null,
        competitorValues,
        competitorNames,
        previousPeriodValue: previousClientValue,
        trendDirection,
        percentageChange
      });
    }

    return result;
  }

  /**
   * Group metrics by name and source type
   */
  private groupMetricsByName(metrics: Metric[]): Record<string, Record<string, any>> {
    return metrics.reduce((acc: Record<string, Record<string, any>>, metric) => {
      if (!acc[metric.metricName]) {
        acc[metric.metricName] = {};
      }
      acc[metric.metricName][metric.sourceType] = metric.value;
      return acc;
    }, {});
  }

  /**
   * Calculate trend direction and percentage change
   */
  private calculateTrend(
    current: number | null,
    previous: number | null
  ): { trendDirection: 'up' | 'down' | 'stable' | 'unknown'; percentageChange: number | null } {
    if (current === null || previous === null || previous === 0) {
      return { trendDirection: 'unknown', percentageChange: null };
    }

    const change = ((current - previous) / previous) * 100;
    const threshold = 2; // 2% threshold for "stable"

    if (Math.abs(change) < threshold) {
      return { trendDirection: 'stable', percentageChange: change };
    }

    return {
      trendDirection: change > 0 ? 'up' : 'down',
      percentageChange: change
    };
  }
}