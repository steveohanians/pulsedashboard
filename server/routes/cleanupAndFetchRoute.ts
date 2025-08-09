import { Router } from 'express';
import { storage } from '../storage';
import { smartGA4DataFetcher } from '../services/smartGA4DataFetcher'; // NEW: Import smart fetcher
// Import auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
import logger from '../utils/logger';

// NEW: In-memory lock for cleanup concurrency control
let cleanupInProgress = false;

const router = Router();

/**
 * Clear synthetic data and fetch authentic GA4 data for all historical periods
 * POST /api/cleanup-and-fetch/:clientId
 * NEW: Enhanced with caching best practices and concurrency control
 */
router.post('/cleanup-and-fetch/:clientId', async (req, res) => {
  // NEW: Set comprehensive non-cacheable headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // NEW: Concurrency guard - only one cleanup at a time
  if (cleanupInProgress) {
    return res.status(409).json({
      ok: false,
      message: 'Cleanup already in progress'
    });
  }
  
  try {
    // NEW: Set cleanup lock
    cleanupInProgress = true;
    
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    logger.info(`Starting cleanup and authentic data fetch for client: ${clientId}`);
    
    // Step 1: Clear existing synthetic/derived caches for the given clientId only
    await clearSyntheticDataForClient(clientId);
    
    // Step 2: NEW: Call smart GA4 fetcher with force=true
    const results = await smartGA4DataFetcher({ 
      clientId, 
      force: true // NEW: Force bypass cache and refresh data
    });
    
    logger.info(`Cleanup and fetch completed for ${clientId}`, results);
    
    // NEW: Return JSON object summarizing refetched periods
    return res.json({
      ok: true,
      success: true,
      message: 'Successfully replaced synthetic data with authentic GA4 data',
      periodsRefetched: results.periodsProcessed,
      dailyDataPeriods: results.dailyDataPeriods,
      monthlyDataPeriods: results.monthlyDataPeriods,
      lastFetchedAt: results.lastFetchedAt,
      errors: results.errors
    });
    
  } catch (error) {
    logger.error('Error in cleanup and fetch route:', error);
    
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Failed to cleanup and fetch authentic data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // NEW: Always release cleanup lock
    cleanupInProgress = false;
  }
});

/**
 * NEW: Clear synthetic/derived caches for the given clientId only
 * Preserves authentic daily data while clearing synthetic data
 */
async function clearSyntheticDataForClient(clientId: string): Promise<void> {
  logger.info(`Clearing synthetic/derived caches for client: ${clientId}`);
  
  try {
    // NEW: Clear all client metrics (will be replaced with fresh GA4 data)
    await storage.clearAllClientMetrics(clientId);
    
    // NEW: Clear AI insights for this client
    await storage.getAIInsightsByClient(clientId).then(async (insights) => {
      for (const insight of insights) {
        await storage.deleteAIInsightByMetric(clientId, insight.metricName);
      }
    });
    
    logger.info(`Successfully cleared synthetic/derived caches for client: ${clientId}`);
  } catch (error) {
    logger.error(`Error clearing synthetic data for client ${clientId}:`, error);
    throw error;
  }
}

// NEW: Removed legacy fetchAuthenticHistoricalData function
// Now using smartGA4DataFetcher with force=true for better caching control

export default router;