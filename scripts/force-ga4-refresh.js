#!/usr/bin/env node
/**
 * Force GA4 Data Refresh Script
 * Directly calls the GA4 service to refresh data for demo-client-id
 */

import { db } from '../server/db.js';
import { ga4DataService } from '../server/services/ga4DataService.js';
import logger from '../server/utils/logger.js';

async function forceGA4Refresh() {
  console.log('🔄 Force refreshing GA4 data for demo-client-id...');
  
  try {
    // Clear existing client data for current period
    const currentDate = new Date();
    const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`📅 Refreshing data for period: ${period}`);
    
    // Get date range for current period
    const { startDate, endDate } = ga4DataService.getDateRangeForPeriod(period);
    console.log(`📊 Date range: ${startDate} to ${endDate}`);
    
    // Fetch fresh GA4 data
    const ga4Data = await ga4DataService.fetchGA4Data('demo-client-id', startDate, endDate);
    
    if (!ga4Data) {
      console.error('❌ No GA4 data available');
      return;
    }
    
    console.log('✅ Fresh GA4 data fetched:');
    console.log(`   Bounce Rate: ${ga4Data.bounceRate.toFixed(1)}%`);
    console.log(`   Session Duration: ${ga4Data.sessionDuration.toFixed(0)}s`);
    console.log(`   Pages per Session: ${ga4Data.pagesPerSession.toFixed(2)}`);
    console.log(`   Sessions per User: ${ga4Data.sessionsPerUser.toFixed(2)}`);
    console.log(`   Total Sessions: ${ga4Data.totalSessions}`);
    console.log(`   Total Users: ${ga4Data.totalUsers}`);
    console.log(`   Traffic Channels: ${ga4Data.trafficChannels.length}`);
    console.log(`   Device Types: ${ga4Data.deviceDistribution.length}`);
    
    // Store the refreshed data
    await ga4DataService.storeGA4Metrics('demo-client-id', period, ga4Data);
    
    console.log('💾 Data successfully stored in database');
    console.log('🎉 GA4 data refresh completed!');
    
  } catch (error) {
    console.error('❌ GA4 refresh failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  forceGA4Refresh().then(() => process.exit(0));
}

export { forceGA4Refresh };