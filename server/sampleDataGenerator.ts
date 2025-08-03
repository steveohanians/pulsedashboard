// Comprehensive sample data generator for all metrics and time periods
// 
// ARCHITECTURE CLARIFICATION:
// - Clients: Actual customers using the dashboard
// - CD Portfolio Companies: Clear Digital's client portfolio (generates CD_Avg benchmarks)
// - Benchmark Companies: Industry reference companies (generates Industry_Avg benchmarks)
// - Competitors: Client-specific competitor companies (generates Competitor data)
//
import { storage } from "./storage";
import logger from "./utils/logger";

interface MetricConfig {
  name: string;
  clientRange: [number, number];
  industryRange: [number, number];
  cdRange: [number, number];
  unit: string;
  isPercentage?: boolean;
  isComplex?: boolean;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    name: "Bounce Rate",
    clientRange: [28, 35], // GOOD: Client performs excellently (lower is better)
    industryRange: [45, 65],
    cdRange: [40, 60],
    unit: "%",
    isPercentage: true
  },
  {
    name: "Session Duration",
    clientRange: [150, 200], // BAD: Client performs poorly (lower than benchmarks)
    industryRange: [240, 320], // Industry performs better
    cdRange: [220, 300], // CD performs better
    unit: "seconds"
  },
  {
    name: "Pages per Session",
    clientRange: [2.2, 2.6], // NEEDS IMPROVEMENT: Client slightly below average
    industryRange: [2.8, 3.4],
    cdRange: [2.5, 3.1],
    unit: "pages"
  },
  {
    name: "Sessions per User",
    clientRange: [2.0, 2.6], // GOOD: Client performs well
    industryRange: [1.2, 1.8],
    cdRange: [1.4, 2.1],
    unit: "sessions"
  }
];

// Use centralized time period generation
import { generateTimePeriods } from './utils/timePeriodsGenerator';

const TIME_PERIODS = generateTimePeriods();
const SOURCE_TYPES = ["Client", "Industry_Avg", "CD_Avg"];

// Use centralized metric value generation with proper 15-month variations
import { generateMetricValue, METRIC_CONFIGS as CORE_CONFIGS } from './utils/dataGeneratorCore';





// Use centralized channel and device generation
import { generateTrafficChannels, generateDeviceDistribution } from './utils/channelDataGenerator';

function getChannelColor(channelName: string): string {
  const colors: Record<string, string> = {
    "Organic Search": "#10b981",
    "Direct": "#3b82f6", 
    "Social Media": "#8b5cf6",
    "Paid Search": "#f59e0b",
    "Email": "#ec4899"
  };
  return colors[channelName] || "#6b7280";
}

// Dynamic sample data generation based on actual companies
export async function generateDynamicBenchmarkData() {
  const { isSampleDataEnabled } = await import("./sampleDataConfig");
  
  if (!isSampleDataEnabled()) {
    logger.info("Sample data generation is disabled");
    return { success: false, message: "Sample data generation disabled" };
  }
  
  logger.info("Generating dynamic benchmark data based on actual companies");
  
  try {
    // Get actual CD Portfolio companies
    const cdPortfolioCompanies = await storage.getCdPortfolioCompanies();
    logger.info(`Found ${cdPortfolioCompanies.length} CD Portfolio companies`);
    
    // Get actual benchmark companies for all clients
    const clients = await storage.getClients();
    let totalBenchmarkCompanies = 0;
    
    for (const client of clients) {
      const benchmarkCompanies = await storage.getBenchmarkCompanies();
      totalBenchmarkCompanies += benchmarkCompanies.length;
    }
    
    logger.info(`Found ${totalBenchmarkCompanies} total benchmark companies across ${clients.length} clients`);
    
    // Generate CD_Avg metrics based on actual CD Portfolio companies
    if (cdPortfolioCompanies.length > 0) {
      await generateCdPortfolioMetrics(cdPortfolioCompanies);
    }
    
    // Generate Industry_Avg metrics dynamically
    await generateIndustryAverageMetrics();
    
    // Generate Client metrics for existing clients
    for (const client of clients) {
      await generateClientMetrics(client.id);
    }
    
    logger.info("Dynamic benchmark data generation completed successfully");
    return { 
      success: true, 
      message: `Generated data for ${clients.length} clients, ${cdPortfolioCompanies.length} CD portfolio companies, ${totalBenchmarkCompanies} benchmark companies`
    };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating dynamic benchmark data", { error: err.message, stack: err.stack });
    throw error;
  }
}

