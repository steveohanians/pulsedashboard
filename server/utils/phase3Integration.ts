import { IStorage } from "../storage";
import logger from "../utils/logger";
import { GlobalValidationOrchestrator, ValidationResult } from "./globalValidationOrchestrator";
import { updateCompanyWithValidation, updateCompaniesWithValidation } from "./updateValidationUtils";
import { validateCompetitorPortfolioConflicts, validateBenchmarkDiversity, validateClientUniqueness } from "./advancedValidationWorkflows";




export class Phase3RouteIntegration {
  constructor(private storage: IStorage) {}


  async handleCompetitorUpdate(
    competitorId: string,
    updateData: any,
    clientId: string
  ): Promise<{ success: boolean; competitor?: any; error?: string; warnings?: string[] }> {
    try {
      logger.info('Processing competitor update with Phase 3 validation', {
        competitorId,
        clientId,
        updateFields: Object.keys(updateData)
      });

      const clientCompetitors = await this.storage.getCompetitorsByClient(clientId);
      const currentCompetitor = clientCompetitors.find(c => c.id === competitorId);
      
      if (!currentCompetitor) {
        return {
          success: false,
          error: 'Competitor not found'
        };
      }

      if (updateData.domain && updateData.domain !== currentCompetitor.domain) {
        const conflictValidation = await validateCompetitorPortfolioConflicts(
          this.storage,
          updateData.domain,
          clientId,
          competitorId
        );

        if (!conflictValidation.isValid) {
          return {
            success: false,
            error: conflictValidation.error
          };
        }
      }

      const updatedCompetitor = await this.storage.updateCompetitor(competitorId, updateData);
      
      if (!updatedCompetitor) {
        return {
          success: false,
          error: 'Failed to update competitor in database'
        };
      }

      logger.info('Competitor update validation passed and stored', {
        competitorId,
        updateData,
        updatedCompetitor: updatedCompetitor.label
      });

      return {
        success: true,
        competitor: updatedCompetitor,
        warnings: ['Update validation completed successfully']
      };

    } catch (error) {
      logger.error('Competitor update failed', {
        competitorId,
        error: (error as Error).message
      });

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }


  async handlePortfolioCompanyUpdate(
    companyId: string,
    updateData: any
  ): Promise<{ success: boolean; company?: any; error?: string; warnings?: string[] }> {
    try {
      const result = await updateCompanyWithValidation(
        'portfolio',
        companyId,
        updateData,
        this.storage,
        { 
          validateCrossDependencies: true,
          validationLevel: 'comprehensive'
        }
      );

      return {
        success: result.success,
        company: result.company,
        error: result.error,
        warnings: result.validationWarnings
      };

    } catch (error) {
      logger.error('Portfolio company update failed', {
        companyId,
        error: (error as Error).message
      });

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }


  async handleBenchmarkCompanyUpdate(
    companyId: string,
    updateData: any
  ): Promise<{ success: boolean; company?: any; error?: string; warnings?: string[] }> {
    try {
      if (updateData.businessSize || updateData.industryVertical) {
        const allCompanies = await this.storage.getBenchmarkCompanies();
        const currentCompany = allCompanies.find(c => c.id === companyId);
        
        if (!currentCompany) {
          return {
            success: false,
            error: 'Benchmark company not found'
          };
        }

        const diversityValidation = await validateBenchmarkDiversity(
          this.storage,
          updateData.businessSize || currentCompany.businessSize,
          updateData.industryVertical || currentCompany.industryVertical,
          companyId
        );

        const warnings = diversityValidation.warnings || [];

        const result = await updateCompanyWithValidation(
          'benchmark',
          companyId,
          updateData,
          this.storage,
          { 
            validateCrossDependencies: true,
            validationLevel: 'standard'
          }
        );

        return {
          success: result.success,
          company: result.company,
          error: result.error,
          warnings: [...warnings, ...(result.validationWarnings || [])]
        };
      }

      const result = await updateCompanyWithValidation(
        'benchmark',
        companyId,
        updateData,
        this.storage
      );

      return {
        success: result.success,
        company: result.company,
        error: result.error,
        warnings: result.validationWarnings
      };

    } catch (error) {
      logger.error('Benchmark company update failed', {
        companyId,
        error: (error as Error).message
      });

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }


  async handleClientUpdate(
    clientId: string,
    updateData: any
  ): Promise<{ success: boolean; client?: any; error?: string; warnings?: string[] }> {
    try {
      const uniquenessValidation = await validateClientUniqueness(
        this.storage,
        updateData,
        clientId
      );

      if (!uniquenessValidation.isValid) {
        return {
          success: false,
          error: uniquenessValidation.error
        };
      }

      const result = await updateCompanyWithValidation(
        'client',
        clientId,
        updateData,
        this.storage,
        { validationLevel: 'standard' }
      );

      return {
        success: result.success,
        client: result.company,
        error: result.error,
        warnings: [...(uniquenessValidation.warnings || []), ...(result.validationWarnings || [])]
      };

    } catch (error) {
      logger.error('Client update failed', {
        clientId,
        error: (error as Error).message
      });

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }


  async handleBatchUpdate(
    updates: Array<{
      companyType: 'competitor' | 'portfolio' | 'benchmark' | 'client';
      companyId: string;
      updateData: any;
    }>
  ): Promise<Array<{ companyId: string; success: boolean; error?: string; warnings?: string[] }>> {
    try {
      const results: Array<{ companyId: string; success: boolean; error?: string; warnings?: string[] }> = [];

      for (const update of updates) {
        try {
          let result;

          switch (update.companyType) {
            case 'competitor':
              result = await this.handleCompetitorUpdate(update.companyId, update.updateData, 'demo-client-id');
              break;
            case 'portfolio':
              result = await this.handlePortfolioCompanyUpdate(update.companyId, update.updateData);
              break;
            case 'benchmark':
              result = await this.handleBenchmarkCompanyUpdate(update.companyId, update.updateData);
              break;
            case 'client':
              result = await this.handleClientUpdate(update.companyId, update.updateData);
              break;
            default:
              result = { success: false, error: `Unsupported company type: ${update.companyType}` };
          }

          results.push({
            companyId: update.companyId,
            success: result.success,
            error: result.error,
            warnings: result.warnings
          });

        } catch (error) {
          results.push({
            companyId: update.companyId,
            success: false,
            error: (error as Error).message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info('Batch update completed', {
        totalUpdates: updates.length,
        successfulUpdates: successCount,
        failedUpdates: updates.length - successCount
      });

      return results;

    } catch (error) {
      logger.error('Batch update failed', {
        error: (error as Error).message,
        updateCount: updates.length
      });

      return updates.map(update => ({
        companyId: update.companyId,
        success: false,
        error: (error as Error).message
      }));
    }
  }
}



export async function createPhase3RouteIntegration(storage: IStorage): Promise<Phase3RouteIntegration> {
  return new Phase3RouteIntegration(storage);
}

export async function validateWithPhase3(
  storage: IStorage,
  validationType: 'competitor-portfolio-conflict' | 'benchmark-diversity' | 'client-uniqueness',
  data: any,
  options?: { excludeId?: string; clientId?: string }
): Promise<ValidationResult> {
  const orchestrator = new GlobalValidationOrchestrator(storage);

  switch (validationType) {
    case 'competitor-portfolio-conflict':
      const conflictResult = await validateCompetitorPortfolioConflicts(
        storage,
        data.domain,
        options?.clientId || 'default',
        options?.excludeId
      );
      return {
        isValid: conflictResult.isValid,
        error: conflictResult.error,
        warnings: conflictResult.warnings
      };

    case 'benchmark-diversity':
      const diversityResult = await validateBenchmarkDiversity(
        storage,
        data.businessSize,
        data.industryVertical,
        options?.excludeId
      );
      return {
        isValid: diversityResult.isValid,
        error: diversityResult.error,
        warnings: diversityResult.warnings
      };

    case 'client-uniqueness':
      const uniquenessResult = await validateClientUniqueness(
        storage,
        data,
        options?.excludeId
      );
      return {
        isValid: uniquenessResult.isValid,
        error: uniquenessResult.error,
        warnings: uniquenessResult.warnings
      };

    default:
      return {
        isValid: false,
        error: `Unsupported validation type: ${validationType}`
      };
  }
}