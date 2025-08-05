#!/usr/bin/env tsx

import { GA4DataManager } from '../server/services/ga4/GA4DataManager.js';
import logger from '../server/utils/logger.js';

async function executeGA4Sync() {
  try {
    logger.info('🚀 Starting complete GA4 data sync for Demo Company');
    
    const ga4Manager = new GA4DataManager();
    const clientId = 'demo-client-id'; // Demo Company client ID
    
    const result = await ga4Manager.executeCompleteGA4DataSync(clientId);
    
    logger.info('📊 GA4 Sync Results:', {
      success: result.success,
      summary: result.summary,
      periodsProcessed: result.periodsProcessed,
      dailyDataPeriods: result.dailyDataPeriods.length,
      monthlyDataPeriods: result.monthlyDataPeriods.length,
      errors: result.errors,
      chartsRefreshed: result.chartsRefreshed
    });
    
    if (result.success) {
      logger.info('✅ GA4 data sync completed successfully for Demo Company');
    } else {
      logger.error('❌ GA4 data sync failed for Demo Company', { errors: result.errors });
    }
    
  } catch (error) {
    logger.error('💥 Critical error during GA4 sync execution', { error: (error as Error).message });
    process.exit(1);
  }
}

executeGA4Sync();