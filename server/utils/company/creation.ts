

import { z } from "zod";
import logger from "../logging/logger";
import { backgroundProcessor } from "../background-processor";

export type CompanyType = 'portfolio' | 'competitor' | 'benchmark' | 'client';

export interface CompanyCreationOptions<T = any> {
  companyType: CompanyType;
  validationSchema: z.ZodSchema<T>;
  requestBody: any;
  requestUser?: { id: string };
  requiresFilterValidation?: boolean;
  requiresDomainValidation?: boolean;
  postCreationWorkflows?: Array<{
    name: string;
    handler: (company: any) => Promise<any>;
    isBackground?: boolean;
  }>;
  additionalSetup?: {
    handler: (company: any, requestBody: any) => Promise<void>;
    failClientCreation?: boolean; // Whether setup failure should fail company creation
  };
}

export interface CreationResult<T = any> {
  success: boolean;
  company?: T;
  error?: string;
  validationErrors?: any;
  workflowResults?: { [key: string]: any };
}


export async function createCompanyWithWorkflows<T>(
  options: CompanyCreationOptions<T>,
  storage: any
): Promise<CreationResult<T>> {
  const { companyType, validationSchema, requestBody, requestUser } = options;
  
  try {
    logger.info(`Starting ${companyType} company creation`, { 
      companyType,
      requestUser: requestUser?.id,
      hasFilterValidation: options.requiresFilterValidation 
    });

    let validatedData: T;
    try {
      validatedData = validationSchema.parse(requestBody);
    } catch (validationError) {
      logger.warn(`${companyType} creation - schema validation failed`, {
        companyType,
        error: validationError instanceof z.ZodError ? validationError.errors : (validationError as Error).message
      });
      return {
        success: false,
        error: "Invalid data",
        validationErrors: validationError instanceof z.ZodError ? validationError.errors : undefined
      };
    }

    if (options.requiresFilterValidation) {
      const filterValidationResult = await performFilterValidation(validatedData, storage, companyType);
      if (!filterValidationResult.isValid) {
        return {
          success: false,
          error: filterValidationResult.error
        };
      }
    }

    if (options.requiresDomainValidation) {
      const domainValidationResult = await performDomainValidation(
        validatedData, 
        storage, 
        companyType,
        requestBody.clientId
      );
      if (!domainValidationResult.isValid) {
        return {
          success: false,
          error: domainValidationResult.error
        };
      }
      
      if (domainValidationResult.normalizedDomain) {
        const domainField = companyType === 'competitor' ? 'domain' : 'websiteUrl';
        (validatedData as any)[domainField] = domainValidationResult.normalizedDomain;
      }
    }

    const company = await createCompanyRecord(companyType, validatedData, storage);
    
    logger.info(`${companyType} company created successfully`, {
      companyType,
      companyId: company.id,
      companyName: getCompanyDisplayName(company),
      requestUser: requestUser?.id
    });

    if (options.additionalSetup) {
      try {
        await options.additionalSetup.handler(company, requestBody);
        logger.info(`${companyType} additional setup completed`, { companyId: company.id });
      } catch (setupError) {
        const errorMessage = (setupError as Error).message;
        logger.warn(`${companyType} additional setup failed`, {
          companyId: company.id,
          error: errorMessage
        });
        
        if (options.additionalSetup.failClientCreation) {
          await deleteCreatedCompany(companyType, company.id, storage);
          return {
            success: false,
            error: `Setup failed: ${errorMessage}`
          };
        }
      }
    }

    const workflowResults: { [key: string]: any } = {};
    if (options.postCreationWorkflows) {
      for (const workflow of options.postCreationWorkflows) {
        try {
          if (workflow.isBackground) {
            const jobId = backgroundProcessor.enqueue({
              id: `${companyType.toUpperCase()}_INTEGRATION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'COMPETITOR_INTEGRATION',
              data: { company, companyType, workflowName: workflow.name },
              processor: async (job) => {
                try {
                  const result = await workflow.handler(job.data.company);
                  logger.info(`${job.data.workflowName} completed for ${job.data.companyType}`, {
                    companyId: job.data.company.id,
                    companyName: getCompanyDisplayName(job.data.company),
                    result
                  });
                  return result;
                } catch (error) {
                  logger.error(`${job.data.workflowName} failed for ${job.data.companyType}`, {
                    companyId: job.data.company.id,
                    companyName: getCompanyDisplayName(job.data.company),
                    error: (error as Error).message
                  });
                  throw error;
                }
              }
            });
            
            logger.info(`${workflow.name} started in background for ${companyType}`, {
              companyId: company.id,
              jobId
            });
          } else {
            const result = await workflow.handler(company);
            workflowResults[workflow.name] = result;
            logger.info(`${workflow.name} completed synchronously for ${companyType}`, {
              companyId: company.id,
              result
            });
          }
        } catch (workflowError) {
          logger.error(`${workflow.name} failed for ${companyType}`, {
            companyId: company.id,
            error: (workflowError as Error).message,
            stack: (workflowError as Error).stack
          });
          workflowResults[workflow.name] = { error: (workflowError as Error).message };
          
          if (workflow.name === 'SEMrush Competitor Integration') {
            logger.error(`Critical SEMrush integration failed - failing competitor creation`, {
              companyId: company.id,
              error: (workflowError as Error).message
            });
            
            await deleteCreatedCompany(companyType, company.id, storage);
            
            return {
              success: false,
              error: `SEMrush integration failed: ${(workflowError as Error).message}`
            };
          }
        }
      }
    }

    logger.info(`Complete ${companyType} company creation finished`, {
      companyId: company.id,
      companyName: getCompanyDisplayName(company),
      workflowsExecuted: Object.keys(workflowResults).length,
      hasBackgroundWorkflows: options.postCreationWorkflows?.some(w => w.isBackground) || false
    });

    return {
      success: true,
      company,
      workflowResults
    };

  } catch (error) {
    logger.error(`Failed to create ${companyType} company`, {
      companyType,
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestUser: requestUser?.id
    });
    
    return {
      success: false,
      error: (error as Error).message
    };
  }
}


async function performFilterValidation(
  validatedData: any, 
  storage: any, 
  companyType: string
): Promise<{ isValid: boolean; error?: string }> {
  if (!validatedData.businessSize && !validatedData.industryVertical) {
    return { isValid: true }; // No filter fields to validate
  }

  try {
    const { FilterValidator } = await import("../filterValidation");
    const validator = new FilterValidator(storage);
    const filterValidation = await validator.validateEntity({
      businessSize: validatedData.businessSize,
      industryVertical: validatedData.industryVertical
    });
    
    if (!filterValidation.isValid) {
      logger.warn(`${companyType} creation - filter validation failed`, {
        companyType,
        businessSize: validatedData.businessSize,
        industryVertical: validatedData.industryVertical,
        error: filterValidation.error
      });
      return { isValid: false, error: filterValidation.error };
    }
    
    return { isValid: true };
  } catch (error) {
    logger.error(`Filter validation error for ${companyType}`, {
      error: (error as Error).message
    });
    return { isValid: false, error: "Filter validation failed" };
  }
}


async function performDomainValidation(
  validatedData: any, 
  storage: any, 
  companyType: CompanyType,
  clientId?: string
): Promise<{ isValid: boolean; error?: string; normalizedDomain?: string }> {
  const domainField = companyType === 'competitor' ? 'domain' : 'websiteUrl';
  const domain = (validatedData as any)[domainField];
  const label = (validatedData as any).label || (validatedData as any).name;

  if (!domain) {
    return { isValid: true };
  }

  try {
    const { GlobalCompanyValidator } = await import("./validation");
    const validator = new GlobalCompanyValidator(storage);
    
    const effectiveClientId = clientId || 'demo-client-id';
    
    const domainValidation = await validator.validateCompanyCreation(
      effectiveClientId, 
      domain, 
      label, 
      companyType
    );
    
    if (!domainValidation.isValid) {
      logger.warn(`${companyType} creation - domain validation failed`, {
        companyType,
        domain,
        label,
        clientId: effectiveClientId,
        error: domainValidation.error
      });
      return { isValid: false, error: domainValidation.error };
    }
    
    logger.info(`${companyType} creation - domain validation passed`, {
      companyType,
      domain,
      normalizedDomain: domainValidation.normalizedDomain,
      clientId: effectiveClientId
    });
    
    return { 
      isValid: true, 
      normalizedDomain: domainValidation.normalizedDomain 
    };
  } catch (error) {
    logger.error(`Domain validation error for ${companyType}`, {
      domain,
      companyType,
      error: (error as Error).message
    });
    return { isValid: false, error: "Domain validation failed" };
  }
}


async function createCompanyRecord(companyType: CompanyType, validatedData: any, storage: any): Promise<any> {
  switch (companyType) {
    case 'portfolio':
      return await storage.createCdPortfolioCompany(validatedData);
    case 'competitor':
      return await storage.createCompetitor(validatedData);
    case 'benchmark':
      return await storage.createBenchmarkCompany(validatedData);
    case 'client':
      return await storage.createClient(validatedData);
    default:
      throw new Error(`Unknown company type: ${companyType}`);
  }
}


async function deleteCreatedCompany(companyType: CompanyType, companyId: string, storage: any): Promise<void> {
  try {
    switch (companyType) {
      case 'portfolio':
        await storage.deleteCdPortfolioCompany(companyId);
        break;
      case 'competitor':
        await storage.deleteCompetitor(companyId);
        break;
      case 'benchmark':
        await storage.deleteBenchmarkCompany(companyId);
        break;
      case 'client':
        await storage.deleteClient(companyId);
        break;
    }
    logger.info(`Cleaned up ${companyType} company after setup failure`, { companyId });
  } catch (cleanupError) {
    logger.error(`Failed to cleanup ${companyType} company after setup failure`, {
      companyId,
      error: (cleanupError as Error).message
    });
  }
}


function getCompanyDisplayName(company: any): string {
  return company.name || company.domain || company.label || 'Unknown';
}


export async function createPortfolioCompanyEnhanced(
  requestBody: any,
  requestUser: { id: string },
  storage: any,
  insertSchema: z.ZodSchema
): Promise<CreationResult> {
  return await createCompanyWithWorkflows({
    companyType: 'portfolio',
    validationSchema: insertSchema,
    requestBody,
    requestUser,
    requiresFilterValidation: true,
    requiresDomainValidation: true,
    postCreationWorkflows: [{
      name: 'SEMrush Integration',
      isBackground: true,
      handler: async (company) => {
        const { PortfolioIntegration } = await import('../../services/semrush/portfolioIntegration');
        const integration = new PortfolioIntegration(storage);
        return await integration.processNewPortfolioCompany(company);
      }
    }]
  }, storage);
}


export async function createCompetitorEnhanced(
  requestBody: any,
  requestUser: { id: string },
  storage: any,
  insertSchema: z.ZodSchema
): Promise<CreationResult> {
  try {
    const { CompetitorValidator } = await import('../competitorValidation');
    const validator = new CompetitorValidator(storage);
    
    const validationResult = await validator.validateCompetitorCreation(
      requestBody.clientId,
      requestBody.domain,
      requestBody.label
    );
    
    if (!validationResult.isValid) {
      logger.warn('Competitor pre-creation validation failed', {
        clientId: requestBody.clientId,
        domain: requestBody.domain,
        error: validationResult.error
      });
      
      return {
        success: false,
        error: validationResult.error
      };
    }
    
    if (validationResult.normalizedDomain) {
      requestBody.domain = validationResult.normalizedDomain;
    }
    
    logger.info('Competitor pre-creation validation passed', {
      clientId: requestBody.clientId,
      originalDomain: requestBody.domain,
      normalizedDomain: validationResult.normalizedDomain
    });
    
  } catch (validationError) {
    logger.error('Error during competitor pre-creation validation', {
      error: (validationError as Error).message,
      clientId: requestBody.clientId,
      domain: requestBody.domain
    });
    

  }

  return await createCompanyWithWorkflows({
    companyType: 'competitor',
    validationSchema: insertSchema,
    requestBody,
    requestUser,
    requiresFilterValidation: false,
    requiresDomainValidation: false,
    postCreationWorkflows: [{
      name: 'SEMrush Competitor Integration',
      isBackground: false,
      handler: async (competitor) => {
        const { CompetitorIntegration } = await import('../../services/semrush/competitorIntegration');
        const integration = new CompetitorIntegration(storage);
        return await integration.processNewCompetitor(competitor);
      }
    }]
  }, storage);
}


export async function createBenchmarkCompanyEnhanced(
  requestBody: any,
  requestUser: { id: string },
  storage: any,
  insertSchema: z.ZodSchema
): Promise<CreationResult> {
  return await createCompanyWithWorkflows({
    companyType: 'benchmark',
    validationSchema: insertSchema,
    requestBody,
    requestUser,
    requiresFilterValidation: true,
    requiresDomainValidation: true
  }, storage);
}


export async function createClientEnhanced(
  requestBody: any,
  requestUser: { id: string },
  storage: any,
  insertSchema: z.ZodSchema
): Promise<CreationResult> {
  const { serviceAccountId, ...clientData } = requestBody;
  
  return await createCompanyWithWorkflows({
    companyType: 'client',
    validationSchema: insertSchema,
    requestBody: clientData,
    requestUser,
    requiresFilterValidation: true,
    additionalSetup: serviceAccountId && clientData.ga4PropertyId ? {
      handler: async (client, originalBody) => {
        await storage.createGA4PropertyAccess({
          clientId: client.id,
          propertyId: client.ga4PropertyId,
          serviceAccountId: serviceAccountId,
        });
        logger.info("Created GA4 property access for new client", { 
          clientId: client.id, 
          propertyId: client.ga4PropertyId,
          serviceAccountId: serviceAccountId
        });
      },
      failClientCreation: false
    } : undefined
  }, storage);
}