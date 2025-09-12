import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { storage } from '../storage';
import { BenchmarkIntegration } from '../services/semrush/benchmarkIntegration';
import { BenchmarkSyncManager } from '../services/BenchmarkSyncManager';
import logger from '../utils/logging/logger';

const router = Router();

/**
 * Sync a single benchmark company from SEMrush
 */
router.post('/sync/:companyId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    logger.info(`[Benchmark Admin] Starting SEMrush sync for company ${companyId}`);
    
    // Get the company details
    const company = await storage.getBenchmarkCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        error: 'Benchmark company not found' 
      });
    }
    
    // Initialize integration service
    const benchmarkIntegration = new BenchmarkIntegration(storage);
    
    // Process the company through SEMrush
    const result = await benchmarkIntegration.processNewBenchmarkCompany(company);
    
    if (result.success) {
      logger.info(`[Benchmark Admin] Successfully synced ${company.name}`, result);
      res.json({
        success: true,
        message: `Successfully synced ${company.name} from SEMrush`,
        data: result
      });
    } else {
      throw new Error(result.error || 'Sync failed');
    }
    
  } catch (error) {
    logger.error('[Benchmark Admin] Sync failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to sync benchmark company'
    });
  }
});

/**
 * Sync all benchmark companies from SEMrush
 */
router.post('/sync-all', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Starting bulk SEMrush sync for all benchmark companies');
    
    // Get all active benchmark companies
    const companies = await storage.getBenchmarkCompanies();
    const activeCompanies = companies.filter(c => c.active);
    
    if (activeCompanies.length === 0) {
      return res.json({
        success: true,
        message: 'No active benchmark companies to sync',
        data: { companiesSynced: 0 }
      });
    }
    
    // Initialize sync manager and integration service
    const syncManager = new BenchmarkSyncManager(storage);
    const benchmarkIntegration = new BenchmarkIntegration(storage);
    
    // Create a bulk sync job
    const jobId = await syncManager.createSyncJob({
      jobType: 'bulk',
      companyIds: activeCompanies.map(c => c.id),
      incrementalSync: false,
      initiatedByUserId: (req.user as any)?.id
    });
    
    // Start the sync job (this sends initial SSE events)
    await syncManager.startSyncJob(jobId);
    
    // Return immediately - the sync will continue in the background with SSE updates
    res.json({
      success: true,
      message: `Started bulk sync for ${activeCompanies.length} companies`,
      data: { 
        jobId,
        companiesQueued: activeCompanies.length,
        status: 'started'
      }
    });
    
    // Process companies asynchronously with proper SSE events
    (async () => {
      try {
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < activeCompanies.length; i++) {
          const company = activeCompanies[i];
          
          try {
            // Update progress before processing each company
            await syncManager.updateSyncProgress(jobId, {
              currentCompanyId: company.id,
              currentCompanyName: company.name,
              currentPhase: 'syncing',
              message: `Syncing ${company.name} (${i + 1}/${activeCompanies.length})`
            });
            
            // Process the company
            const result = await benchmarkIntegration.processNewBenchmarkCompany(company, {
              syncJobId: jobId,
              emitProgressEvents: true
            });
            
            if (result.success) {
              successCount++;
              await syncManager.recordCompanySuccess(jobId, company.id, result);
            } else {
              failCount++;
              await syncManager.recordCompanyFailure(jobId, company.id, result.error || 'Unknown error');
            }
          } catch (error) {
            failCount++;
            await syncManager.recordCompanyFailure(jobId, company.id, (error as Error).message);
            logger.error(`[Benchmark Admin] Failed to sync ${company.name}:`, error);
          }
        }
        
        // Complete the sync job
        await syncManager.completeSyncJob(jobId, {
          finalMessage: `Completed bulk sync: ${successCount} successful, ${failCount} failed`
        });
        
        logger.info('[Benchmark Admin] Bulk sync job completed', {
          jobId,
          successCount,
          failCount,
          total: activeCompanies.length
        });
        
      } catch (error) {
        // Fail the sync job on any critical error
        await syncManager.failSyncJob(jobId, (error as Error).message);
        logger.error('[Benchmark Admin] Bulk sync job failed:', error);
      }
    })().catch((error) => {
      logger.error('[Benchmark Admin] Async bulk sync handler failed:', error);
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] Failed to start bulk sync:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to start bulk sync'
    });
  }
});

/**
 * Recalculate Industry_Avg from existing benchmark data
 */
router.post('/recalculate-averages', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Recalculating Industry averages');
    
    // Initialize integration service
    const benchmarkIntegration = new BenchmarkIntegration(storage);
    
    // Recalculate averages
    await benchmarkIntegration.updateIndustryAverages();
    
    // Get count of Industry_Avg metrics for confirmation
    const industryMetrics = await storage.getMetricsBySourceType('Industry_Avg');
    
    logger.info(`[Benchmark Admin] Industry averages recalculated, ${industryMetrics.length} metrics updated`);
    
    res.json({
      success: true,
      message: 'Industry averages recalculated successfully',
      data: {
        metricsUpdated: industryMetrics.length
      }
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] Recalculation failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to recalculate industry averages'
    });
  }
});

/**
 * Get sync status for all benchmark companies
 */
router.get('/sync-status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const companies = await storage.getBenchmarkCompanies();
    
    // For each company, check if they have metrics
    const status = await Promise.all(companies.map(async (company) => {
      const metrics = await storage.getMetricsByCompanyId(company.id);
      
      return {
        companyId: company.id,
        companyName: company.name,
        websiteUrl: company.websiteUrl,
        active: company.active,
        hasSemrushData: metrics.length > 0,
        metricsCount: metrics.length,
        lastSync: metrics.length > 0 ? metrics[0].createdAt : null
      };
    }));
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] Failed to get sync status:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get sync status'
    });
  }
});

export default router;