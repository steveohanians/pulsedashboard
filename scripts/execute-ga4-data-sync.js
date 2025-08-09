#!/usr/bin/env node
/**
 * Execute Complete GA4 Data Sync for Demo Client
 * Restores all GA4 data for demo-client-id using the executeCompleteGA4DataSync utility
 */

import { GA4DataManager } from '../server/services/ga4/index.js';
import logger from '../server/utils/logger.js';

async function executeGA4DataSync() {
  const clientId = 'demo-client-id';
  
  console.log(`🚀 Executing Complete GA4 Data Sync for client: ${clientId}`);
  console.log('This will restore all 15 months of GA4 data...\n');

  try {
    // Create GA4 Data Manager instance
    const ga4Manager = new GA4DataManager();
    
    // Execute the complete data sync
    const result = await ga4Manager.executeCompleteGA4DataSync(clientId);
    
    // Display results
    console.log('\n📊 SYNC RESULTS:');
    console.log('================');
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Summary: ${result.summary}`);
    console.log(`Periods Processed: ${result.periodsProcessed}`);
    console.log(`Daily Data Periods: ${result.dailyDataPeriods.length}`);
    console.log(`Monthly Data Periods: ${result.monthlyDataPeriods.length}`);
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      result.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (result.chartsRefreshed.length > 0) {
      console.log(`\n📈 Charts Refreshed:`);
      result.chartsRefreshed.forEach(chart => console.log(`   • ${chart}`));
    }
    
    console.log('\n🎉 GA4 Data Sync Complete!');
    console.log('The dashboard should now show client metrics alongside competitor data.');
    
    if (!result.success) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    logger.error('GA4 Data Sync Script Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  executeGA4DataSync().then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  });
}

export { executeGA4DataSync };