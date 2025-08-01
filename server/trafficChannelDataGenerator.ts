import { storage } from './storage';
import logger from "./utils/logger";

// Generate realistic traffic channel data for client, industry averages, and CD averages
export async function generateTrafficChannelData(clientId: string) {
  await storage.clearMetricsByName('Traffic Channels');
  
  const channels = [
    'Organic Search',
    'Direct', 
    'Social Media',
    'Paid Search',
    'Email'
  ];
  
  const timePeriods = ['2024-01', '2024-10', '2025-04', '2025-05', '2025-06'];
  
  for (const period of timePeriods) {
    // Client data - realistic distribution with some variation per period
    const clientBaseDistribution = {
      'Organic Search': 42,
      'Direct': 28,
      'Social Media': 18,
      'Paid Search': 8,
      'Email': 4
    };
    
    // Add period-based variation
    const periodVariance = period === '2025-06' ? 0 : 
                          period === '2025-05' ? -2 : 
                          period === '2025-04' ? 3 :
                          period === '2024-10' ? -1 : 2;
    
    let clientChannels = Object.entries(clientBaseDistribution).map(([channel, base]) => {
      let value = base;
      if (channel === 'Organic Search') value += periodVariance;
      else if (channel === 'Direct') value -= Math.floor(periodVariance / 2);
      else if (channel === 'Social Media') value += Math.floor(periodVariance / 3);
      
      return { channel, value: Math.max(1, value) };
    });
    
    // Normalize to 100%
    const clientTotal = clientChannels.reduce((sum, c) => sum + c.value, 0);
    clientChannels = clientChannels.map(c => ({
      ...c,
      value: Math.round((c.value / clientTotal) * 100)
    }));
    
    // Ensure it adds to 100
    const clientSum = clientChannels.reduce((sum, c) => sum + c.value, 0);
    if (clientSum !== 100) {
      clientChannels[0].value += (100 - clientSum);
    }
    
    // Industry Average data - different distribution
    const industryBaseDistribution = {
      'Organic Search': 45,
      'Direct': 22,
      'Social Media': 15,
      'Paid Search': 12,
      'Email': 6
    };
    
    let industryChannels = Object.entries(industryBaseDistribution).map(([channel, base]) => {
      return { channel, value: base };
    });
    
    // CD Client Average data - between client and industry
    const cdBaseDistribution = {
      'Organic Search': 44,
      'Direct': 25,
      'Social Media': 16,
      'Paid Search': 10,
      'Email': 5
    };
    
    let cdChannels = Object.entries(cdBaseDistribution).map(([channel, base]) => {
      return { channel, value: base };
    });
    
    // Insert client data
    for (const channelData of clientChannels) {
      await storage.createMetric({
        clientId,
        metricName: 'Traffic Channels',
        value: channelData.value.toString(),
        sourceType: 'Client',
        timePeriod: period,
        channel: channelData.channel
      });
    }
    
    // Insert industry average data
    for (const channelData of industryChannels) {
      await storage.createMetric({
        clientId,
        metricName: 'Traffic Channels',
        value: channelData.value.toString(),
        sourceType: 'Industry_Avg',
        timePeriod: period,
        channel: channelData.channel
      });
    }
    
    // Insert CD client average data
    for (const channelData of cdChannels) {
      await storage.createMetric({
        clientId,
        metricName: 'Traffic Channels',
        value: channelData.value.toString(),
        sourceType: 'CD_Avg',
        timePeriod: period,
        channel: channelData.channel
      });
    }
  }
  
  logger.info('Traffic channel data generated successfully');
}

// Generate competitor traffic channel data
export async function generateCompetitorTrafficChannelData(competitorId: string, clientId: string) {
  const channels = [
    'Organic Search',
    'Direct', 
    'Social Media',
    'Paid Search',
    'Email'
  ];
  
  const timePeriods = ['2024-01', '2024-10', '2025-04', '2025-05', '2025-06'];
  
  // Use competitor ID to create consistent but varied data
  const seed = competitorId.charCodeAt(0) + competitorId.length;
  
  for (const period of timePeriods) {
    // Generate varied but realistic competitor distribution
    const baseDistribution = {
      'Organic Search': 40 + (seed % 10),
      'Direct': 20 + (seed % 8),
      'Social Media': 12 + (seed % 12),
      'Paid Search': 15 + (seed % 6),
      'Email': 3 + (seed % 4)
    };
    
    let competitorChannels = Object.entries(baseDistribution).map(([channel, base]) => {
      return { channel, value: base };
    });
    
    // Normalize to 100%
    const total = competitorChannels.reduce((sum, c) => sum + c.value, 0);
    competitorChannels = competitorChannels.map(c => ({
      ...c,
      value: Math.round((c.value / total) * 100)
    }));
    
    // Ensure it adds to 100
    const sum = competitorChannels.reduce((sum, c) => sum + c.value, 0);
    if (sum !== 100) {
      competitorChannels[0].value += (100 - sum);
    }
    
    // Insert competitor data
    for (const channelData of competitorChannels) {
      await storage.createMetric({
        clientId,
        competitorId,
        metricName: 'Traffic Channels',
        value: channelData.value.toString(),
        sourceType: 'Competitor',
        timePeriod: period,
        channel: channelData.channel
      });
    }
  }
}