import { IStorage } from "../storage";
import logger from "../utils/logger";
import { semrushService } from "../services/semrush/semrushService";

/**
 * Domain validation utilities for competitor creation
 */
export class CompetitorValidator {
  constructor(private storage: IStorage) {}

  /**
   * Check if competitor domain already exists for this client
   */
  async checkForDuplicateDomain(clientId: string, domain: string): Promise<{ isDuplicate: boolean; existingCompetitor?: any }> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      
      // Get all competitors for this client
      const existingCompetitors = await this.storage.getCompetitorsByClient(clientId);
      
      // Check for duplicate domains (normalized comparison)
      const duplicateCompetitor = existingCompetitors.find(competitor => 
        this.normalizeDomain(competitor.domain) === normalizedDomain
      );
      
      if (duplicateCompetitor) {
        logger.warn('Duplicate competitor domain detected', {
          clientId,
          attemptedDomain: domain,
          normalizedDomain,
          existingCompetitorId: duplicateCompetitor.id,
          existingDomain: duplicateCompetitor.domain,
          existingCompetitorLabel: duplicateCompetitor.label,
          existingCompetitorName: duplicateCompetitor.name,
          fullCompetitorData: duplicateCompetitor
        });
        
        return {
          isDuplicate: true,
          existingCompetitor: duplicateCompetitor
        };
      }
      
      return { isDuplicate: false };
    } catch (error) {
      logger.error('Error checking for duplicate competitor domain', {
        clientId,
        domain,
        error: (error as Error).message
      });
      
      // On error, assume not duplicate to avoid blocking valid additions
      return { isDuplicate: false };
    }
  }

  /**
   * Validate domain format and normalize it
   */
  validateAndNormalizeDomain(domain: string): { isValid: boolean; normalizedDomain?: string; error?: string } {
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
   * Normalize domain for consistent comparison
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
   * Phase 2: SEMrush API Health Check
   * Test if domain is accessible and returns data from SEMrush
   */
  async validateSemrushApiAccess(domain: string): Promise<{
    isValid: boolean;
    error?: string;
    apiHealthStatus?: string;
  }> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      
      logger.info('Starting SEMrush API health check', {
        domain,
        normalizedDomain
      });

      // Test SEMrush API connectivity with timeout
      const startTime = Date.now();
      const HEALTH_CHECK_TIMEOUT = 15000; // 15 seconds
      
      try {
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

      } catch (apiError: any) {
        const responseTime = Date.now() - startTime;
        
        logger.warn('SEMrush API health check failed', {
          domain: normalizedDomain,
          responseTime,
          error: apiError.message,
          errorType: apiError.name || 'Unknown'
        });

        // Handle specific API error types
        if (apiError.message?.includes('timeout') || responseTime > 30000) {
          return {
            isValid: false,
            error: 'SEMrush API is experiencing delays. Please try again in a few minutes.',
            apiHealthStatus: 'timeout'
          };
        }

        if (apiError.message?.includes('rate limit') || apiError.message?.includes('quota')) {
          return {
            isValid: false,
            error: 'SEMrush API rate limit reached. Please try again later.',
            apiHealthStatus: 'rate_limited'
          };
        }

        if (apiError.message?.includes('unauthorized') || apiError.message?.includes('authentication')) {
          return {
            isValid: false,
            error: 'SEMrush API authentication issue. Please contact support.',
            apiHealthStatus: 'auth_failed'
          };
        }

        // Generic API error
        return {
          isValid: false,
          error: `Unable to connect to SEMrush for domain "${normalizedDomain}". Please verify the domain and try again.`,
          apiHealthStatus: 'api_error'
        };
      }

    } catch (error) {
      logger.error('Unexpected error during SEMrush API health check', {
        domain,
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
   * Comprehensive pre-creation validation (Enhanced with Phase 2)
   */
  async validateCompetitorCreation(clientId: string, domain: string, label: string): Promise<{
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

    // Step 2: Check for duplicates
    const duplicateCheck = await this.checkForDuplicateDomain(clientId, domain);
    if (duplicateCheck.isDuplicate) {
      const existingCompetitor = duplicateCheck.existingCompetitor;
      const existingLabel = existingCompetitor?.label || existingCompetitor?.name || 'Unknown Competitor';
      const existingDomain = this.normalizeDomain(existingCompetitor?.domain || domainValidation.normalizedDomain!);
      
      logger.info('Generating duplicate error message', {
        existingLabel,
        existingDomain,
        existingCompetitor
      });
      
      return {
        isValid: false,
        error: `This domain is already being tracked as competitor "${existingLabel}". Each domain can only be added once.`
      };
    }

    // Step 3: Validate label
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return {
        isValid: false,
        error: 'Competitor label is required'
      };
    }

    if (label.length > 100) {
      return {
        isValid: false,
        error: 'Competitor label must be 100 characters or less'
      };
    }

    // Step 4: Phase 2 - SEMrush API Health Check
    const semrushValidation = await this.validateSemrushApiAccess(domain);
    if (!semrushValidation.isValid) {
      return {
        isValid: false,
        error: semrushValidation.error
      };
    }

    logger.info('Competitor validation passed all checks', {
      clientId,
      domain,
      label,
      normalizedDomain: domainValidation.normalizedDomain,
      semrushStatus: semrushValidation.apiHealthStatus
    });

    return {
      isValid: true,
      normalizedDomain: domainValidation.normalizedDomain
    };
  }
}