/**
 * Admin GA4 Data Management Routes
 * 
 * Provides reliable admin functions for GA4 data management
 */

import { Router } from 'express';
import logger from '../utils/logger';
import { GA4DataManager } from '../services/ga4/GA4DataManager';
import { generateDynamicPeriodMapping } from '../utils/dateUtils';
// Error handler wrapper for async routes
const asyncErrorHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const router = Router();
const ga4Manager = new GA4DataManager();

/**
 * Admin: Populate Complete Historical Data
 * POST /api/admin/ga4/populate-historical/:clientId
 */
router.post('/populate-historical/:clientId', asyncErrorHandler(async (req: any, res: any) => {
  const { clientId } = req.params;
  const { months = 15, includeDailyForRecent = true } = req.body;
  
  logger.info(`Admin: Populating ${months} months of historical GA4 data for ${clientId}`);
  
  const results = {
    success: true,
    monthsProcessed: 0,
    dailyDataMonths: [] as string[],
    monthlyDataMonths: [] as string[],
    errors: [] as Array<{ period: string; error: string }>
  };
  
  try {
    // Generate periods (last 15 months)
    const periods = [];
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i - 1); // Start from last month
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periods.push(period);
    }
    
    // Process each period
    for (const period of periods) {
      try {
        const [year, month] = period.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        
        // For recent 3 months, fetch daily data if requested
        const isRecentMonth = periods.indexOf(period) < 3;
        if (includeDailyForRecent && isRecentMonth) {
          const dailyData = await ga4Manager.fetchDailyData(clientId, startDate, endDate, period);
          if (dailyData && dailyData.length > 0) {
            results.dailyDataMonths.push(period);
            logger.info(`✅ Fetched ${dailyData.length} days of data for ${period}`);
          }
        } else {
          // Fetch monthly summary data
          const monthlyData = await ga4Manager.fetchPeriodData(clientId, startDate, endDate, period);
          if (monthlyData) {
            results.monthlyDataMonths.push(period);
            logger.info(`✅ Fetched monthly data for ${period}`);
          }
        }
        
        results.monthsProcessed++;
        
      } catch (error) {
        logger.error(`Error processing period ${period}:`, error);
        results.errors.push({ period, error: (error as Error).message });
      }
    }
    
    logger.info(`Admin: Completed historical data population for ${clientId}`, results);
    
    res.json({
      success: true,
      message: `Successfully populated ${results.monthsProcessed} months of GA4 data`,
      results
    });
    
  } catch (error) {
    logger.error(`Admin: Error populating historical data for ${clientId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to populate historical GA4 data',
      error: (error as Error).message
    });
  }
}));

/**
 * Admin: Refresh Current Month with Daily Data
 * POST /api/admin/ga4/refresh-current-daily/:clientId
 */
router.post('/refresh-current-daily/:clientId', asyncErrorHandler(async (req: any, res: any) => {
  const { clientId } = req.params;
  
  logger.info(`Admin: Refreshing current month with daily data for ${clientId}`);
  
  try {
    // Get current period from dynamic mapping
    const periodMapping = generateDynamicPeriodMapping();
    const currentPeriod = periodMapping.currentPeriod || '2025-07';
    
    const [year, month] = String(currentPeriod).split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
    
    // Clear existing data for this period (skip for now)
    // await ga4Manager.clearClientDataForPeriod(clientId, currentPeriod);
    
    // Fetch daily data for current month
    const dailyData = await ga4Manager.fetchDailyData(clientId, startDate, endDate, String(currentPeriod));
    
    if (!dailyData || dailyData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No daily GA4 data available for current month'
      });
    }
    
    // Clear cache to force fresh data load
    const { performanceCache } = await import('../cache/performance-cache');
    performanceCache.clear();
    
    logger.info(`Admin: Successfully refreshed ${dailyData.length} days of data for ${currentPeriod}`);
    
    res.json({
      success: true,
      message: `Successfully refreshed current month with ${dailyData.length} days of data`,
      period: currentPeriod,
      daysProcessed: dailyData.length,
      previewData: dailyData.slice(0, 3).map(day => ({
        date: day.date,
        bounceRate: `${day.metrics.bounceRate.toFixed(1)}%`,
        sessionDuration: `${day.metrics.sessionDuration.toFixed(0)}s`
      }))
    });
    
  } catch (error) {
    logger.error(`Admin: Error refreshing current daily data for ${clientId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh current month daily data',
      error: (error as Error).message
    });
  }
}));

/**
 * Admin: Complete GA4 Setup and Verification
 * POST /api/admin/ga4/complete-setup/:clientId
 */
router.post('/complete-setup/:clientId', asyncErrorHandler(async (req: any, res: any) => {
  const { clientId } = req.params;
  
  logger.info(`Admin: Running complete GA4 setup for ${clientId}`);
  
  const setupResults = {
    success: true,
    steps: [] as string[],
    errors: [] as string[]
  };
  
  try {
    // Step 1: Verify GA4 property access
    setupResults.steps.push('Verifying GA4 property access...');
    const propertyAccess = await ga4Manager.validateClientAccess(clientId);
    if (!propertyAccess) {
      throw new Error('No GA4 property access configured for this client');
    }
    setupResults.steps.push('✅ GA4 property access verified');
    
    // Step 2: Populate 15 months of historical data
    setupResults.steps.push('Populating 15 months of historical data...');
    const historicalResponse = await fetch(`http://localhost:5000/api/admin/ga4/populate-historical/${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months: 15, includeDailyForRecent: true })
    });
    
    if (!historicalResponse.ok) {
      throw new Error('Failed to populate historical data');
    }
    setupResults.steps.push('✅ Historical data populated');
    
    // Step 3: Set up daily data for current month
    setupResults.steps.push('Setting up daily data for current month...');
    const dailyResponse = await fetch(`http://localhost:5000/api/admin/ga4/refresh-current-daily/${clientId}`, {
      method: 'POST'
    });
    
    if (!dailyResponse.ok) {
      throw new Error('Failed to set up daily data');
    }
    setupResults.steps.push('✅ Daily data for current month configured');
    
    // Step 4: Clear all caches
    setupResults.steps.push('Clearing performance caches...');
    const { performanceCache } = await import('../cache/performance-cache');
    performanceCache.clear();
    setupResults.steps.push('✅ Caches cleared');
    
    setupResults.steps.push('🎉 Complete GA4 setup finished successfully');
    
    logger.info(`Admin: Complete GA4 setup finished for ${clientId}`, setupResults);
    
    res.json({
      success: true,
      message: 'Complete GA4 setup finished successfully',
      setupResults
    });
    
  } catch (error) {
    logger.error(`Admin: Error in complete GA4 setup for ${clientId}:`, error);
    setupResults.success = false;
    setupResults.errors.push((error as Error).message);
    
    res.status(500).json({
      success: false,
      message: 'Complete GA4 setup failed',
      setupResults
    });
  }
}));

export default router;