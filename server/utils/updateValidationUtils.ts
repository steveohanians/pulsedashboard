import { IStorage } from "../storage";
import logger from "../utils/logger";
import { CompanyType } from "./globalCompanyValidation";
import { GlobalValidationOrchestrator, EntityUpdateData, UpdateValidationOptions, ValidationResult } from "./globalValidationOrchestrator";

/**
 * Phase 3: Update Validation Utilities
 * Specialized utilities for handling company updates with comprehensive validation
 */

export interface CompanyUpdateResult {
  success: boolean;
  company?: any;
  error?: string;
  validationWarnings?: string[];
  metadata?: {
    validationTime: number;
    validatedFields: string[];
    validationLevel: string;
  };
}

/**
 * Enhanced company update with comprehensive Phase 3 validation
 */
export async function updateCompanyWithValidation(
  companyType: CompanyType,
  companyId: string,
  updateData: any,
  storage: IStorage,
  options: UpdateValidationOptions = {}
): Promise<CompanyUpdateResult> {
  const startTime = Date.now();
  
  logger.info(`Starting ${companyType} update with validation`, {
    companyId,
    companyType,
    validationLevel: options.validationLevel || 'standard',
    updateFields: Object.keys(updateData)
  });

  try {
    // Step 1: Get current company data
    const currentCompany = await getCurrentCompanyData(companyType, companyId, storage);
    if (!currentCompany) {
      return {
        success: false,
        error: `${getCompanyTypeDisplayName(companyType)} not found`
      };
    }

    // Step 2: Prepare validation data
    const entityUpdateData: EntityUpdateData = {
      id: companyId,
      currentData: currentCompany,
      updateData,
      companyType,
      clientId: currentCompany.clientId
    };

    // Step 3: Run Phase 3 validation
    const orchestrator = new GlobalValidationOrchestrator(storage);
    const validationResult = await orchestrator.validateEntityUpdate(entityUpdateData, options);

    if (!validationResult.isValid) {
      logger.warn(`${companyType} update validation failed`, {
        companyId,
        error: validationResult.error,
        validationTime: validationResult.metadata?.validationTime
      });

      return {
        success: false,
        error: validationResult.error,
        metadata: validationResult.metadata
      };
    }

    // Step 4: Perform the actual update
    const updatedCompany = await performCompanyUpdate(companyType, companyId, updateData, storage);
    
    if (!updatedCompany) {
      return {
        success: false,
        error: `Failed to update ${getCompanyTypeDisplayName(companyType)}`
      };
    }

    // Step 5: Post-update workflows (if any)
    await executePostUpdateWorkflows(companyType, updatedCompany, currentCompany, storage);

    const totalTime = Date.now() - startTime;
    logger.info(`${companyType} update completed successfully`, {
      companyId,
      totalTime,
      validationTime: validationResult.metadata?.validationTime,
      validatedFields: validationResult.metadata?.validatedFields
    });

    return {
      success: true,
      company: updatedCompany,
      validationWarnings: validationResult.warnings,
      metadata: {
        validationTime: validationResult.metadata?.validationTime || 0,
        validatedFields: validationResult.metadata?.validatedFields || [],
        validationLevel: validationResult.metadata?.validationLevel || 'standard'
      }
    };

  } catch (error) {
    logger.error(`Failed to update ${companyType}`, {
      companyId,
      error: (error as Error).message,
      stack: (error as Error).stack
    });

    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Batch update multiple companies with validation
 */
export async function updateCompaniesWithValidation(
  updates: Array<{
    companyType: CompanyType;
    companyId: string;
    updateData: any;
  }>,
  storage: IStorage,
  options: UpdateValidationOptions = {}
): Promise<{ companyId: string; result: CompanyUpdateResult }[]> {
  logger.info('Starting batch company updates with validation', {
    updateCount: updates.length,
    validationLevel: options.validationLevel || 'standard'
  });

  // Prepare all entities for batch validation
  const entities: EntityUpdateData[] = [];
  const companyDataMap = new Map<string, any>();

  // Fetch all current company data
  for (const update of updates) {
    const currentCompany = await getCurrentCompanyData(update.companyType, update.companyId, storage);
    if (currentCompany) {
      companyDataMap.set(update.companyId, currentCompany);
      entities.push({
        id: update.companyId,
        currentData: currentCompany,
        updateData: update.updateData,
        companyType: update.companyType,
        clientId: currentCompany.clientId
      });
    }
  }

  // Run batch validation
  const orchestrator = new GlobalValidationOrchestrator(storage);
  const validationResults = await orchestrator.validateBatch(entities, options);

  // Process updates based on validation results
  const results: { companyId: string; result: CompanyUpdateResult }[] = [];

  for (const update of updates) {
    const validationResult = validationResults.find(r => r.entityId === update.companyId);
    
    if (!validationResult || !validationResult.result.isValid) {
      results.push({
        companyId: update.companyId,
        result: {
          success: false,
          error: validationResult?.result.error || 'Validation failed',
          metadata: validationResult?.result.metadata
        }
      });
      continue;
    }

    // Proceed with update if validation passed
    const updateResult = await updateCompanyWithValidation(
      update.companyType,
      update.companyId,
      update.updateData,
      storage,
      { ...options, allowPartialValidation: true } // Skip re-validation
    );

    results.push({
      companyId: update.companyId,
      result: updateResult
    });
  }

  const successCount = results.filter(r => r.result.success).length;
  logger.info('Batch company updates completed', {
    totalUpdates: updates.length,
    successfulUpdates: successCount,
    failedUpdates: updates.length - successCount
  });

  return results;
}

/**
 * Smart update that detects and validates only changed fields
 */
export async function smartUpdateCompany(
  companyType: CompanyType,
  companyId: string,
  updateData: any,
  storage: IStorage,
  options: UpdateValidationOptions = { skipUnchangedFields: true }
): Promise<CompanyUpdateResult> {
  return await updateCompanyWithValidation(companyType, companyId, updateData, storage, options);
}

// Helper functions

async function getCurrentCompanyData(
  companyType: CompanyType,
  companyId: string,
  storage: IStorage
): Promise<any | null> {
  try {
    switch (companyType) {
      case 'competitor':
        // Note: Storage doesn't have getCompetitor by ID method - competitors need to be fetched differently
        // For now, we'll return null and handle this case in the update logic
        return null;
      case 'portfolio':
        const portfolioCompanies = await storage.getCdPortfolioCompanies();
        return portfolioCompanies.find((c: any) => c.id === companyId);
      case 'benchmark':
        const benchmarkCompanies = await storage.getBenchmarkCompanies();
        return benchmarkCompanies.find((c: any) => c.id === companyId);
      case 'client':
        return await storage.getClient(companyId);
      default:
        throw new Error(`Unsupported company type: ${companyType}`);
    }
  } catch (error) {
    logger.error(`Failed to get current ${companyType} data`, {
      companyId,
      error: (error as Error).message
    });
    return null;
  }
}

async function performCompanyUpdate(
  companyType: CompanyType,
  companyId: string,
  updateData: any,
  storage: IStorage
): Promise<any | null> {
  try {
    switch (companyType) {
      case 'competitor':
        // Note: Storage doesn't have updateCompetitor method - competitor updates need to be handled differently
        throw new Error('Competitor updates not yet supported in storage interface');
      case 'portfolio':
        return await storage.updateCdPortfolioCompany(companyId, updateData);
      case 'benchmark':
        return await storage.updateBenchmarkCompany(companyId, updateData);
      case 'client':
        return await storage.updateClient(companyId, updateData);
      default:
        throw new Error(`Unsupported company type: ${companyType}`);
    }
  } catch (error) {
    logger.error(`Failed to perform ${companyType} update`, {
      companyId,
      error: (error as Error).message
    });
    return null;
  }
}

async function executePostUpdateWorkflows(
  companyType: CompanyType,
  updatedCompany: any,
  originalCompany: any,
  storage: IStorage
): Promise<void> {
  try {
    // Portfolio companies need average recalculation
    if (companyType === 'portfolio') {
      const { PortfolioIntegration } = await import('../services/semrush/portfolioIntegration');
      const portfolioIntegration = new PortfolioIntegration(storage);
      await portfolioIntegration.updatePortfolioAverages();
      
      logger.info('Portfolio averages recalculated after company update', {
        companyId: updatedCompany.id,
        companyName: updatedCompany.name
      });
    }

    // Domain changes might require SEMrush re-sync
    const domainField = companyType === 'competitor' ? 'domain' : 'websiteUrl';
    if (originalCompany[domainField] !== updatedCompany[domainField]) {
      logger.info('Domain changed - consider triggering SEMrush re-sync', {
        companyType,
        companyId: updatedCompany.id,
        oldDomain: originalCompany[domainField],
        newDomain: updatedCompany[domainField]
      });
      
      // Note: SEMrush re-sync would typically be triggered manually or via admin interface
    }

  } catch (error) {
    logger.warn('Post-update workflow failed (non-critical)', {
      companyType,
      companyId: updatedCompany.id,
      error: (error as Error).message
    });
  }
}

function getCompanyTypeDisplayName(companyType: CompanyType): string {
  switch (companyType) {
    case 'competitor':
      return 'Competitor';
    case 'portfolio':
      return 'Portfolio company';
    case 'benchmark':
      return 'Benchmark company';
    case 'client':
      return 'Client';
    default:
      return 'Company';
  }
}