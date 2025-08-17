/**
 * Traffic Channel Processing Service
 * Handles all traffic channel data aggregation and transformation
 */

import { aggregateChannelData, sortChannelsByLegendOrder } from '@/utils/chartGenerators';
import { debugLog } from '@/config/dataSourceConfig';

interface TrafficMetric {
  metricName: string;
  value: any;
  sourceType: string;
  channel?: string;
  competitorId?: string;
  timePeriod?: string;
}

interface ChannelData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ProcessedTrafficData {
  sourceType: string;
  label: string;
  channels: ChannelData[];
}

export class TrafficChannelService {
  private static instance: TrafficChannelService;

  static getInstance(): TrafficChannelService {
    if (!this.instance) {
      this.instance = new TrafficChannelService();
    }
    return this.instance;
  }

  /**
   * Map numeric channel identifiers (used by Industry_Avg) to standard channel names
   */
  private mapNumericChannelToName(channelIdentifier: string): string {
    const numericChannelMap: Record<string, string> = {
      '0': 'Organic Search',
      '1': 'Direct', 
      '2': 'Social Media',
      '3': 'Paid Search',
      '4': 'Email',
      '5': 'Referral',
      '6': 'Other'
    };
    return numericChannelMap[channelIdentifier] || channelIdentifier;
  }

  /**
   * Get channel color based on channel name
   */
  private getChannelColor(channelName: string): string {
    // Import CHART_COLORS from chartUtils
    const colors: Record<string, string> = {
      'Organic Search': 'hsl(var(--color-competitor-1))',
      'Direct': 'hsl(var(--color-client))',
      'Social Media': 'hsl(var(--color-competitor-1))',
      'Paid Search': 'hsl(var(--chart-3))',
      'Email': 'hsl(var(--chart-5))',
      'Referral': '#E67E22',
      'Other': 'hsl(var(--color-default))'
    };
    return colors[channelName] || colors['Other'] || '#9ca3af';
  }

  /**
   * Process traffic channel data for stacked bar chart
   * Extracted from dashboard.tsx processTrafficChannelData function
   */
  processChannels(
    dashboardData: any,
    isTimeSeries: boolean,
    timeSeriesData: any,
    metrics: TrafficMetric[],
    competitors: Array<{ id: string; domain: string; label: string }>,
    client: { name?: string } | undefined
  ): ProcessedTrafficData[] {
    let trafficMetrics: TrafficMetric[] = [];

    // Determine data source based on availability
    if (dashboardData?.trafficChannelMetrics) {
      // Use dedicated traffic channel data when available
      trafficMetrics = dashboardData.trafficChannelMetrics;
      debugLog('TRAFFIC', 'Using dedicated trafficChannelMetrics', {
        count: trafficMetrics.length
      });
    } else if (isTimeSeries && timeSeriesData) {
      // Fallback: extract from time series data for multi-period
      trafficMetrics = Object.values(timeSeriesData)
        .flat()
        .filter((m: any) => m.metricName === "Traffic Channels") as TrafficMetric[];
      debugLog('TRAFFIC', 'Using timeSeriesData fallback', {
        count: trafficMetrics.length
      });
    } else {
      // For single-period queries without trafficChannelMetrics, use regular metrics
      trafficMetrics = metrics.filter(m => m.metricName === "Traffic Channels");
      debugLog('TRAFFIC', 'Using regular metrics fallback', {
        count: trafficMetrics.length
      });
    }

    if (trafficMetrics.length === 0) {
      debugLog('WARNING', 'No traffic metrics found', {
        metricsCount: metrics.length,
        timeSeriesData: timeSeriesData ? 'exists' : 'missing',
        isTimeSeries
      });
    }

    const result: ProcessedTrafficData[] = [];

    // Process Client data
    const clientTrafficMetrics = trafficMetrics.filter(m => m.sourceType === "Client");
    if (clientTrafficMetrics.length > 0) {
      const channelMap = aggregateChannelData(clientTrafficMetrics);
      const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
        ...channel,
        color: this.getChannelColor(channel.name)
      }));

      result.push({
        sourceType: "Client",
        label: client?.name || "Demo Company",
        channels: sortedChannels
      });
    }

    // Process CD Average data
    const cdMetrics = trafficMetrics.filter(m => m.sourceType === "CD_Avg");
    if (cdMetrics.length > 0) {
      const channelMap = aggregateChannelData(cdMetrics);
      const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
        ...channel,
        color: this.getChannelColor(channel.name)
      }));
      
      result.push({
        sourceType: "CD_Avg",
        label: "Clear Digital Client Avg",
        channels: sortedChannels
      });
    }

    // Process Industry Average data
    const industryMetrics = trafficMetrics.filter(m => m.sourceType === "Industry_Avg");
    if (industryMetrics.length > 0) {
      const channelMap = aggregateChannelData(industryMetrics);
      
      // Convert numeric channel identifiers to proper channel names for Industry_Avg
      const mappedChannelMap = new Map();
      channelMap.forEach((value, key) => {
        const mappedChannelName = this.mapNumericChannelToName(key);
        mappedChannelMap.set(mappedChannelName, value);
      });
      
      const sortedChannels = sortChannelsByLegendOrder(mappedChannelMap).map(channel => ({
        ...channel,
        color: this.getChannelColor(channel.name)
      }));

      result.push({
        sourceType: "Industry_Avg",
        label: "Industry Avg",
        channels: sortedChannels
      });
    }

    // Process Competitor data
    competitors.forEach(competitor => {
      const competitorLabel = this.cleanDomainName(competitor.domain);
      const competitorMetrics = trafficMetrics.filter(
        m => m.sourceType === "Competitor" && m.competitorId === competitor.id
      );

      if (competitorMetrics.length > 0) {
        const channelMap = aggregateChannelData(competitorMetrics);
        const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
          ...channel,
          color: this.getChannelColor(channel.name)
        }));
        
        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: competitorLabel,
          channels: sortedChannels
        });
      } else {
        // Generate fallback data for competitor if no data available
        const fallbackChannels = this.generateCompetitorFallback(competitor);
        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: competitorLabel,
          channels: fallbackChannels
        });
      }
    });

    debugLog('TRAFFIC', 'Processed traffic channels', {
      resultCount: result.length,
      sources: result.map(r => r.sourceType)
    });

    return result;
  }

  /**
   * Clean domain name for display
   */
  private cleanDomainName(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '');
  }

  /**
   * Generate fallback data for competitors with no data
   */
  private generateCompetitorFallback(competitor: { id: string; domain: string }): ChannelData[] {
    const baseData = [
      { name: "Organic Search", base: 40, variance: 5 },
      { name: "Direct", base: 25, variance: 4 },
      { name: "Social Media", base: 15, variance: 6 },
      { name: "Paid Search", base: 12, variance: 3 },
      { name: "Email", base: 3, variance: 2 }
    ];

    // Generate consistent but varied data based on competitor ID
    const idHash = competitor.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    let channels = baseData.map(channel => {
      const variance = (idHash % (channel.variance * 2)) - channel.variance;
      const value = Math.max(1, channel.base + variance);
      return {
        name: channel.name,
        value: value,
        percentage: value,
        color: this.getChannelColor(channel.name)
      };
    });

    // Normalize to 100%
    const total = channels.reduce((sum, channel) => sum + channel.value, 0);
    channels = channels.map(channel => ({
      ...channel,
      value: Math.round((channel.value / total) * 100),
      percentage: Math.round((channel.value / total) * 100)
    }));

    return channels;
  }
}

// Export singleton instance
export const trafficChannelService = TrafficChannelService.getInstance();