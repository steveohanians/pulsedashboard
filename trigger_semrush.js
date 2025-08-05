// Manually trigger SEMrush integration for existing Cohesity company
import { drizzleDb as db } from './server/db/connection.ts';
import { Storage } from './server/storage.ts';
import { PortfolioIntegration } from './server/services/semrush/portfolioIntegration.ts';

async function triggerSEMrushIntegration() {
  console.log('🚀 Starting manual SEMrush integration for Cohesity...');
  
  try {
    const storage = new Storage();
    const portfolioIntegration = new PortfolioIntegration(storage);
    
    // Get the current Cohesity company
    const companies = await storage.getCdPortfolioCompanies();
    const cohesity = companies.find(c => c.name === 'Cohesity');
    
    if (!cohesity) {
      console.error('❌ Cohesity company not found');
      return;
    }
    
    console.log(`📊 Found Cohesity company: ${cohesity.id}`);
    console.log(`🌐 Website URL: ${cohesity.websiteUrl}`);
    
    // Trigger SEMrush integration
    const result = await portfolioIntegration.processNewPortfolioCompany(cohesity);
    
    if (result.success) {
      console.log('✅ SEMrush integration completed successfully!');
      console.log(`📈 Metrics stored: ${result.metricsStored}`);
      console.log(`📊 Traffic channels: ${result.trafficChannelsStored}`);
      console.log(`📱 Device distribution: ${result.deviceDistributionStored}`);
      console.log(`🎯 Averages updated: ${result.averagesUpdated}`);
    } else {
      console.error('❌ SEMrush integration failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Error running SEMrush integration:', error.message);
  }
  
  process.exit(0);
}

triggerSEMrushIntegration();