import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { storage } from '../storage';
import { BenchmarkIntegration } from '../services/semrush/benchmarkIntegration';
import { BenchmarkSyncManager } from '../services/BenchmarkSyncManager';
import { semrushService } from '../services/semrush/semrushService';
import { verifiedAuditService, VerifiedAuditService, VerifiedAuditOptions } from '../services/verifiedAuditService';
import { z } from 'zod';
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
    
    // Update company status to processing and broadcast via SSE
    await storage.updateBenchmarkCompany(companyId, { syncStatus: 'processing' });
    logger.debug('Updated benchmark company sync status', { companyId, status: 'processing' });
    
    // Initialize sync manager to get SSE broadcasting capabilities
    const syncManager = new BenchmarkSyncManager(storage);
    
    // Create an individual sync job for proper SSE broadcasting
    const jobId = 'individual';
    await syncManager.updateSyncProgress(jobId, {
      processedCompanies: 0,
      currentCompanyName: company.name,
      message: `Processing ${company.name}`,
      phase: 'initializing'
    });
    
    // Initialize integration service
    const benchmarkIntegration = new BenchmarkIntegration(storage);
    
    // Process the company through SEMrush with incremental sync optimization
    const result = await benchmarkIntegration.processNewBenchmarkCompany(company, { 
      incrementalSync: true, // Use incremental sync to optimize performance
      emitProgressEvents: true 
    });
    
    // Complete the sync job
    await syncManager.updateSyncProgress(jobId, {
      processedCompanies: 1,
      currentCompanyName: company.name,
      message: `Completed ${company.name}`,
      phase: 'completed'
    });
    
    // Broadcast completion
    logger.info('Broadcasting benchmark sync completion', { jobId: 'individual', totalCompanies: 1, processedCompanies: 1 });
    
    if (result.success) {
      logger.info(`[Benchmark Admin] Successfully synced ${company.name}`, result);
      res.json({
        success: true,
        message: `Successfully synced ${company.name} from SEMrush`,
        data: result
      });
    } else {
      // Update status to failed on error
      await storage.updateBenchmarkCompany(companyId, { syncStatus: 'failed' });
      throw new Error(result.error || 'Sync failed');
    }
    
  } catch (error) {
    logger.error('[Benchmark Admin] Sync failed:', error);
    
    // Update status to failed on error
    try {
      await storage.updateBenchmarkCompany(req.params.companyId, { syncStatus: 'failed' });
    } catch (updateError) {
      logger.error('Failed to update company status to failed:', updateError);
    }
    
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
      incrementalSync: true,
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
              phase: 'syncing',
              message: `Syncing ${company.name} (${i + 1}/${activeCompanies.length})`
            });
            
            // Process the company
            const result = await benchmarkIntegration.processNewBenchmarkCompany(company, {
              incrementalSync: true, // Use incremental sync for performance optimization
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
        
        // Update industry averages once at the end (performance optimization)
        if (successCount > 0) {
          logger.info('[Benchmark Admin] Updating industry averages after bulk sync completion');
          try {
            await benchmarkIntegration.updateIndustryAverages();
            logger.info('[Benchmark Admin] Successfully updated industry averages');
          } catch (error) {
            logger.error('[Benchmark Admin] Failed to update industry averages after bulk sync:', error);
          }
        }

        // Complete the sync job
        await syncManager.completeSyncJob(jobId);
        
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
 * Reset companies stuck in processing status (after server restarts)
 */
router.post('/reset-stuck-companies', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Resetting companies stuck in processing status');
    
    // Get companies stuck in processing
    const allCompanies = await storage.getBenchmarkCompanies();
    const stuckCompanies = allCompanies.filter(company => 
      company.syncStatus === 'processing'
    );
    
    if (stuckCompanies.length === 0) {
      return res.json({
        success: true,
        message: 'No stuck companies found',
        data: {
          companiesReset: 0,
          stuckCompanies: []
        }
      });
    }
    
    // Reset each stuck company to pending
    const resetPromises = stuckCompanies.map(company =>
      storage.updateBenchmarkCompany(company.id, {
        syncStatus: 'pending',
        lastSyncAttempt: null
      })
    );
    
    await Promise.all(resetPromises);
    
    logger.info(`[Benchmark Admin] Reset ${stuckCompanies.length} stuck companies to pending`, {
      stuckCompanies: stuckCompanies.map(c => ({ id: c.id, name: c.name }))
    });
    
    res.json({
      success: true,
      message: `Successfully reset ${stuckCompanies.length} stuck companies`,
      data: {
        companiesReset: stuckCompanies.length,
        stuckCompanies: stuckCompanies.map(c => ({ id: c.id, name: c.name }))
      }
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] Failed to reset stuck companies:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to reset stuck companies'
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

/**
 * Check SEMrush API balance and quota status
 */
router.get('/semrush-balance', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Checking SEMrush API balance');
    
    // Check if we should force a fresh balance check
    const forceFresh = req.query.refresh === 'true';
    
    const balance = await semrushService.checkBalance(forceFresh);
    
    logger.info('[Benchmark Admin] SEMrush balance check completed', {
      unitsRemaining: balance.unitsRemaining,
      unitsLimit: balance.unitsLimit,
      percentageUsed: balance.percentageUsed,
      hasUnits: balance.hasUnits,
      lowBalanceWarning: balance.lowBalanceWarning,
      criticalBalanceWarning: balance.criticalBalanceWarning
    });
    
    // Add status message based on balance level
    let statusMessage = 'API balance is healthy';
    if (balance.criticalBalanceWarning) {
      statusMessage = 'CRITICAL: API balance is very low!';
    } else if (balance.lowBalanceWarning) {
      statusMessage = 'WARNING: API balance is running low';
    }
    
    res.json({
      success: true,
      message: statusMessage,
      data: {
        balance: {
          unitsRemaining: balance.unitsRemaining,
          unitsLimit: balance.unitsLimit,
          percentageUsed: balance.percentageUsed,
          unitsUsed: balance.unitsLimit - balance.unitsRemaining,
          hasUnits: balance.hasUnits,
          nextResetTime: balance.nextResetTime.toISOString(),
          resetPeriod: balance.resetPeriod
        },
        warnings: {
          lowBalance: balance.lowBalanceWarning,
          criticalBalance: balance.criticalBalanceWarning
        },
        status: {
          canMakeRequests: balance.hasUnits,
          recommendedAction: balance.criticalBalanceWarning 
            ? 'Stop API calls until reset' 
            : balance.lowBalanceWarning 
              ? 'Monitor usage carefully'
              : 'Normal operations'
        }
      }
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] Failed to check SEMrush balance:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to check SEMrush API balance',
      data: {
        balance: null,
        warnings: {
          lowBalance: false,
          criticalBalance: true // Assume critical if we can't check
        },
        status: {
          canMakeRequests: false,
          recommendedAction: 'Check API key and connection'
        }
      }
    });
  }
});

/**
 * Test SEMrush API connectivity and balance
 */
router.get('/semrush-test', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Testing SEMrush API connectivity');
    
    // Test connectivity and balance simultaneously
    const [balance, connectionTest] = await Promise.all([
      semrushService.checkBalance(true), // Force fresh balance check for test
      semrushService.testConnection()
    ]);
    
    const testResults = {
      connectivity: {
        status: connectionTest ? 'connected' : 'failed',
        canConnect: connectionTest,
        message: connectionTest 
          ? 'Successfully connected to SEMrush API'
          : 'Failed to connect to SEMrush API'
      },
      balance: {
        unitsRemaining: balance.unitsRemaining,
        unitsLimit: balance.unitsLimit,
        percentageUsed: balance.percentageUsed,
        hasUnits: balance.hasUnits,
        nextResetTime: balance.nextResetTime.toISOString(),
        resetPeriod: balance.resetPeriod
      },
      recommendations: [] as string[]
    };
    
    // Add recommendations based on test results
    if (!connectionTest) {
      testResults.recommendations.push('Check API key configuration');
      testResults.recommendations.push('Verify network connectivity to SEMrush');
    }
    
    if (!balance.hasUnits) {
      testResults.recommendations.push('API quota exhausted - wait for reset or upgrade plan');
    } else if (balance.criticalBalanceWarning) {
      testResults.recommendations.push('API balance critically low - consider limiting usage');
    } else if (balance.lowBalanceWarning) {
      testResults.recommendations.push('API balance running low - monitor usage');
    }
    
    const overallStatus = connectionTest && balance.hasUnits ? 'healthy' : 'issues_detected';
    
    logger.info('[Benchmark Admin] SEMrush API test completed', {
      overallStatus,
      connectivity: connectionTest,
      hasUnits: balance.hasUnits,
      unitsRemaining: balance.unitsRemaining
    });
    
    res.json({
      success: true,
      message: `SEMrush API test completed - status: ${overallStatus}`,
      data: {
        overallStatus,
        testResults,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('[Benchmark Admin] SEMrush API test failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to test SEMrush API',
      data: {
        overallStatus: 'test_failed',
        testResults: {
          connectivity: {
            status: 'unknown',
            canConnect: false,
            message: 'Test failed to complete'
          },
          balance: null,
          recommendations: ['Check API configuration and network connectivity']
        },
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Request body validation schema for verified companies audit
 */
const VerifiedAuditRequestSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  targetSyncStatus: z.enum(['failed', 'pending', 'completed']).optional().default('failed')
}).strict();

/**
 * Audit verified companies and update those with zero metrics
 * 
 * POST /api/admin/benchmarks/audit-verified
 * 
 * Comprehensive audit system that:
 * - Identifies all companies with sourceVerified=true
 * - Efficiently counts metrics using bulk operations
 * - Updates companies with zero metrics to failed status
 * - Supports dry-run mode for safe testing
 * - Returns detailed summary and audit results
 */
router.post('/audit-verified', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('[Benchmark Admin] Starting verified companies audit', {
      userId: (req.user as any)?.id,
      userEmail: (req.user as any)?.email,
      requestBody: req.body,
      timestamp: new Date().toISOString()
    });

    // Validate request body
    const validation = VerifiedAuditRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      logger.warn('[Benchmark Admin] Verified audit validation failed', {
        errors: validation.error.errors,
        requestBody: req.body
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const { dryRun, targetSyncStatus } = validation.data;

    // Additional validation using the service's validation method
    const optionsValidation = VerifiedAuditService.validateOptions(validation.data);
    
    if (!optionsValidation.valid) {
      logger.warn('[Benchmark Admin] Verified audit options validation failed', {
        errors: optionsValidation.errors,
        options: validation.data
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid audit options',
        details: optionsValidation.errors
      });
    }

    // Execute the audit
    const auditService = await verifiedAuditService;
    const auditResult = await auditService.auditVerifiedCompanies({
      dryRun,
      targetSyncStatus
    });

    if (!auditResult.success) {
      logger.error('[Benchmark Admin] Verified companies audit failed', {
        error: auditResult.error,
        dryRun,
        targetSyncStatus,
        executionTime: auditResult.executionTime
      });
      
      return res.status(500).json({
        success: false,
        error: auditResult.error || 'Audit operation failed',
        summary: auditResult.summary,
        executionTime: auditResult.executionTime
      });
    }

    // Success response with comprehensive results
    logger.info('[Benchmark Admin] Verified companies audit completed successfully', {
      dryRun: auditResult.dryRun,
      summary: auditResult.summary,
      executionTime: auditResult.executionTime
    });

    res.json({
      success: true,
      message: dryRun 
        ? `Audit preview completed - ${auditResult.summary.companiesWithZeroMetrics} companies would be updated`
        : `Audit completed successfully - ${auditResult.summary.companiesUpdated} companies updated`,
      data: {
        dryRun: auditResult.dryRun,
        summary: auditResult.summary,
        executionTime: auditResult.executionTime,
        timestamp: new Date().toISOString(),
        // Include detailed company information for transparency
        verifiedCompaniesCount: auditResult.details.verifiedCompanies.length,
        companiesNeedingUpdateCount: auditResult.details.companiesNeedingUpdate.length,
        // Optionally include detailed company data (for debugging/transparency)
        companiesWithZeroMetrics: auditResult.details.companiesNeedingUpdate.map((company: any) => ({
          id: company.id,
          name: company.name,
          websiteUrl: company.websiteUrl,
          industryVertical: company.industryVertical,
          businessSize: company.businessSize,
          metricsCount: company.metricsCount,
          currentSyncStatus: company.syncStatus,
          hasRequiredMetrics: company.hasRequiredMetrics,
          missingMetrics: company.missingMetrics,
          validatedTimePeriodsCount: company.validatedTimePeriods.length
        }))
      }
    });

  } catch (error) {
    logger.error('[Benchmark Admin] Verified companies audit failed with exception', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId: (req.user as any)?.id,
      requestBody: req.body
    });

    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to execute verified companies audit',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;