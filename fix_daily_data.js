/**
 * Fix daily data for July 2025 to restore intra-month variations
 */

import { GA4DataManager } from './server/services/ga4/GA4DataManager.js';
import logger from './server/utils/logger.js';

async function fixDailyData() {
  try {
    console.log('🔧 Fixing daily data for July 2025...');
    
    const ga4Manager = new GA4DataManager();
    const clientId = 'demo-client-id';
    const period = '2025-07';
    const startDate = '2025-07-01';
    const endDate = '2025-07-31';
    
    // Fetch daily data for July 2025
    const dailyData = await ga4Manager.fetchDailyData(clientId, startDate, endDate, period);
    
    if (dailyData && dailyData.length > 0) {
      console.log(`✅ Successfully fetched ${dailyData.length} days of data for July 2025`);
      console.log('📊 Sample data:', dailyData.slice(0, 3).map(day => ({
        date: day.date,
        bounceRate: `${day.metrics.bounceRate.toFixed(1)}%`,
        sessionDuration: `${day.metrics.sessionDuration.toFixed(0)}s`
      })));
    } else {
      console.log('❌ No daily data fetched');
    }
    
  } catch (error) {
    console.error('❌ Error fixing daily data:', error.message);
  }
}

fixDailyData();