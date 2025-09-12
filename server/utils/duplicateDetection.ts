import type { BenchmarkCompany, InsertBenchmarkCompany } from "@shared/schema";
import logger from "./logging/logger";

/**
 * Information about an existing company for duplicate comparison
 */
export interface ExistingCompanyInfo {
  id: string;
  name: string;
  websiteUrl: string;
  industryVertical: string;
  businessSize: string;
  sourceVerified: boolean;
  active: boolean;
  createdAt: Date;
  source: 'database' | 'csv_internal';
}

/**
 * Detailed validation result for a single CSV row
 */
export interface ValidationResult {
  row: number;
  status: 'valid' | 'duplicate' | 'invalid';
  originalData: Record<string, string>;
  cleanedData: Record<string, string>;
  errors: string[];
  duplicateInfo?: {
    existingCompany: ExistingCompanyInfo;
    matchReason: 'exact_name' | 'domain_match' | 'internal_duplicate';
  };
}

/**
 * Overall CSV validation results
 */
export interface CSVValidationResults {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  results: ValidationResult[];
}

/**
 * Standardizes a website URL to extract the domain for comparison
 * 
 * Examples:
 * - "company.com" → "company.com"
 * - "https://www.company.com/" → "company.com"
 * - "http://company.com/path" → "company.com"
 * - "www.company.com" → "company.com"
 * 
 * @param websiteUrl - The website URL to standardize
 * @returns The standardized domain
 */
