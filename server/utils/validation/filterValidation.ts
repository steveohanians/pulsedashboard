// Filter validation utilities to ensure data integrity
// Validates that business sizes and industry verticals match filter_options table

import type { IStorage } from '../storage.js';

export interface FilterValidationResult {
  isValid: boolean;
  error?: string;
}

export class FilterValidator {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async validateBusinessSize(businessSize: string): Promise<FilterValidationResult> {
    try {
      const filterOptions = await this.storage.getFilterOptions();
      const validBusinessSizes = filterOptions
        .filter(option => option.category === 'businessSizes' && option.active)
        .map(option => option.value);

      if (!validBusinessSizes.includes(businessSize)) {
        return {
          isValid: false,
          error: `Invalid business size: "${businessSize}". Valid options: ${validBusinessSizes.join(', ')}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate business size: ${(error as Error).message}`
      };
    }
  }

  async validateIndustryVertical(industryVertical: string): Promise<FilterValidationResult> {
    try {
      const filterOptions = await this.storage.getFilterOptions();
      const validIndustryVerticals = filterOptions
        .filter(option => option.category === 'industryVerticals' && option.active)
        .map(option => option.value);

      if (!validIndustryVerticals.includes(industryVertical)) {
        return {
          isValid: false,
          error: `Invalid industry vertical: "${industryVertical}". Valid options: ${validIndustryVerticals.join(', ')}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate industry vertical: ${(error as Error).message}`
      };
    }
  }

  async validateEntity(data: { businessSize: string; industryVertical: string }): Promise<FilterValidationResult> {
    const businessSizeResult = await this.validateBusinessSize(data.businessSize);
    if (!businessSizeResult.isValid) {
      return businessSizeResult;
    }

    const industryVerticalResult = await this.validateIndustryVertical(data.industryVertical);
    if (!industryVerticalResult.isValid) {
      return industryVerticalResult;
    }

    return { isValid: true };
  }
}