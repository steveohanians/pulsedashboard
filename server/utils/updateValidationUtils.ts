import { IStorage } from "../storage";
import logger from "../utils/logger";
import { CompanyType } from "./company/validation";
import { GlobalValidationOrchestrator, EntityUpdateData, UpdateValidationOptions, ValidationResult } from "./globalValidationOrchestrator";



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
    const currentCompany = await getCurrentCompanyData(companyType, companyId, storage);
    if (!currentCompany) {
      return {
        success: false,
        error: `${getCompanyTypeDisplayName(companyType)} not found`
      };
    }

    const entityUpdateData: EntityUpdateData = {
      id: companyId,
      currentData: currentCompany,
      updateData,
      companyType,
      clientId: currentCompany.clientId
    };

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

    const updatedCompany = await performCompanyUpdate(companyType, companyId, updateData, storage);
    
    if (!updatedCompany) {
      return {
        success: false,
        error: `Failed to update ${getCompanyTypeDisplayName(companyType)}`
      };
    }

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

  const entities: EntityUpdateData[] = [];
  const companyDataMap = new Map<string, any>();

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

  const orchestrator = new GlobalValidationOrchestrator(storage);
  const validationResults = await orchestrator.validateBatch(entities, options);

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

    const updateResult = await updateCompanyWithValidation(
      update.companyType,
      update.companyId,
      update.updateData,
      storage,
      { ...options, allowPartialValidation: true }
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


export async function smartUpdateCompany(
  companyType: CompanyType,
  companyId: string,
  updateData: any,
  storage: IStorage,
  options: UpdateValidationOptions = { skipUnchangedFields: true }
): Promise<CompanyUpdateResult> {
  return await updateCompanyWithValidation(companyType, companyId, updateData, storage, options);
}

async function getCurrentCompanyData(
  companyType: CompanyType,
  companyId: string,
  storage: IStorage
): Promise<any | null> {
  try {
    switch (companyType) {
      case 'competitor':
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
    if (companyType === 'portfolio') {
      const { PortfolioIntegration } = await import('../services/semrush/portfolioIntegration');
      const portfolioIntegration = new PortfolioIntegration(storage);
      await portfolioIntegration.updatePortfolioAverages();
      
      logger.info('Portfolio averages recalculated after company update', {
        companyId: updatedCompany.id,
        companyName: updatedCompany.name
      });
    }

    const domainField = companyType === 'competitor' ? 'domain' : 'websiteUrl';
    if (originalCompany[domainField] !== updatedCompany[domainField]) {
      logger.info('Domain changed - consider triggering SEMrush re-sync', {
        companyType,
        companyId: updatedCompany.id,
        oldDomain: originalCompany[domainField],
        newDomain: updatedCompany[domainField]
      });
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