export function standardizeWebsiteUrl(websiteUrl: string): string {
  if (!websiteUrl || typeof websiteUrl !== 'string') {
    return '';
  }

  try {
    let url = websiteUrl.trim().toLowerCase();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    
    // Remove 'www.' prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch (error) {
    logger.warn('Failed to parse website URL', { 
      websiteUrl, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Fallback: try to extract domain manually
    let cleaned = websiteUrl.trim().toLowerCase();
    
    // Remove protocol
    cleaned = cleaned.replace(/^https?:\/\//, '');
    
    // Remove www
    cleaned = cleaned.replace(/^www\./, '');
    
    // Remove path, query, and fragment
    cleaned = cleaned.split('/')[0];
    cleaned = cleaned.split('?')[0];
    cleaned = cleaned.split('#')[0];
    
    return cleaned;
  }
}

/**
 * Standardizes a company name for comparison by:
 * - Converting to lowercase
 * - Trimming whitespace
 * - Normalizing multiple spaces to single spaces
 * 
 * @param name - The company name to standardize
 * @returns The standardized company name
 */
export function standardizeCompanyName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Cleans and standardizes CSV row data for benchmark company import
 * 
 * @param originalData - Raw data from CSV row
 * @param columnMapping - Mapping from database fields to CSV columns
 * @returns Cleaned and standardized data
 */
export function cleanRowData(
  originalData: Record<string, string>,
  columnMapping: Record<string, string>
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  
  // Map CSV columns to database fields and clean the data
  Object.entries(columnMapping).forEach(([dbField, csvColumn]) => {
    if (csvColumn && originalData[csvColumn] !== undefined) {
      let value = originalData[csvColumn];
      
      if (typeof value === 'string') {
        value = value.trim();
      }
      
      // Special handling for specific fields
      if (dbField === 'name' && value) {
        // Keep original case for display but ensure it's cleaned
        cleaned[dbField] = value.replace(/\s+/g, ' ');
      } else if (dbField === 'websiteUrl' && value) {
        // Ensure URL has protocol for storage, but don't change domain case
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          cleaned[dbField] = `https://${value}`;
        } else {
          cleaned[dbField] = value;
        }
      } else if (dbField === 'sourceVerified' || dbField === 'active') {
        // Handle boolean fields
        const boolValue = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
        cleaned[dbField] = String(boolValue);
      } else {
        cleaned[dbField] = value;
      }
    }
  });
  
  // Set defaults for boolean fields if not provided
  if (!cleaned.sourceVerified) {
    cleaned.sourceVerified = 'false';
  }
  if (!cleaned.active) {
    cleaned.active = 'true';
  }
  
  return cleaned;
}

/**
 * Validates that all required fields are present in the cleaned data
 * 
 * @param cleanedData - The cleaned row data
 * @returns Array of validation error messages
 */
export function validateRequiredFields(cleanedData: Record<string, string>): string[] {
  const errors: string[] = [];
  const requiredFields = ['name', 'websiteUrl', 'industryVertical', 'businessSize'];
  
  requiredFields.forEach(field => {
    if (!cleanedData[field] || cleanedData[field].trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  return errors;
}

/**
 * Detects duplicate benchmark companies in CSV data
 * 
 * @param csvData - Array of parsed CSV records
 * @param columnMapping - Mapping from database fields to CSV columns
 * @param existingCompanies - Array of existing benchmark companies in the database
 * @returns Comprehensive validation results
 */
export function detectDuplicates(
  csvData: Record<string, any>[],
  columnMapping: Record<string, string>,
  existingCompanies: BenchmarkCompany[]
): CSVValidationResults {
  const results: ValidationResult[] = [];
  const internalCompanies = new Map<string, number>(); // Track internal duplicates by standardized name
  const internalDomains = new Map<string, number>(); // Track internal duplicates by domain
  
  // Pre-process existing companies for efficient lookup
  const existingNameMap = new Map<string, BenchmarkCompany>();
  const existingDomainMap = new Map<string, BenchmarkCompany>();
  
  existingCompanies.forEach(company => {
    const standardizedName = standardizeCompanyName(company.name);
    const standardizedDomain = standardizeWebsiteUrl(company.websiteUrl);
    
    if (standardizedName) {
      existingNameMap.set(standardizedName, company);
    }
    if (standardizedDomain) {
      existingDomainMap.set(standardizedDomain, company);
    }
  });
  
  logger.info('Starting duplicate detection', {
    csvRows: csvData.length,
    existingCompanies: existingCompanies.length,
    columnMapping
  });
  
  // Process each CSV row
  csvData.forEach((originalRow, index) => {
    const rowNumber = index + 1;
    const cleanedData = cleanRowData(originalRow, columnMapping);
    
    // Validate required fields
    const validationErrors = validateRequiredFields(cleanedData);
    
    if (validationErrors.length > 0) {
      results.push({
        row: rowNumber,
        status: 'invalid',
        originalData: originalRow,
        cleanedData,
        errors: validationErrors
      });
      return;
    }
    
    // Check for duplicates
    const standardizedName = standardizeCompanyName(cleanedData.name || '');
    const standardizedDomain = standardizeWebsiteUrl(cleanedData.websiteUrl || '');
    
    // Check against existing companies (exact name match)
    const existingByName = existingNameMap.get(standardizedName);
    if (existingByName) {
      results.push({
        row: rowNumber,
        status: 'duplicate',
        originalData: originalRow,
        cleanedData,
        errors: [`Company name "${cleanedData.name}" already exists in database`],
        duplicateInfo: {
          existingCompany: {
            id: existingByName.id,
            name: existingByName.name,
            websiteUrl: existingByName.websiteUrl,
            industryVertical: existingByName.industryVertical,
            businessSize: existingByName.businessSize,
            sourceVerified: existingByName.sourceVerified,
            active: existingByName.active,
            createdAt: existingByName.createdAt,
            source: 'database'
          },
          matchReason: 'exact_name'
        }
      });
      return;
    }
    
    // Check against existing companies (domain match)
    const existingByDomain = existingDomainMap.get(standardizedDomain);
    if (existingByDomain) {
      results.push({
        row: rowNumber,
        status: 'duplicate',
        originalData: originalRow,
        cleanedData,
        errors: [`Website domain "${standardizedDomain}" already exists in database`],
        duplicateInfo: {
          existingCompany: {
            id: existingByDomain.id,
            name: existingByDomain.name,
            websiteUrl: existingByDomain.websiteUrl,
            industryVertical: existingByDomain.industryVertical,
            businessSize: existingByDomain.businessSize,
            sourceVerified: existingByDomain.sourceVerified,
            active: existingByDomain.active,
            createdAt: existingByDomain.createdAt,
            source: 'database'
          },
          matchReason: 'domain_match'
        }
      });
      return;
    }
    
    // Check for internal CSV duplicates (name match)
    const internalNameDuplicateRow = internalCompanies.get(standardizedName);
    if (internalNameDuplicateRow !== undefined) {
      results.push({
        row: rowNumber,
        status: 'duplicate',
        originalData: originalRow,
        cleanedData,
        errors: [`Company name "${cleanedData.name}" appears multiple times in CSV (first seen in row ${internalNameDuplicateRow})`],
        duplicateInfo: {
          existingCompany: {
            id: `csv-row-${internalNameDuplicateRow}`,
            name: cleanedData.name,
            websiteUrl: cleanedData.websiteUrl,
            industryVertical: cleanedData.industryVertical,
            businessSize: cleanedData.businessSize,
            sourceVerified: cleanedData.sourceVerified === 'true',
            active: cleanedData.active === 'true',
            createdAt: new Date(),
            source: 'csv_internal'
          },
          matchReason: 'internal_duplicate'
        }
      });
      return;
    }
    
    // Check for internal CSV duplicates (domain match)
    const internalDomainDuplicateRow = internalDomains.get(standardizedDomain);
    if (internalDomainDuplicateRow !== undefined) {
      results.push({
        row: rowNumber,
        status: 'duplicate',
        originalData: originalRow,
        cleanedData,
        errors: [`Website domain "${standardizedDomain}" appears multiple times in CSV (first seen in row ${internalDomainDuplicateRow})`],
        duplicateInfo: {
          existingCompany: {
            id: `csv-row-${internalDomainDuplicateRow}`,
            name: cleanedData.name,
            websiteUrl: cleanedData.websiteUrl,
            industryVertical: cleanedData.industryVertical,
            businessSize: cleanedData.businessSize,
            sourceVerified: cleanedData.sourceVerified === 'true',
            active: cleanedData.active === 'true',
            createdAt: new Date(),
            source: 'csv_internal'
          },
          matchReason: 'internal_duplicate'
        }
      });
      return;
    }
    
    // No duplicates found - this row is valid
    internalCompanies.set(standardizedName, rowNumber);
    internalDomains.set(standardizedDomain, rowNumber);
    
    results.push({
      row: rowNumber,
      status: 'valid',
      originalData: originalRow,
      cleanedData,
      errors: []
    });
  });
  
  // Calculate summary statistics
  const validRows = results.filter(r => r.status === 'valid').length;
  const duplicateRows = results.filter(r => r.status === 'duplicate').length;
  const invalidRows = results.filter(r => r.status === 'invalid').length;
  
  logger.info('Duplicate detection completed', {
    totalRows: csvData.length,
    validRows,
    duplicateRows,
    invalidRows,
    duplicateBreakdown: {
      exactNameMatches: results.filter(r => r.duplicateInfo?.matchReason === 'exact_name').length,
      domainMatches: results.filter(r => r.duplicateInfo?.matchReason === 'domain_match').length,
      internalDuplicates: results.filter(r => r.duplicateInfo?.matchReason === 'internal_duplicate').length
    }
  });
  
  return {
    totalRows: csvData.length,
    validRows,
    duplicateRows,
    invalidRows,
    results
  };
}