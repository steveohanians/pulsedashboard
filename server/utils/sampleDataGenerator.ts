// Comprehensive Sample Data Generation System
// Generates 15 months of complete data for ALL entities with proper deduplication

import { storage } from '../storage';
import logger from './logger';
import { generateDynamicPeriodMapping } from './dateUtils';
import { performanceCache } from '../cache/performance-cache';

export interface SampleDataConfig {
  clientId: string;
  months: number;
  forceReplace: boolean;
  skipGA4Client?: boolean; // Skip generating sample data for GA4-enabled clients
}

// Core metrics that every entity should have
const CORE_METRICS = [
  'Bounce Rate',
  'Session Duration', 
  'Pages per Session',
  'Sessions per User'
] as const;

// Traffic and device metrics (JSON format)
const TRAFFIC_CHANNELS = ['Organic Search', 'Direct', 'Social Media', 'Referral', 'Email', 'Paid Search'];
const DEVICE_TYPES = ['Mobile', 'Desktop', 'Tablet'];

// Generate realistic metric values with controlled variance
function generateMetricValue(metricName: string, sourceType: string, baseValues: Record<string, number>): string {
  const base = baseValues[metricName] || 100;
  let variance = 0.1; // 10% variance by default
  
  // Adjust variance and base values by source type
  let multiplier = 1;
  switch (sourceType) {
    case 'Client':
      multiplier = 1;
      variance = 0.05; // Less variance for client data
      break;
    case 'Competitor':
      multiplier = 0.85 + Math.random() * 0.3; // 85-115% of client
      variance = 0.15;
      break;
    case 'Industry_Avg':
      multiplier = 0.9 + Math.random() * 0.2; // 90-110% of client
      variance = 0.1;
      break;
    case 'CD_Avg':
      multiplier = 1.05 + Math.random() * 0.1; // 105-115% of client (CD performs better)
      variance = 0.08;
      break;
  }
  
  const adjustedBase = base * multiplier;
  const variation = (Math.random() - 0.5) * 2 * variance; // -variance to +variance
  const finalValue = adjustedBase * (1 + variation);
  
  // Format based on metric type
  if (metricName === 'Bounce Rate') {
    return Math.max(10, Math.min(90, finalValue)).toFixed(1);
  } else if (metricName === 'Pages per Session' || metricName === 'Sessions per User') {
    return Math.max(1, finalValue).toFixed(2);
  } else if (metricName === 'Session Duration') {
    return Math.max(30, Math.round(finalValue)).toString();
  }
  
  return Math.max(0, Math.round(finalValue)).toString();
}

// Generate traffic channel data
function generateTrafficChannelData(): string {
  const channels: Record<string, number> = {};
  let remaining = 100;
  
  TRAFFIC_CHANNELS.forEach((channel, index) => {
    if (index === TRAFFIC_CHANNELS.length - 1) {
      channels[channel] = remaining;
    } else {
      const percentage = Math.floor(Math.random() * (remaining / 2)) + 5;
      channels[channel] = Math.min(percentage, remaining - 5);
      remaining -= channels[channel];
    }
  });
  
  return JSON.stringify(channels);
}

// Generate device distribution data
function generateDeviceData(): string {
  const mobile = 50 + Math.random() * 20; // 50-70%
  const desktop = 20 + Math.random() * 20; // 20-40%
  const tablet = 100 - mobile - desktop; // remainder
  
  return JSON.stringify({
    'Mobile': Math.round(mobile),
    'Desktop': Math.round(desktop),
    'Tablet': Math.round(tablet)
  });
}

// Generate periods for the last N months
function generateTimePeriods(months: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    periods.push(period);
  }
  
  return periods;
}

// Clear existing data for entities to prevent duplicates
async function clearExistingData(clientId: string, periods: string[]): Promise<void> {
  logger.info('Clearing existing sample data to prevent duplicates', { clientId, periods: periods.length });
  
  for (const period of periods) {
    // Clear client metrics (but preserve GA4 data if skipGA4Client is true)
    await storage.clearClientMetricsByPeriod(clientId, period);
    
    // Clear competitor metrics
    await storage.clearCompetitorMetricsByPeriod(clientId, period);
    
    // Clear industry and CD avg metrics
    await storage.clearBenchmarkMetricsByPeriod(period);
  }
  
  logger.info('Existing data cleared successfully');
}

