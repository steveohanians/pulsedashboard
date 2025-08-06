// Manual competitor synchronization script
import { DatabaseStorage } from './server/storage.js';
import { CompetitorIntegration } from './server/services/semrush/competitorIntegration.js';

async function syncCompetitor() {
  const storage = new DatabaseStorage();
  const integration = new CompetitorIntegration(storage);
  
  // Get the competitor that needs sync
  const competitor = await storage.getCompetitor('dc0250db-6375-4cb3-ab09-eaf98a125c16');
  
  if (!competitor) {
    console.log('❌ Competitor not found');
    return;
  }
  
  console.log('🚀 Starting manual SEMrush sync for:', competitor.label);
  
  try {
    const result = await integration.processNewCompetitor(competitor);
    console.log('✅ Sync completed:', result);
  } catch (error) {
    console.log('❌ Sync failed:', error.message);
  }
}

syncCompetitor().then(() => {
  console.log('Manual sync completed');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});