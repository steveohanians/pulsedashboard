import { IStorage } from "../../storage";
import logger from "../logging/logger";

export type CompanyType = 'competitor' | 'portfolio' | 'benchmark' | 'client';

// Interface for SEMrush validation to enable dependency inversion
export interface ISemrushValidator {
  fetchHistoricalData(domain: string): Promise<Map<string, any>>;
}

export class GlobalCompanyValidator {
  constructor(
    private storage: IStorage,
    private semrushValidator?: ISemrushValidator
  ) {}


  validateAndNormalizeDomain(domain: string): { 
    isValid: boolean; 
    normalizedDomain?: string; 
    error?: string; 
  } {
    try {
      if (!domain || typeof domain !== 'string') {
        return {
          isValid: false,
          error: 'Domain is required and must be a string'
        };
      }

      const normalizedDomain = this.normalizeDomain(domain);
      
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!domainRegex.test(normalizedDomain)) {
        return {
          isValid: false,
          error: 'Invalid domain format. Please enter a valid domain (e.g., example.com)'
        };
      }

      if (!normalizedDomain.includes('.')) {
        return {
          isValid: false,
          error: 'Domain must include a top-level domain (e.g., .com, .org)'
        };
      }

      if (normalizedDomain.length > 253) {
        return {
          isValid: false,
          error: 'Domain name is too long (maximum 253 characters)'
        };
      }

      return {
        isValid: true,
        normalizedDomain
      };
    } catch (error) {
      logger.error('Error validating domain format', {
        domain,
        error: (error as Error).message
      });
      
      return {
        isValid: false,
        error: 'Unable to validate domain format'
      };
    }
  }


  async checkForDuplicateDomain(
    clientId: string, 
    domain: string, 
    companyType: CompanyType,
    excludeCompanyId?: string
  ): Promise<{ 
    isDuplicate: boolean; 
    existingCompany?: any;
    conflictingType?: CompanyType;
  }> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      
      const existingCompetitors = await this.storage.getCompetitorsByClient(clientId);
      const duplicateCompetitor = existingCompetitors.find(company => 
        company.id !== excludeCompanyId &&
        this.normalizeDomain(company.domain) === normalizedDomain
      );
      
      if (duplicateCompetitor) {
        logger.warn('Duplicate domain found in competitors', {
          clientId,
          attemptedDomain: domain,
          normalizedDomain,
          existingCompanyId: duplicateCompetitor.id,
          existingDomain: duplicateCompetitor.domain,
          companyType
        });
        
        return {
          isDuplicate: true,
          existingCompany: duplicateCompetitor,
          conflictingType: 'competitor'
        };
      }

      const portfolioCompanies = await this.storage.getCdPortfolioCompanies();
      const duplicatePortfolio = portfolioCompanies.find(company => 
        company.id !== excludeCompanyId &&
        company.websiteUrl && this.normalizeDomain(company.websiteUrl) === normalizedDomain
      );
      
      if (duplicatePortfolio) {
        logger.warn('Duplicate domain found in portfolio companies', {
          clientId,
          attemptedDomain: domain,
          normalizedDomain,
          existingCompanyId: duplicatePortfolio.id,
          existingDomain: duplicatePortfolio.websiteUrl,
          companyType
        });
        
        return {
          isDuplicate: true,
          existingCompany: { ...duplicatePortfolio, domain: duplicatePortfolio.websiteUrl },
          conflictingType: 'portfolio'
        };
      }

      const benchmarkCompanies = await this.storage.getBenchmarkCompanies();
      const duplicateBenchmark = benchmarkCompanies.find(company => 
        company.id !== excludeCompanyId &&
        company.websiteUrl && this.normalizeDomain(company.websiteUrl) === normalizedDomain
      );
      
      if (duplicateBenchmark) {
        logger.warn('Duplicate domain found in benchmark companies', {
          clientId,
          attemptedDomain: domain,
          normalizedDomain,
          existingCompanyId: duplicateBenchmark.id,
          existingDomain: duplicateBenchmark.websiteUrl,
          companyType
        });
        
        return {
          isDuplicate: true,
          existingCompany: { ...duplicateBenchmark, domain: duplicateBenchmark.websiteUrl },
          conflictingType: 'benchmark'
        };
      }
      
      return { isDuplicate: false };
    } catch (error) {
      logger.error('Error checking for duplicate domain', {
        clientId,
        domain,
        companyType,
        error: (error as Error).message
      });
      
      return { isDuplicate: false };
    }
  }


  async validateSemrushApiAccess(domain: string, companyType: CompanyType): Promise<{
    isValid: boolean;
    error?: string;
    apiHealthStatus?: string;
  }> {
    if (companyType === 'client' || !this.semrushValidator) {
      return {
        isValid: true,
        apiHealthStatus: 'skipped'
      };
    }

    try {
      const normalizedDomain = this.normalizeDomain(domain);
      
      logger.info('Starting SEMrush API health check', {
        domain,
        normalizedDomain,
        companyType
      });

      const startTime = Date.now();
      const HEALTH_CHECK_TIMEOUT = 30000;
      const MAX_RETRIES = 2;
      
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.info('SEMrush health check attempt', {
            domain: normalizedDomain,
            attempt,
            maxRetries: MAX_RETRIES
          });

          const healthCheckPromise = this.semrushValidator.fetchHistoricalData(normalizedDomain);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT);
          });
          
          const testData = await Promise.race([healthCheckPromise, timeoutPromise]) as Map<string, any>;
          const responseTime = Date.now() - startTime;
        
          logger.info('SEMrush API health check completed', {
            domain: normalizedDomain,
            companyType,
            attempt,
            responseTime,
            periodsReturned: testData.size,
            hasData: testData.size > 0
          });

          if (testData.size === 0) {
            return {
              isValid: false,
              error: `No SEMrush data available for "${normalizedDomain}". This domain may not have sufficient traffic or may not be tracked by SEMrush.`,
              apiHealthStatus: 'no_data'
            };
          }

          return {
            isValid: true,
            apiHealthStatus: 'healthy'
          };

        } catch (attemptError: any) {
          const responseTime = Date.now() - startTime;
          lastError = attemptError;
          
          logger.warn('SEMrush health check attempt failed', {
            domain: normalizedDomain,
            companyType,
            attempt,
            responseTime,
            error: attemptError.message,
            errorType: attemptError.name || 'Unknown',
            willRetry: attempt < MAX_RETRIES
          });

          if (attempt === MAX_RETRIES) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (lastError) {
        const responseTime = Date.now() - startTime;

        logger.error('SEMrush API health check failed after all retries', {
          domain: normalizedDomain,
          companyType,
          totalAttempts: MAX_RETRIES,
          responseTime,
          error: lastError.message,
          errorType: lastError.name || 'Unknown'
        });

        if (lastError.message?.includes('timeout') || responseTime > 60000) {
          return {
            isValid: false,
            error: 'SEMrush API is experiencing delays. The domain validation timed out after multiple attempts. Please try again in a few minutes.',
            apiHealthStatus: 'timeout'
          };
        }

        if (lastError.message?.includes('rate limit') || lastError.message?.includes('quota')) {
          return {
            isValid: false,
            error: 'SEMrush API rate limit reached. Please try again later.',
            apiHealthStatus: 'rate_limited'
          };
        }

        if (lastError.message?.includes('unauthorized') || lastError.message?.includes('authentication')) {
          return {
            isValid: false,
            error: 'SEMrush API authentication issue. Please contact support.',
            apiHealthStatus: 'auth_failed'
          };
        }

        return {
          isValid: false,
          error: `Unable to connect to SEMrush for domain "${normalizedDomain}" after ${MAX_RETRIES} attempts. Please verify the domain and try again.`,
          apiHealthStatus: 'api_error'
        };
      }

      return {
        isValid: false,
        error: 'Unexpected error during SEMrush validation. Please try again.',
        apiHealthStatus: 'unexpected_error'
      };

    } catch (error) {
      logger.error('Unexpected error during SEMrush API health check', {
        domain,
        companyType,
        error: (error as Error).message
      });
      
      return {
        isValid: false,
        error: 'Unexpected error validating domain with SEMrush. Please try again.',
        apiHealthStatus: 'unexpected_error'
      };
    }
  }


  async validateCompanyCreation(
    clientId: string, 
    domain: string, 
    label: string, 
    companyType: CompanyType,
    excludeCompanyId?: string
  ): Promise<{
    isValid: boolean;
    error?: string;
    normalizedDomain?: string;
  }> {
    const domainValidation = this.validateAndNormalizeDomain(domain);
    if (!domainValidation.isValid) {
      return {
        isValid: false,
        error: domainValidation.error
      };
    }

    const duplicateCheck = await this.checkForDuplicateDomain(clientId, domain, companyType, excludeCompanyId);
    if (duplicateCheck.isDuplicate) {
      const existingCompany = duplicateCheck.existingCompany;
      const existingLabel = existingCompany?.label || existingCompany?.name || 'Unknown Company';
      const existingDomain = this.normalizeDomain(existingCompany?.domain || domainValidation.normalizedDomain!);
      const conflictType = duplicateCheck.conflictingType;
      
      return {
        isValid: false,
        error: `This domain is already tracked as ${conflictType} "${existingLabel}" (${existingDomain}). Each domain can only be used once across all company types.`
      };
    }

    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return {
        isValid: false,
        error: `${this.getCompanyTypeDisplayName(companyType)} label is required`
      };
    }

    if (label.length > 100) {
      return {
        isValid: false,
        error: `${this.getCompanyTypeDisplayName(companyType)} label must be 100 characters or less`
      };
    }

    const semrushValidation = await this.validateSemrushApiAccess(domain, companyType);
    if (!semrushValidation.isValid) {
      return {
        isValid: false,
        error: semrushValidation.error
      };
    }

    logger.info('Company validation passed all checks', {
      clientId,
      domain,
      label,
      companyType,
      normalizedDomain: domainValidation.normalizedDomain,
      semrushStatus: semrushValidation.apiHealthStatus
    });

    return {
      isValid: true,
      normalizedDomain: domainValidation.normalizedDomain
    };
  }


  private normalizeDomain(domain: string): string {
    if (!domain) return '';
    
    try {
      let normalized = domain.toLowerCase().trim();
      
      normalized = normalized.replace(/^https?:\/\//, '');
      normalized = normalized.replace(/^www\./, '');
      normalized = normalized.split('/')[0];
      normalized = normalized.split(':')[0];
      normalized = normalized.split('?')[0];
      
      return normalized;
    } catch (error) {
      logger.error('Error normalizing domain', {
        domain,
        error: (error as Error).message
      });
      return domain.toLowerCase().trim();
    }
  }


  private getCompanyTypeDisplayName(companyType: CompanyType): string {
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
}