// Generate comprehensive sample data for all entities
export async function generateComprehensiveSampleData(config: SampleDataConfig): Promise<{
  success: boolean;
  message: string;
  periodsGenerated: string[];
  entitiesGenerated: string[];
}> {
  const { clientId, months, forceReplace, skipGA4Client } = config;
  
  try {
    logger.info('Starting comprehensive sample data generation', config);
    
    // Generate periods
    const periods = generateTimePeriods(months);
    logger.info('Generated periods', { periods });
    
    // Clear existing data if force replace
    if (forceReplace) {
      await clearExistingData(clientId, periods);
    }
    
    // Get client and competitors
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    
    const competitors = await storage.getCompetitorsByClient(clientId);
    logger.info('Found competitors', { count: competitors.length });
    
    // Base values for consistent metric generation
    const baseValues = {
      'Bounce Rate': 35,
      'Session Duration': 187,
      'Pages per Session': 2.4,
      'Sessions per User': 1.8
    };
    
    const entitiesGenerated: string[] = [];
    let totalMetricsCreated = 0;
    
    // Generate data for each period
    for (const period of periods) {
      logger.info(`Generating data for period: ${period}`);
      
      // 1. Generate CLIENT data (unless GA4 client and skipGA4Client is true)
      if (!skipGA4Client || clientId !== 'demo-client-id') {
        entitiesGenerated.push('Client');
        
        for (const metricName of CORE_METRICS) {
          const value = generateMetricValue(metricName, 'Client', baseValues);
          await storage.createMetric({
            clientId,
            metricName,
            value,
            sourceType: 'Client',
            timePeriod: period
          });
          totalMetricsCreated++;
        }
        
        // Traffic Channels for client
        await storage.createMetric({
          clientId,
          metricName: 'Traffic Channels',
          value: generateTrafficChannelData(),
          sourceType: 'Client',
          timePeriod: period
        });
        totalMetricsCreated++;
        
        // Device Distribution for client
        await storage.createMetric({
          clientId,
          metricName: 'Device Distribution',
          value: generateDeviceData(),
          sourceType: 'Client',
          timePeriod: period
        });
        totalMetricsCreated++;
      }
      
      // 2. Generate COMPETITOR data
      if (competitors.length > 0) {
        entitiesGenerated.push('Competitors');
        
        for (const competitor of competitors) {
          for (const metricName of CORE_METRICS) {
            const value = generateMetricValue(metricName, 'Competitor', baseValues);
            await storage.createCompetitorMetric({
              clientId,
              competitorId: competitor.id,
              metricName,
              value,
              timePeriod: period
            });
            totalMetricsCreated++;
          }
        }
      }
      
      // 3. Generate INDUSTRY AVERAGE data
      entitiesGenerated.push('Industry_Avg');
      for (const metricName of CORE_METRICS) {
        const value = generateMetricValue(metricName, 'Industry_Avg', baseValues);
        await storage.createBenchmarkMetric({
          metricName,
          value,
          sourceType: 'Industry_Avg',
          timePeriod: period,
          businessSize: 'All',
          industryVertical: 'All'
        });
        totalMetricsCreated++;
      }
      
      // 4. Generate CD PORTFOLIO AVERAGE data
      entitiesGenerated.push('CD_Avg');
      for (const metricName of CORE_METRICS) {
        const value = generateMetricValue(metricName, 'CD_Avg', baseValues);
        await storage.createBenchmarkMetric({
          metricName,
          value,
          sourceType: 'CD_Avg',
          timePeriod: period,
          businessSize: 'All',
          industryVertical: 'All'
        });
        totalMetricsCreated++;
      }
    }
    
    // 5. FORCE COMPLETE CACHE CLEAR
    performanceCache.clear();
    logger.info('Performance cache cleared after sample data generation');
    
    // 6. Wait and clear again to ensure frontend refresh
    setTimeout(() => {
      performanceCache.clear();
      logger.info('Secondary cache clear completed');
    }, 100);
    
    const uniqueEntities = Array.from(new Set(entitiesGenerated));
    
    logger.info('Comprehensive sample data generation completed', {
      clientId,
      periodsGenerated: periods.length,
      entitiesGenerated: uniqueEntities,
      totalMetricsCreated
    });
    
    return {
      success: true,
      message: `Successfully generated ${totalMetricsCreated} metrics across ${periods.length} periods for ${uniqueEntities.length} entity types`,
      periodsGenerated: periods,
      entitiesGenerated: uniqueEntities
    };
    
  } catch (error) {
    logger.error('Sample data generation failed', { error: (error as Error).message, config });
    return {
      success: false,
      message: `Failed to generate sample data: ${(error as Error).message}`,
      periodsGenerated: [],
      entitiesGenerated: []
    };
  }
}

// Quick function to generate sample data with default settings
export async function generateDefaultSampleData(clientId: string): Promise<any> {
  return generateComprehensiveSampleData({
    clientId,
    months: 15,
    forceReplace: true,
    skipGA4Client: clientId === 'demo-client-id' // Skip client data for GA4-enabled demo client
  });
}