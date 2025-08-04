#!/usr/bin/env tsx

/**
 * Script to generate 15-month historical data for demo-client-id
 * Following business logic: July 2025 as most recent completed month
 */

import { SampleDataManager } from '../server/services/sampleData/SampleDataManager';
import logger from '../server/utils/logger';

async function generateDemoData() {
  try {
    logger.info('Starting manual demo data generation');
    
    const sampleDataManager = new SampleDataManager();
    
    const result = await sampleDataManager.generateSampleData({
      clientId: 'demo-client-id',
      periods: 15,
      forceGeneration: true,
      skipGA4Check: true // Demo client doesn't need GA4 validation
    });
    
    if (result.success) {
      logger.info('Demo data generation completed successfully', {
        periodsGenerated: result.periodsGenerated,
        metricsCreated: result.metricsCreated,
        competitorsGenerated: result.competitorsGenerated
      });
      
      console.log('✅ Demo data generation completed successfully');
      console.log(`📊 Periods generated: ${result.periodsGenerated}`);
      console.log(`📈 Metrics created: ${result.metricsCreated}`);
      console.log(`🏢 Competitors generated: ${result.competitorsGenerated}`);
    } else {
      logger.error('Demo data generation failed', { errors: result.errors });
      console.error('❌ Demo data generation failed');
      console.error('Errors:', result.errors);
    }
    
  } catch (error) {
    logger.error('Error in demo data generation script', { error: (error as Error).message });
    console.error('❌ Script error:', (error as Error).message);
  }
  
  process.exit(0);
}

generateDemoData();