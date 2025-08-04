import { storage } from '../storage.js';
import { GA4DataService } from '../services/ga4DataService.js';
import logger from '../utils/logger.js';

/**
 * Populate all 15 months of historical GA4 data for demo-client-id
 */
async function populateHistoricalData() {
  try {
    const clientId = 'demo-client-id';
    const ga4Service = new GA4DataService();
    
    // Generate 15 months of historical periods (April 2024 through August 2025)
    const periods = [];
    const baseDate = new Date('2025-08-01'); // Start from August 2025 and go back
    
    for (let i = 0; i < 15; i++) {
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      periods.push({ period, year, month });
    }
    
    logger.info(`Starting historical data population for ${periods.length} periods`, {
      periods: periods.map(p => p.period)
    });
    
    let successful = 0;
    let skipped = 0;
    
    for (const periodInfo of periods) {
      try {
        // Check if we already have data for this period
        const existingMetrics = await storage.getMetricsByClient(clientId, periodInfo.period);
        const hasClientData = existingMetrics.some(m => m.sourceType === 'Client');
        
        if (hasClientData) {
          logger.info(`Skipping ${periodInfo.period} - already has client data`);
          skipped++;
          continue;
        }
        
        const startDate = `${periodInfo.year}-${periodInfo.month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(periodInfo.year, periodInfo.month, 0).toISOString().split('T')[0];
        
        logger.info(`Fetching GA4 data for ${periodInfo.period} (${startDate} to ${endDate})`);
        
        const success = await ga4Service.fetchAndStoreMonthlyData(
          clientId, 
          periodInfo.period, 
          startDate, 
          endDate
        );
        
        if (success) {
          successful++;
          logger.info(`✅ Successfully fetched data for ${periodInfo.period}`);
        } else {
          logger.warn(`❌ Failed to fetch data for ${periodInfo.period}`);
        }
        
        // Add small delay to avoid overwhelming the GA4 API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Error processing ${periodInfo.period}:`, error);
      }
    }
    
    const result = { successful, skipped, total: periods.length };
    logger.info('Historical data population completed', result);
    return result;
    
  } catch (error) {
    logger.error('Failed to populate historical data:', error);
    throw error;
  }
}

// Export for use in other modules
export { populateHistoricalData };

// Run directly if called as script
const isMainModule = process.argv[1]?.includes('populateHistoricalData.ts');
if (isMainModule) {
  populateHistoricalData()
    .then(result => {
      console.log('✅ Historical data population completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Population failed:', error);
      process.exit(1);
    });
}