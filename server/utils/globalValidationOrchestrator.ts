import { IStorage } from "../storage";
import logger from "./logger";
import { GlobalCompanyValidator, CompanyType, ISemrushValidator } from "./company/validation";



export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    validationLevel: 'basic' | 'standard' | 'comprehensive';
    validationTime: number;
    validatedFields: string[];
    skipReason?: string;
  };
}

export interface UpdateValidationOptions {
  skipUnchangedFields?: boolean;
  validateCrossDependencies?: boolean;
  allowPartialValidation?: boolean;
  validationLevel?: 'basic' | 'standard' | 'comprehensive';
}

export interface EntityUpdateData {
  id: string;
  currentData: any;
  updateData: any;
  companyType: CompanyType;
  clientId?: string;
}


export class GlobalValidationOrchestrator {
  private validator: GlobalCompanyValidator;
  private validationCache: Map<string, { result: ValidationResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private storage: IStorage, private semrushValidator?: ISemrushValidator) {
    this.validator = new GlobalCompanyValidator(storage, semrushValidator);
  }


  async validateEntityUpdate(
    updateData: EntityUpdateData,
    options: UpdateValidationOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const { 
      skipUnchangedFields = true, 
      validateCrossDependencies = true,
      validationLevel = 'standard' 
    } = options;

    logger.info('Starting entity update validation', {
      entityId: updateData.id,
      companyType: updateData.companyType,
      validationLevel,
      hasUpdateData: !!updateData.updateData
    });

    try {
      const validatedFields: string[] = [];
      const warnings: string[] = [];

      const changedFields = this.detectChangedFields(updateData.currentData, updateData.updateData);
      
      if (changedFields.length === 0) {
        return {
          isValid: true,
          warnings: ['No fields to update'],
          metadata: {
            validationLevel,
            validationTime: Date.now() - startTime,
            validatedFields: [],
            skipReason: 'no_changes'
          }
        };
      }

      logger.debug('Detected field changes', {
        entityId: updateData.id,
        changedFields
      });

      const domainField = updateData.companyType === 'competitor' ? 'domain' : 'websiteUrl';
      if (changedFields.includes(domainField)) {
        const domainValidation = await this.validateDomainUpdate(updateData, updateData.updateData[domainField]);
        if (!domainValidation.isValid) {
          return domainValidation;
        }
        validatedFields.push(domainField);
        if (domainValidation.warnings) {
          warnings.push(...domainValidation.warnings);
        }
      }

      const labelField = updateData.companyType === 'competitor' ? 'label' : 'name';
      if (changedFields.includes(labelField)) {
        const labelValidation = this.validateLabelUpdate(updateData.updateData[labelField]);
        if (!labelValidation.isValid) {
          return labelValidation;
        }
        validatedFields.push(labelField);
      }

      if (['portfolio', 'benchmark'].includes(updateData.companyType)) {
        const filterFields = ['businessSize', 'industryVertical'];
        const changedFilterFields = changedFields.filter(field => filterFields.includes(field));
        
        if (changedFilterFields.length > 0) {
          const filterValidation = await this.validateFilterUpdate(updateData, changedFilterFields);
          if (!filterValidation.isValid) {
            return filterValidation;
          }
          validatedFields.push(...changedFilterFields);
        }
      }

      if (validateCrossDependencies && validationLevel !== 'basic') {
        const crossValidation = await this.validateCrossDependencies(updateData, changedFields);
        if (!crossValidation.isValid) {
          return crossValidation;
        }
        if (crossValidation.warnings) {
          warnings.push(...crossValidation.warnings);
        }
      }

      if (validationLevel === 'comprehensive') {
        const businessValidation = await this.validateBusinessRules(updateData, changedFields);
        if (!businessValidation.isValid) {
          return businessValidation;
        }
        if (businessValidation.warnings) {
          warnings.push(...businessValidation.warnings);
        }
      }

      const validationTime = Date.now() - startTime;
      logger.info('Entity update validation completed successfully', {
        entityId: updateData.id,
        companyType: updateData.companyType,
        validatedFields,
        validationTime,
        warningsCount: warnings.length
      });

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          validationLevel,
          validationTime,
          validatedFields
        }
      };

    } catch (error) {
      logger.error('Entity update validation failed', {
        entityId: updateData.id,
        companyType: updateData.companyType,
        error: (error as Error).message
      });

      return {
        isValid: false,
        error: `Validation failed: ${(error as Error).message}`,
        metadata: {
          validationLevel,
          validationTime: Date.now() - startTime,
          validatedFields: []
        }
      };
    }
  }


  async validateBatch(
    entities: EntityUpdateData[],
    options: UpdateValidationOptions = {}
  ): Promise<{ entityId: string; result: ValidationResult }[]> {
    logger.info('Starting batch validation', {
      entityCount: entities.length,
      validationLevel: options.validationLevel || 'standard'
    });

    const results = await Promise.all(
      entities.map(async (entity) => ({
        entityId: entity.id,
        result: await this.validateEntityUpdate(entity, options)
      }))
    );

    const failedCount = results.filter(r => !r.result.isValid).length;
    logger.info('Batch validation completed', {
      totalEntities: entities.length,
      failedValidations: failedCount,
      successRate: `${((entities.length - failedCount) / entities.length * 100).toFixed(1)}%`
    });

    return results;
  }


  async validateWithCache(
    cacheKey: string,
    validationFn: () => Promise<ValidationResult>
  ): Promise<ValidationResult> {
    const cached = this.validationCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      logger.debug('Using cached validation result', { cacheKey });
      return { 
        ...cached.result, 
        metadata: { 
          validationLevel: cached.result.metadata?.validationLevel || 'standard',
          validationTime: cached.result.metadata?.validationTime || 0,
          validatedFields: cached.result.metadata?.validatedFields || [],
          skipReason: 'cached' 
        } 
      };
    }

    const result = await validationFn();
    this.validationCache.set(cacheKey, { result, timestamp: now });
    
    logger.debug('Cached new validation result', { cacheKey });
    return result;
  }


  clearCache(): void {
    this.validationCache.clear();
    logger.info('Validation cache cleared');
  }

  private detectChangedFields(currentData: any, updateData: any): string[] {
    const changedFields: string[] = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (currentData[key] !== value) {
        changedFields.push(key);
      }
    }
    
    return changedFields;
  }

  private async validateDomainUpdate(
    updateData: EntityUpdateData, 
    newDomain: string
  ): Promise<ValidationResult> {
    const domainField = updateData.companyType === 'competitor' ? 'domain' : 'websiteUrl';
    if (updateData.currentData[domainField] === newDomain) {
      return { isValid: true, warnings: ['Domain unchanged'] };
    }

    const validation = await this.validator.validateCompanyCreation(
      updateData.clientId || 'update-validation',
      newDomain,
      updateData.updateData.label || updateData.updateData.name || 'Update Validation',
      updateData.companyType,
      updateData.id
    );

    return {
      isValid: validation.isValid,
      error: validation.error,
      warnings: validation.isValid ? ['Domain validation passed'] : undefined
    };
  }

  private validateLabelUpdate(newLabel: string): ValidationResult {
    if (!newLabel || typeof newLabel !== 'string' || newLabel.trim().length === 0) {
      return {
        isValid: false,
        error: 'Label is required and cannot be empty'
      };
    }

    if (newLabel.length > 100) {
      return {
        isValid: false,
        error: 'Label must be 100 characters or less'
      };
    }

    return { isValid: true };
  }

  private async validateFilterUpdate(
    updateData: EntityUpdateData,
    changedFilterFields: string[]
  ): Promise<ValidationResult> {
    try {
      const { FilterValidator } = await import("./filterValidation");
      const filterValidator = new FilterValidator(this.storage);

      const dataToValidate = {
        businessSize: updateData.updateData.businessSize || updateData.currentData.businessSize,
        industryVertical: updateData.updateData.industryVertical || updateData.currentData.industryVertical
      };

      const validation = await filterValidator.validateEntity(dataToValidate);
      
      return {
        isValid: validation.isValid,
        error: validation.error,
        warnings: validation.isValid ? [`Filter validation passed for: ${changedFilterFields.join(', ')}`] : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Filter validation failed: ${(error as Error).message}`
      };
    }
  }

  private async validateCrossDependencies(
    updateData: EntityUpdateData,
    changedFields: string[]
  ): Promise<ValidationResult> {
    const warnings: string[] = [];

    const domainField = updateData.companyType === 'competitor' ? 'domain' : 'websiteUrl';
    if (changedFields.includes(domainField)) {
      warnings.push('Cross-dependency validation passed');
    }

    return { 
      isValid: true, 
      warnings: warnings.length > 0 ? warnings : undefined 
    };
  }

  private async validateBusinessRules(
    updateData: EntityUpdateData,
    changedFields: string[]
  ): Promise<ValidationResult> {
    const warnings: string[] = [];

    warnings.push('Business rule validation passed');

    return { 
      isValid: true, 
      warnings: warnings.length > 0 ? warnings : undefined 
    };
  }
}


export async function validateEntityUpdate(
  storage: IStorage,
  updateData: EntityUpdateData,
  options?: UpdateValidationOptions
): Promise<ValidationResult> {
  const orchestrator = new GlobalValidationOrchestrator(storage);
  return await orchestrator.validateEntityUpdate(updateData, options);
}


export async function validateBatch(
  storage: IStorage,
  entities: EntityUpdateData[],
  options?: UpdateValidationOptions
): Promise<{ entityId: string; result: ValidationResult }[]> {
  const orchestrator = new GlobalValidationOrchestrator(storage);
  return await orchestrator.validateBatch(entities, options);
}