export async function generateComprehensiveSampleData() {
  const { isSampleDataEnabled } = await import("./sampleDataConfig");
  
  if (!isSampleDataEnabled()) {
    logger.info("Sample data generation is disabled");
    return { success: false, message: "Sample data generation disabled" };
  }
  
  logger.info("Generating comprehensive sample data with business size and industry variations");
  
  const { getDefaultClientId } = await import('./config');
  const clientId = getDefaultClientId();
  
  try {
    // Get all entities for variation generation
    const clients = await storage.getClients();
    const benchmarkCompanies = await storage.getBenchmarkCompanies();
    const cdPortfolioCompanies = await storage.getCdPortfolioCompanies();
    // Get competitors by querying all competitors for the demo client
    const competitors = await storage.getCompetitorsByClient(clientId);
    
    logger.info(`Generating data for: ${clients.length} clients, ${benchmarkCompanies.length} benchmark companies, ${cdPortfolioCompanies.length} CD portfolio companies, ${competitors.length} competitors`);
    
    // Generate Client metrics with business size and industry variations
    for (const client of clients) {
      await generateMetricsForEntity(client, 'Client', TIME_PERIODS, client.businessSize, client.industryVertical);
    }
    
    // Generate benchmark company metrics with variations
    for (const company of benchmarkCompanies) {
      await generateMetricsForEntity({ id: company.id, clientId }, 'Industry_Avg', TIME_PERIODS, company.businessSize, company.industryVertical);
    }
    
    // Generate CD Portfolio company metrics with variations
    for (const company of cdPortfolioCompanies) {
      await generateMetricsForEntity({ id: company.id, clientId }, 'CD_Avg', TIME_PERIODS, company.businessSize, company.industryVertical);
    }
    
    // Generate competitor metrics with variations
    for (const competitor of competitors) {
      await generateCompetitorMetrics(competitor, TIME_PERIODS);
    }
    
    logger.info("Sample data generation completed successfully");
    return { success: true, message: "Comprehensive sample data generated with business size and industry variations" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating sample data", { error: err.message, stack: err.stack });
    throw error;
  }
}

// Generate metrics for any entity with business size and industry variations
async function generateMetricsForEntity(
  entity: any, 
  sourceType: string, 
  timePeriods: string[], 
  businessSize?: string, 
  industryVertical?: string
) {
  // Use entity's clientId directly for clients, otherwise use the provided clientId
  const clientId = sourceType === 'Client' ? entity.id : entity.clientId;
  
  for (const timePeriod of timePeriods) {
    // Generate standard metrics using centralized system with business/industry variations
    for (const config of CORE_CONFIGS) {
      const value = generateMetricValue(config, sourceType, timePeriod, timePeriods, businessSize, industryVertical);
      const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
        ? Math.round(value * 10) / 10 
        : Math.round(value);
      
      await storage.createMetric({
        clientId,
        metricName: config.name,
        value: finalValue.toString(),
        sourceType: sourceType as any,
        timePeriod
      });
    }
    
    // Generate traffic and device data with variations
    const periodSeed = timePeriod.charCodeAt(0) + (businessSize?.charCodeAt(0) || 0) + (industryVertical?.charCodeAt(0) || 0);
    
    const trafficChannels = generateTrafficChannels(periodSeed + 100);
    for (const channel of trafficChannels) {
      await storage.createMetric({
        clientId,
        metricName: "Traffic Channels",
        value: channel.value.toString(),
        sourceType: sourceType as any,
        timePeriod,
        channel: channel.name
      });
    }
    
    const deviceData = generateDeviceDistribution(periodSeed + 200);
    for (const device of deviceData) {
      await storage.createMetric({
        clientId,
        metricName: "Device Distribution",
        value: device.value.toString(),
        sourceType: sourceType as any,
        timePeriod,
        channel: device.name
      });
    }
  }
}

// Generate competitor metrics with proper variations
async function generateCompetitorMetrics(competitor: any, timePeriods: string[]) {
  const { getDefaultClientId } = await import('./config');
  const clientId = getDefaultClientId();
  
  for (const timePeriod of timePeriods) {
    // Generate competitor metrics with competitor-specific variations
    for (const config of CORE_CONFIGS) {
      // Use Competitor range but with competitor-specific seed
      const value = generateMetricValue(config, 'Client', timePeriod, timePeriods, undefined, undefined, competitor.id);
      const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
        ? Math.round(value * 10) / 10 
        : Math.round(value);
      
      await storage.createMetric({
        clientId,
        metricName: config.name,
        value: finalValue.toString(),
        sourceType: 'Competitor' as any,
        timePeriod,
        competitorId: competitor.id
      });
    }
    
    // Generate traffic and device data for competitors
    const competitorSeed = timePeriod.charCodeAt(0) + competitor.id.charCodeAt(0) * 17;
    
    const trafficChannels = generateTrafficChannels(competitorSeed + 300);
    for (const channel of trafficChannels) {
      await storage.createMetric({
        clientId,
        metricName: "Traffic Channels",
        value: channel.value.toString(),
        sourceType: 'Competitor' as any,
        timePeriod,
        channel: channel.name,
        competitorId: competitor.id
      });
    }
    
    const deviceData = generateDeviceDistribution(competitorSeed + 400);
    for (const device of deviceData) {
      await storage.createMetric({
        clientId,
        metricName: "Device Distribution",
        value: device.value.toString(),
        sourceType: 'Competitor' as any,
        timePeriod,
        channel: device.name,
        competitorId: competitor.id
      });
    }
  }
}



// Generate metrics for CD Portfolio companies to create realistic CD_Avg benchmarks
async function generateCdPortfolioMetrics(cdPortfolioCompanies: any[]) {
  logger.info("Generating CD Portfolio company metrics");
  
  for (const timePeriod of TIME_PERIODS) {
    const periodSeed = timePeriod.charCodeAt(0) + timePeriod.charCodeAt(1);
    
    // Calculate weighted averages across CD Portfolio companies
    for (const config of METRIC_CONFIGS) {
      let totalValue = 0;
      let companyCount = 0;
      
      // Generate values for each CD Portfolio company and calculate average
      for (const company of cdPortfolioCompanies) {
        const companySeed = periodSeed + company.name.charCodeAt(0);
        const companyValue = generateMetricValue(config.cdRange, companySeed + config.name.charCodeAt(0));
        totalValue += companyValue;
        companyCount++;
      }
      
      const avgValue = companyCount > 0 ? totalValue / companyCount : generateMetricValue(config.cdRange, periodSeed);
      const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
        ? Math.round(avgValue * 10) / 10 
        : Math.round(avgValue);
      
      const { getDefaultClientId } = await import('./config');
      await storage.createMetric({
        clientId: getDefaultClientId(), // Configurable demo client ID
        metricName: config.name,
        value: typeof finalValue === 'string' ? finalValue : finalValue.toString(),
        sourceType: "CD_Avg",
        timePeriod
      });
    }
    
    // Generate aggregated traffic channels and device data
    await generateAggregatedChannelData(cdPortfolioCompanies, "CD_Avg", timePeriod, periodSeed);
  }
}

// Generate industry averages dynamically based on industry types of companies
async function generateIndustryAverageMetrics() {
  logger.info("Generating industry average metrics");
  
  for (const timePeriod of TIME_PERIODS) {
    const periodSeed = timePeriod.charCodeAt(0) + timePeriod.charCodeAt(1);
    
    for (const config of METRIC_CONFIGS) {
      const value = generateMetricValue(config.industryRange, periodSeed + config.name.charCodeAt(0));
      const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
        ? Math.round(value * 10) / 10 
        : Math.round(value);
      
      const { getDefaultClientId } = await import('./config');
      await storage.createMetric({
        clientId: getDefaultClientId(),
        metricName: config.name,
        value: typeof finalValue === 'string' ? finalValue : finalValue.toString(),
        sourceType: "Industry_Avg",
        timePeriod
      });
    }
    
    await generateAggregatedChannelData([], "Industry_Avg", timePeriod, periodSeed);
  }
}

// Generate client-specific metrics
async function generateClientMetrics(clientId: string) {
  logger.info(`Generating client metrics for ${clientId}`);
  
  for (const timePeriod of TIME_PERIODS) {
    const periodSeed = timePeriod.charCodeAt(0) + clientId.charCodeAt(0);
    
    for (const config of METRIC_CONFIGS) {
      const value = generateMetricValue(config.clientRange, periodSeed + config.name.charCodeAt(0));
      const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
        ? Math.round(value * 10) / 10 
        : Math.round(value);
      
      await storage.createMetric({
        clientId,
        metricName: config.name,
        value: finalValue,
        sourceType: "Client",
        timePeriod
      });
    }
    
    await generateAggregatedChannelData([], "Client", timePeriod, periodSeed, clientId);
  }
}

// Generate aggregated channel and device data
async function generateAggregatedChannelData(companies: any[], sourceType: string, timePeriod: string, seed: number, clientId?: string) {
  const { getDefaultClientId } = await import('./config');
  const finalClientId = clientId || getDefaultClientId();
  // Generate Traffic Channels data
  const trafficChannels = generateTrafficChannels(seed + 100);
  for (const channel of trafficChannels) {
    await storage.createMetric({
      clientId: finalClientId,
      metricName: "Traffic Channels",
      value: channel.value,
      sourceType: sourceType as any,
      timePeriod,
      channel: channel.name
    });
  }
  
  // Generate Device Distribution data
  const deviceData = generateDeviceDistribution(seed + 200);
  for (const device of deviceData) {
    await storage.createMetric({
      clientId: finalClientId,
      metricName: "Device Distribution",
      value: device.value,
      sourceType: sourceType as any,
      timePeriod,
      channel: device.name
    });
  }
}

// Auto-generate data when new benchmark company is added
export async function generateDataForNewBenchmarkCompany(companyId: string) {
  const { shouldGenerateForNewCompanies } = await import("./sampleDataConfig");
  
  if (!shouldGenerateForNewCompanies()) {
    logger.info("Auto-generation disabled for new benchmark companies");
    return { success: false, message: "Auto-generation disabled" };
  }
  
  logger.info(`Auto-generating data for new benchmark company: ${companyId}`);
  
  try {
    // Regenerate Industry_Avg benchmarks with the new company included
    await generateIndustryAverageMetrics();
    
    logger.info("Successfully updated Industry_Avg benchmarks with new company");
    return { success: true, message: "Industry_Avg benchmarks updated with 15 months of data" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating data for new benchmark company", { error: err.message, companyId });
    throw error;
  }
}

// Auto-generate data when new CD Portfolio company is added
export async function generateDataForNewCdPortfolioCompany(companyId: string) {
  const { shouldGenerateForNewCompanies } = await import("./sampleDataConfig");
  
  if (!shouldGenerateForNewCompanies()) {
    logger.info("Auto-generation disabled for new CD Portfolio companies");
    return { success: false, message: "Auto-generation disabled" };
  }
  
  logger.info(`Auto-generating data for new CD Portfolio company: ${companyId}`);
  
  try {
    // Regenerate CD_Avg benchmarks with the new company included
    const cdPortfolioCompanies = await storage.getCdPortfolioCompanies();
    await generateCdPortfolioMetrics(cdPortfolioCompanies);
    
    logger.info("Successfully updated CD Portfolio benchmarks with new company");
    return { success: true, message: "CD Portfolio benchmarks updated" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating data for new CD Portfolio company", { error: err.message, companyId });
    throw error;
  }
}

// Auto-generate data when new competitor is added
export async function generateDataForNewCompetitor(competitorId: string, clientId: string) {
  const { shouldGenerateForNewCompanies } = await import("./sampleDataConfig");
  
  if (!shouldGenerateForNewCompanies()) {
    logger.info("Auto-generation disabled for new competitors");
    return { success: false, message: "Auto-generation disabled" };
  }
  
  logger.info(`Auto-generating data for new competitor: ${competitorId} (client: ${clientId})`);
  
  try {
    // Generate sample metrics for the new competitor
    // Use full 15-month time periods for consistency
    const timePeriods = TIME_PERIODS;

    const metricNames = ["Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User"];
    
    for (const period of timePeriods) {
      const periodSeed = period.charCodeAt(0) + competitorId.charCodeAt(0);
      
      for (const metricName of metricNames) {
        const config = METRIC_CONFIGS.find(c => c.name === metricName);
        if (!config) continue;
        
        // Generate values in industry range for competitors
        const value = generateMetricValue(config.industryRange, periodSeed + metricName.charCodeAt(0));
        const finalValue = metricName === "Pages per Session" || metricName === "Sessions per User" 
          ? Math.round(value * 10) / 10 
          : Math.round(value);
        
        await storage.createMetric({
          clientId: clientId,
          competitorId: competitorId,
          metricName,
          value: finalValue.toString(),
          timePeriod: period,
          sourceType: "Competitor"
        });
      }
      
      // Generate Traffic Channels and Device Distribution data for competitors
      await generateCompetitorChannelData(competitorId, clientId, period, periodSeed);
    }
    
    logger.info("Successfully generated data for new competitor");
    return { success: true, message: "Competitor data generated" };
    
  } catch (error) {
    const err = error as Error;
    logger.error("Error generating data for new competitor", { error: err.message, competitorId });
    throw error;
  }
}

// Generate channel data for competitors (Traffic Channels and Device Distribution)
async function generateCompetitorChannelData(competitorId: string, clientId: string, timePeriod: string, seed: number) {
  // Traffic Channels
  const trafficChannels = generateTrafficChannels(seed + 100);
  for (const channel of trafficChannels) {
    await storage.createMetric({
      clientId: clientId,
      competitorId: competitorId,
      metricName: "Traffic Channels",
      value: channel.value.toString(),
      sourceType: "Competitor",
      timePeriod,
      channel: channel.name
    });
  }
  
  // Device Distribution
  const deviceData = generateDeviceDistribution(seed + 200);
  for (const device of deviceData) {
    await storage.createMetric({
      clientId: clientId,
      competitorId: competitorId,
      metricName: "Device Distribution",
      value: device.value.toString(),
      sourceType: "Competitor",
      timePeriod,
      channel: device.name
    });
  }
}
// Run generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateComprehensiveSampleData()
    .then(result => {
      logger.info("Generation completed:", result);
      process.exit(0);
    })
    .catch(error => {
      logger.error("Generation failed:", error);
      process.exit(1);
    });
}
