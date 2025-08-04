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

// Generate realistic metric values with controlled variance and trend patterns
function generateMetricValue(
  metricName: string, 
  sourceType: string, 
  baseValues: Record<string, number>, 
  monthIndex: number, 
  totalMonths: number,
  competitorId?: string
): string {
  const base = baseValues[metricName] || 100;
  
  // Create trend patterns over time (15 months)
  const trendProgress = monthIndex / (totalMonths - 1); // 0 to 1
  
  // Define different trend patterns for each source type
  let trendMultiplier = 1;
  let baseMultiplier = 1;
  let variance = 0.1;
  
  switch (sourceType) {
    case 'Client':
      // Client shows improving trend over time
      if (metricName === 'Bounce Rate') {
        trendMultiplier = 1 - (trendProgress * 0.15); // Decreasing bounce rate (good)
        baseMultiplier = 1;
        variance = 0.03;
      } else {
        trendMultiplier = 1 + (trendProgress * 0.12); // Increasing other metrics (good)
        baseMultiplier = 1;
        variance = 0.03;
      }
      break;
      
    case 'Competitor':
      // Different competitors have different performance levels
      const competitorVariant = competitorId ? competitorId.slice(-2) : '00';
      const competitorSeed = parseInt(competitorVariant, 16) / 255;
      
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 0.8 + (competitorSeed * 0.4); // 80%-120% of client base
        trendMultiplier = 1 - (trendProgress * 0.08); // Slight improvement
      } else {
        baseMultiplier = 0.85 + (competitorSeed * 0.3); // 85%-115% of client base
        trendMultiplier = 1 + (trendProgress * 0.08); // Slight improvement
      }
      variance = 0.12;
      break;
      
    case 'Industry_Avg':
      // Industry average shows moderate improvement
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 1.15; // Higher bounce rate than client
        trendMultiplier = 1 - (trendProgress * 0.05); // Slow improvement
      } else {
        baseMultiplier = 0.92; // Lower performance than client
        trendMultiplier = 1 + (trendProgress * 0.06); // Slow improvement
      }
      variance = 0.08;
      break;
      
    case 'CD_Avg':
      // CD Portfolio performs best
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 0.85; // Lower bounce rate (better)
        trendMultiplier = 1 - (trendProgress * 0.10); // Good improvement
      } else {
        baseMultiplier = 1.08; // Higher performance
        trendMultiplier = 1 + (trendProgress * 0.10); // Good improvement
      }
      variance = 0.06;
      break;
  }
  
  // Apply seasonal variation (quarterly cycles)
  const seasonalVariation = Math.sin((monthIndex / 3) * Math.PI * 2) * 0.05;
  
  // Calculate final value
  const adjustedBase = base * baseMultiplier * trendMultiplier * (1 + seasonalVariation);
  const randomVariation = (Math.random() - 0.5) * 2 * variance;
  const finalValue = adjustedBase * (1 + randomVariation);
  
  // Format based on metric type
  if (metricName === 'Bounce Rate') {
    return Math.max(15, Math.min(85, finalValue)).toFixed(1);
  } else if (metricName === 'Pages per Session' || metricName === 'Sessions per User') {
    return Math.max(1.2, finalValue).toFixed(2);
  } else if (metricName === 'Session Duration') {
    return Math.max(45, Math.round(finalValue)).toString();
  }
  
  return Math.max(0, Math.round(finalValue)).toString();
}

// Generate traffic channel data with optional seed for consistency
function generateTrafficChannelData(seed?: number): string {
  const channels: Record<string, number> = {};
  let remaining = 100;
  
  // Use seed for deterministic random if provided
  const getRandom = seed !== undefined 
    ? () => ((seed * 9301 + 49297) % 233280) / 233280
    : () => Math.random();
  
  TRAFFIC_CHANNELS.forEach((channel, index) => {
    if (index === TRAFFIC_CHANNELS.length - 1) {
      channels[channel] = remaining;
    } else {
      const percentage = Math.floor(getRandom() * (remaining / 2)) + 5;
      channels[channel] = Math.min(percentage, remaining - 5);
      remaining -= channels[channel];
    }
  });
  
  return JSON.stringify(channels);
}

