#!/usr/bin/env tsx

import { storage } from '../server/storage.ts';
import { PortfolioIntegration } from '../server/services/semrush/portfolioIntegration.ts';
import logger from '../server/utils/logger.ts';

async function regenerateCohesityData() {
  logger.info('Starting Cohesity data regeneration with fixed SEMrush integration');

  try {
    // Use existing storage instance
    
    // Initialize portfolio integration
    const portfolioIntegration = new PortfolioIntegration(storage);
    
    // Get Cohesity company
    const companies = await storage.getCdPortfolioCompanies();
    const cohesity = companies.find(c => c.name === 'Cohesity');
    
    if (!cohesity) {
      throw new Error('Cohesity company not found');
    }
    
    logger.info('Found Cohesity company', { 
      id: cohesity.id, 
      name: cohesity.name, 
      websiteUrl: cohesity.websiteUrl 
    });
    
    // Process Cohesity with new SEMrush integration (includes date parameters)
    const result = await portfolioIntegration.processNewPortfolioCompany(cohesity);
    
    if (result.success) {
      logger.info('Successfully regenerated Cohesity data', {
        periodsProcessed: result.periodsProcessed,
        metricsStored: result.metricsStored,
        trafficChannelsStored: result.trafficChannelsStored,
        deviceDistributionStored: result.deviceDistributionStored,
        averagesUpdated: result.averagesUpdated
      });
    } else {
      logger.error('Failed to regenerate Cohesity data', { error: result.error });
    }

  } catch (error) {
    logger.error('Script execution failed', { 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
regenerateCohesityData();