import { storage } from '../storage';
import { GA4DataService } from '../services/ga4DataService';
import logger from '../utils/logger';

/**
 * Replace all synthetic data with authentic GA4 data for demo-client-id
 * This script clears synthetic data and fetches real GA4 data for 15 months
 */
async function replaceWithAuthenticData() {
  try {
    const clientId = 'demo-client-id';
    logger.info(`Starting replacement of synthetic data with authentic GA4 data for ${clientId}`);
    
    // Step 1: Clear all synthetic monthly data (keep daily July 2025 data)
    await storage.db.delete(storage.metrics).where(
      storage.and(
        storage.eq(storage.metrics.clientId, clientId),
        storage.not(storage.like(storage.metrics.timePeriod, '%-daily-%'))
      )
    );
    
    logger.info('Cleared all synthetic monthly data');
    
    // Step 2: Fetch authentic GA4 data for 15 historical months
    const ga4Service = new GA4DataService();
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    // Generate periods for last 15 months
    const periods = [];
    const now = new Date();
    
    for (let i = 0; i < 15; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      periods.push({ period, year, month });
    }
    
    // Fetch data for each period
    for (const periodInfo of periods) {
      try {
        const startDate = `${periodInfo.year}-${periodInfo.month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(periodInfo.year, periodInfo.month, 0).toISOString().split('T')[0];
        
        logger.info(`Fetching authentic GA4 data for ${periodInfo.period}`);
        
        const success = await ga4Service.fetchAndStoreMonthlyData(
          clientId, 
          periodInfo.period, 
          startDate, 
          endDate
        );
        
        if (success) {
          results.successful++;
          logger.info(`✅ Successfully fetched authentic data for ${periodInfo.period}`);
        } else {
          results.failed++;
          results.errors.push(`Failed to fetch data for ${periodInfo.period}`);
          logger.warn(`❌ Failed to fetch data for ${periodInfo.period}`);
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Error fetching ${periodInfo.period}: ${error}`);
        logger.error(`❌ Error fetching data for ${periodInfo.period}:`, error);
      }
    }
    
    logger.info('Authentic data replacement completed', results);
    return results;
    
  } catch (error) {
    logger.error('Failed to replace synthetic data with authentic data:', error);
    throw error;
  }
}

// Run the replacement if this script is called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  replaceWithAuthenticData()
    .then(results => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Replacement failed:', error);
      process.exit(1);
    });
}

export { replaceWithAuthenticData };