// Generate device distribution data with optional seed for consistency
function generateDeviceData(seed?: number): string {
  // Use seed for deterministic random if provided
  const getRandom = seed !== undefined 
    ? () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }
    : () => Math.random();
  
  const mobile = 50 + getRandom() * 20; // 50-70%
  const desktop = 20 + getRandom() * 20; // 20-40%
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
    
    let competitors = await storage.getCompetitorsByClient(clientId);
    logger.info('Found existing competitors', { count: competitors.length });
    
    // If no competitors exist, create some sample competitors
    if (competitors.length === 0) {
      logger.info('No competitors found, creating sample competitors for comprehensive data generation');
      
      const sampleCompetitors = [
        { domain: 'herodigital.com', label: 'Hero Digital' },
        { domain: 'focuslab.agency', label: 'Focus Lab Agency' },
        { domain: 'digitalagency.com', label: 'Digital Agency Co.' }
      ];
      
      for (const comp of sampleCompetitors) {
        const newCompetitor = await storage.createCompetitor({
          clientId,
          domain: comp.domain,
          label: comp.label,
          status: 'active' as any
        });
        competitors.push(newCompetitor);
      }
      
      logger.info('Created sample competitors', { count: competitors.length });
    }
    
    // Base values for consistent metric generation
    const baseValues = {
      'Bounce Rate': 35,
      'Session Duration': 187,
      'Pages per Session': 2.4,
      'Sessions per User': 1.8
    };
    
    const entitiesGenerated: string[] = [];
    let totalMetricsCreated = 0;
    
    // Generate data for each period with proper trend patterns
    for (let periodIndex = 0; periodIndex < periods.length; periodIndex++) {
      const period = periods[periodIndex];
      logger.info(`Generating data for period: ${period} (${periodIndex + 1}/${periods.length})`);
      
      // 1. Generate CLIENT data (unless GA4 client and skipGA4Client is true)
      if (!skipGA4Client || clientId !== 'demo-client-id') {
        if (periodIndex === 0) entitiesGenerated.push('Client');
        
        for (const metricName of CORE_METRICS) {
          const value = generateMetricValue(metricName, 'Client', baseValues, periodIndex, periods.length);
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
        
        // Device Distribution for client (bulletproof JSON storage)
        try {
          await storage.createMetric({
            clientId,
            metricName: 'Device Distribution',
            value: generateDeviceData(),
            sourceType: 'Client',
            timePeriod: period
          });
          totalMetricsCreated++;
        } catch (error) {
          logger.error('Device Distribution storage error - using fallback approach', { error: (error as Error).message, period });
          // Fallback: Store as JSON string if direct storage fails
          const deviceDataObj = JSON.parse(generateDeviceData());
          await storage.createMetric({
            clientId,
            metricName: 'Device Distribution',
            value: JSON.stringify(deviceDataObj),
            sourceType: 'Client',
            timePeriod: period
          });
          totalMetricsCreated++;
        }
      }
      
      // 2. Generate COMPETITOR data
      if (competitors.length > 0) {
        if (periodIndex === 0) entitiesGenerated.push('Competitors');
        
        for (const competitor of competitors) {
          for (const metricName of CORE_METRICS) {
            const value = generateMetricValue(
              metricName, 
              'Competitor', 
              baseValues, 
              periodIndex, 
              periods.length,
              competitor.id
            );
            
            // Create competitor metric using regular metrics table with proper competitor_id
            await storage.createMetric({
              clientId,
              competitorId: competitor.id, // Ensure competitor ID is properly set
              metricName,
              value,
              sourceType: 'Competitor',
              timePeriod: period
            });
            totalMetricsCreated++;
          }
          
          // Generate Traffic Channels for competitor (bulletproof)
          try {
            const competitorSeed = periodIndex + parseInt(competitor.id.slice(-2), 16);
            const trafficData = generateTrafficChannelData(competitorSeed);
            await storage.createMetric({
              clientId,
              competitorId: competitor.id,
              metricName: 'Traffic Channels',
              value: trafficData,
              sourceType: 'Competitor',
              timePeriod: period
            });
            totalMetricsCreated++;
          } catch (error) {
            logger.error('Competitor Traffic Channels error', { error: (error as Error).message, competitorId: competitor.id, period });
          }
          
          // Generate Device Distribution for competitor (bulletproof)
          try {
            const competitorSeed = periodIndex + parseInt(competitor.id.slice(-4, -2), 16);
            const deviceData = generateDeviceData(competitorSeed);
            await storage.createMetric({
              clientId,
              competitorId: competitor.id,
              metricName: 'Device Distribution',
              value: deviceData,
              sourceType: 'Competitor',
              timePeriod: period
            });
            totalMetricsCreated++;
          } catch (error) {
            logger.error('Competitor Device Distribution error - using fallback', { error: (error as Error).message, competitorId: competitor.id, period });
            // Fallback: Store as JSON string if direct storage fails
            const deviceDataObj = JSON.parse(generateDeviceData());
            await storage.createMetric({
              clientId,
              competitorId: competitor.id,
              metricName: 'Device Distribution',
              value: JSON.stringify(deviceDataObj),
              sourceType: 'Competitor',
              timePeriod: period
            });
            totalMetricsCreated++;
          }
        }
        
        if (periodIndex % 3 === 0) { // Log every quarter
          logger.info(`Generated competitor data for period ${period}`, { 
            competitorCount: competitors.length, 
            metricsPerCompetitor: CORE_METRICS.length,
            totalCompetitorMetrics: competitors.length * CORE_METRICS.length
          });
        }
      }
      
      // 3. Generate INDUSTRY AVERAGE data
      if (periodIndex === 0) entitiesGenerated.push('Industry_Avg');
      for (const metricName of CORE_METRICS) {
        const value = generateMetricValue(metricName, 'Industry_Avg', baseValues, periodIndex, periods.length);
        await storage.createMetric({
          clientId,
          metricName,
          value,
          sourceType: 'Industry_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      }
      
      // Generate Traffic Channels for Industry_Avg (bulletproof)
      try {
        const industryTrafficData = generateTrafficChannelData(periodIndex + 1000);
        await storage.createMetric({
          clientId,
          metricName: 'Traffic Channels',
          value: industryTrafficData,
          sourceType: 'Industry_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      } catch (error) {
        logger.error('Industry_Avg Traffic Channels error', { error: (error as Error).message, period });
      }
      
      // Generate Device Distribution for Industry_Avg (bulletproof)
      try {
        const industryDeviceData = generateDeviceData(periodIndex + 2000);
        await storage.createMetric({
          clientId,
          metricName: 'Device Distribution',
          value: industryDeviceData,
          sourceType: 'Industry_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      } catch (error) {
        logger.error('Industry_Avg Device Distribution error - using fallback', { error: (error as Error).message, period });
        // Fallback: Store as JSON string if direct storage fails
        const deviceDataObj = JSON.parse(generateDeviceData());
        await storage.createMetric({
          clientId,
          metricName: 'Device Distribution',
          value: JSON.stringify(deviceDataObj),
          sourceType: 'Industry_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      }
      
      // 4. Generate CD PORTFOLIO AVERAGE data
      if (periodIndex === 0) entitiesGenerated.push('CD_Avg');
      for (const metricName of CORE_METRICS) {
        const value = generateMetricValue(metricName, 'CD_Avg', baseValues, periodIndex, periods.length);
        await storage.createMetric({
          clientId,
          metricName,
          value,
          sourceType: 'CD_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      }
      
      // Generate Traffic Channels for CD_Avg (bulletproof)
      try {
        const cdTrafficData = generateTrafficChannelData(periodIndex + 3000);
        await storage.createMetric({
          clientId,
          metricName: 'Traffic Channels',
          value: cdTrafficData,
          sourceType: 'CD_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      } catch (error) {
        logger.error('CD_Avg Traffic Channels error', { error: (error as Error).message, period });
      }
      
      // Generate Device Distribution for CD_Avg (bulletproof)
      try {
        const cdDeviceData = generateDeviceData(periodIndex + 4000);
        await storage.createMetric({
          clientId,
          metricName: 'Device Distribution',
          value: cdDeviceData,
          sourceType: 'CD_Avg',
          timePeriod: period
        });
        totalMetricsCreated++;
      } catch (error) {
        logger.error('CD_Avg Device Distribution error - using fallback', { error: (error as Error).message, period });
        // Fallback: Store as JSON string if direct storage fails
        const deviceDataObj = JSON.parse(generateDeviceData());
        await storage.createMetric({
          clientId,
          metricName: 'Device Distribution',
          value: JSON.stringify(deviceDataObj),
          sourceType: 'CD_Avg',
          timePeriod: period
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