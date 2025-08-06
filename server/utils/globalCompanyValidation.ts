import { IStorage } from "../storage";
import logger from "../utils/logger";
import { semrushService } from "../services/semrush/semrushService";

export type CompanyType = 'competitor' | 'portfolio' | 'benchmark' | 'client';

/**
 * Global company validation utilities for all company types
 * Phases 1 & 2: Domain validation and SEMrush API health checks
 */
export class GlobalCompanyValidator {
  constructor(private storage: IStorage) {}

  /**
   * Phase 1: Domain format validation and normalization
   */
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
      
      // Basic domain validation regex
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!domainRegex.test(normalizedDomain)) {
        return {
          isValid: false,
          error: 'Invalid domain format. Please enter a valid domain (e.g., example.com)'
        };
      }

      // Check for minimum domain structure (at least one dot)
      if (!normalizedDomain.includes('.')) {
        return {
          isValid: false,
          error: 'Domain must include a top-level domain (e.g., .com, .org)'
        };
      }

      // Check for reasonable length
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

  /**
   * Phase 1: Check for duplicate domains across company types
   */
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
      
      // Check competitors
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

      // Check portfolio companies (they use 'websiteUrl' instead of 'domain')
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

      // Check benchmark companies (they also use 'websiteUrl' instead of 'domain')
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
      
      // On error, assume not duplicate to avoid blocking valid additions
      return { isDuplicate: false };
    }
  }

  /**
   * Phase 2: SEMrush API Health Check
   * Test if domain is accessible and returns data from SEMrush
   */
  async validateSemrushApiAccess(domain: string, companyType: CompanyType): Promise<{
    isValid: boolean;
    error?: string;
    apiHealthStatus?: string;
  }> {
    // Skip SEMrush validation for clients (they don't need SEMrush data)
    if (companyType === 'client') {
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

      // Test SEMrush API connectivity with timeout and retry logic
      const startTime = Date.now();
      const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds (increased from 15)
      const MAX_RETRIES = 2; // Allow one retry
      
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.info('SEMrush health check attempt', {
            domain: normalizedDomain,
            attempt,
            maxRetries: MAX_RETRIES
          });

          // Wrap the health check in a timeout promise
          const healthCheckPromise = semrushService.fetchHistoricalData(normalizedDomain);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT);
          });
          
          // Race between the health check and timeout
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

          // If this was the last attempt, handle the error
          if (attempt === MAX_RETRIES) {
            break; // Exit the retry loop
          }

          // Add a small delay before retry to allow for network recovery
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Handle the final error after all retries exhausted
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

        // Handle specific API error types
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

        // Generic API error
        return {
          isValid: false,
          error: `Unable to connect to SEMrush for domain "${normalizedDomain}" after ${MAX_RETRIES} attempts. Please verify the domain and try again.`,
          apiHealthStatus: 'api_error'
        };
      }

      // Fallback in case no error was captured (should not happen, but required for TypeScript)
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

  /**
   * Comprehensive validation for company creation (Phases 1 & 2)
   */
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
    // Step 1: Validate domain format
    const domainValidation = this.validateAndNormalizeDomain(domain);
    if (!domainValidation.isValid) {
      return {
        isValid: false,
        error: domainValidation.error
      };
    }

    // Step 2: Check for duplicates across all company types
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

    // Step 3: Validate label
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

    // Step 4: Phase 2 - SEMrush API Health Check
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

  /**
   * Normalize domain by removing protocol, www, paths, etc.
   */
  private normalizeDomain(domain: string): string {
    if (!domain) return '';
    
    try {
      // Convert to lowercase
      let normalized = domain.toLowerCase().trim();
      
      // Remove protocol if present
      normalized = normalized.replace(/^https?:\/\//, '');
      
      // Remove www. prefix
      normalized = normalized.replace(/^www\./, '');
      
      // Remove trailing slash and path
      normalized = normalized.split('/')[0];
      
      // Remove port if present
      normalized = normalized.split(':')[0];
      
      // Remove query parameters
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

  /**
   * Get user-friendly display name for company type
   */
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