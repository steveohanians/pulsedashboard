import { IStorage } from "../storage";
import logger from "../utils/logger";

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
          existingDomain: duplicateCompetitor.domain
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
   * Comprehensive pre-creation validation
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
      return {
        isValid: false,
        error: `Competitor "${duplicateCheck.existingCompetitor?.label || domainValidation.normalizedDomain}" already exists for this domain. Each domain can only be added once per client.`
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

    return {
      isValid: true,
      normalizedDomain: domainValidation.normalizedDomain
    };
  }
}