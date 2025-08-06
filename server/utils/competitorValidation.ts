import { IStorage } from "../storage";
import { GlobalCompanyValidator } from "./globalCompanyValidation";

/**
 * Competitor-specific validation utilities (uses global validator)
 */
export class CompetitorValidator extends GlobalCompanyValidator {
  constructor(storage: IStorage) {
    super(storage);
  }

  /**
   * Competitor-specific validation wrapper
   */
  async validateCompetitorCreation(clientId: string, domain: string, label: string): Promise<{
    isValid: boolean;
    error?: string;
    normalizedDomain?: string;
  }> {
    return this.validateCompanyCreation(clientId, domain, label, 'competitor');
  }
}