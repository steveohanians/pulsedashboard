import { Router } from 'express';
import { storage } from '../storage';
import { GA4DataService } from '../services/ga4DataService';
// Import auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
import logger from '../utils/logger';

const router = Router();

/**
 * Clear synthetic data and fetch authentic GA4 data for all historical periods
 * POST /api/cleanup-and-fetch/:clientId
 */
router.post('/cleanup-and-fetch/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logger.info(`Starting cleanup and authentic data fetch for client: ${clientId}`);
    
    // Step 1: Clear existing synthetic data (keep only daily July 2025 data)
    await clearSyntheticData(clientId);
    
    // Step 2: Fetch authentic GA4 data for 15 months
    const ga4Service = new GA4DataService();
    const results = await fetchAuthenticHistoricalData(clientId, ga4Service);
    
    logger.info(`Cleanup and fetch completed for ${clientId}`, results);
    
    return res.json({
      success: true,
      message: 'Successfully replaced synthetic data with authentic GA4 data',
      data: results
    });
    
  } catch (error) {
    logger.error('Error in cleanup and fetch route:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to cleanup and fetch authentic data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear synthetic sample data but preserve authentic daily data
 */
async function clearSyntheticData(clientId: string): Promise<void> {
  logger.info(`Clearing synthetic data for client: ${clientId}`);
  
  // Delete all non-daily metrics (these are synthetic sample data)
  await storage.db.delete(storage.metrics).where(
    storage.and(
      storage.eq(storage.metrics.clientId, clientId),
      storage.not(storage.like(storage.metrics.timePeriod, '%-daily-%'))
    )
  );
  
  // Also clear synthetic competitor and benchmark data
  await storage.db.delete(storage.benchmarks);
  
  logger.info(`Cleared synthetic data for client: ${clientId}`);
}

/**
 * Fetch authentic GA4 data for 15 historical months
 */
async function fetchAuthenticHistoricalData(clientId: string, ga4Service: GA4DataService): Promise<any> {
  const results = {
    periodsProcessed: 0,
    successfulFetches: 0,
    errors: [] as string[]
  };
  
  // Generate 15 months of periods (current + 14 previous)
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
      results.periodsProcessed++;
      
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
        results.successfulFetches++;
        logger.info(`Successfully fetched authentic data for ${periodInfo.period}`);
      } else {
        results.errors.push(`Failed to fetch data for ${periodInfo.period}`);
        logger.warn(`Failed to fetch data for ${periodInfo.period}`);
      }
      
    } catch (error) {
      results.errors.push(`Error fetching ${periodInfo.period}: ${error}`);
      logger.error(`Error fetching data for ${periodInfo.period}:`, error);
    }
  }
  
  return results;
}

export default router;