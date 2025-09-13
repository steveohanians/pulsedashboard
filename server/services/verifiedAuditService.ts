import logger from '../utils/logging/logger';
import type { IStorage } from '../storage';
import type { BenchmarkCompany } from '@shared/schema';

export interface VerifiedAuditResult {
  success: boolean;
  dryRun: boolean;
  summary: {
    totalVerifiedCompanies: number;
    companiesWithZeroMetrics: number;
    companiesUpdated: number;
    updatedCompanyIds: string[];
  };
  details: {
    verifiedCompanies: CompanyAuditDetail[];
    companiesNeedingUpdate: CompanyAuditDetail[];
  };
  error?: string;
  executionTime: number;
}

export interface CompanyAuditDetail {
  id: string;
  name: string;
  websiteUrl: string;
  industryVertical: string;
  businessSize: string;
  metricsCount: number;
  syncStatus: string;
  sourceVerified: boolean;
  hasRequiredMetrics: boolean;
  missingMetrics: string[];
  validatedTimePeriods: string[];
}

export interface VerifiedAuditOptions {
  dryRun?: boolean;
  targetSyncStatus?: 'failed' | 'pending' | 'completed';
}

/**
 * Comprehensive verified companies audit service
 * 
 * Audits all companies with sourceVerified=true and updates those 
 * with zero metrics to failed status. Supports dry-run mode for 
 * safe previewing before execution.
 */
export class VerifiedAuditService {
  constructor(private storage: IStorage) {}

  /**
   * Perform comprehensive audit of verified companies
   * 
   * @param options Audit configuration options
   * @returns Detailed audit results with summary and company details
   */
  async auditVerifiedCompanies(options: VerifiedAuditOptions = {}): Promise<VerifiedAuditResult> {
    const startTime = Date.now();
    const { dryRun = false, targetSyncStatus = 'failed' } = options;
    
    logger.info('Starting verified companies audit', { 
      dryRun, 
      targetSyncStatus,
      timestamp: new Date().toISOString() 
    });

    const result: VerifiedAuditResult = {
      success: false,
      dryRun,
      summary: {
        totalVerifiedCompanies: 0,
        companiesWithZeroMetrics: 0,
        companiesUpdated: 0,
        updatedCompanyIds: []
      },
      details: {
        verifiedCompanies: [],
        companiesNeedingUpdate: []
      },
      executionTime: 0
    };

    try {
      // Step 1: Get all verified benchmark companies
      const allVerifiedCompanies = await this.getVerifiedCompanies();
      
      if (allVerifiedCompanies.length === 0) {
        logger.info('No verified companies found for audit');
        result.success = true;
        result.executionTime = Date.now() - startTime;
        return result;
      }

      result.summary.totalVerifiedCompanies = allVerifiedCompanies.length;
      
      logger.info(`Found ${allVerifiedCompanies.length} verified companies for audit`);

      // Step 2: Bulk count metrics to avoid N+1 queries  
      const companyIds = allVerifiedCompanies.map(c => c.id);
      const metricsCountMap = await this.storage.getMetricsCountByCompanyIds(companyIds);

      // Step 3: Validate required metrics and time coverage for all companies
      const auditDetails: CompanyAuditDetail[] = [];
      
      for (const company of allVerifiedCompanies) {
        const metricsCount = metricsCountMap.get(company.id) || 0;
        
        // Validate required SEMrush metrics and time coverage
        const metricsValidation = await this.validateCompanyMetrics(company.id);
        
        auditDetails.push({
          id: company.id,
          name: company.name,
          websiteUrl: company.websiteUrl,
          industryVertical: company.industryVertical,
          businessSize: company.businessSize,
          metricsCount,
          syncStatus: company.syncStatus,
          sourceVerified: company.sourceVerified,
          hasRequiredMetrics: metricsValidation.hasRequiredMetrics,
          missingMetrics: metricsValidation.missingMetrics,
          validatedTimePeriods: metricsValidation.validatedTimePeriods
        });
      }

      result.details.verifiedCompanies = auditDetails;

      // Step 4: Identify companies needing update (missing required metrics or insufficient time coverage)
      const companiesNeedingUpdate = auditDetails.filter(detail => 
        !detail.hasRequiredMetrics || detail.validatedTimePeriods.length < 3
      );
      
      result.details.companiesNeedingUpdate = companiesNeedingUpdate;
      result.summary.companiesWithZeroMetrics = companiesNeedingUpdate.length;

      logger.info('Audit analysis completed', {
        totalVerified: allVerifiedCompanies.length,
        companiesWithZeroMetrics: companiesNeedingUpdate.length,
        companiesNeedingUpdate: companiesNeedingUpdate.map(c => ({ id: c.id, name: c.name }))
      });

      // Step 5: Update companies (if not dry run)
      if (!dryRun && companiesNeedingUpdate.length > 0) {
        const updateResult = await this.updateCompaniesToFailedStatus(
          companiesNeedingUpdate.map(c => c.id),
          targetSyncStatus
        );

        result.summary.companiesUpdated = updateResult.updatedCount;
        result.summary.updatedCompanyIds = updateResult.updatedIds;

        logger.info('Companies updated successfully', {
          targetSyncStatus,
          updatedCount: updateResult.updatedCount,
          updatedIds: updateResult.updatedIds
        });
      } else if (companiesNeedingUpdate.length > 0) {
        logger.info('Dry run mode - no companies were updated', {
          companiesNeedingUpdate: companiesNeedingUpdate.length
        });
      }

      result.success = true;
      result.executionTime = Date.now() - startTime;

      logger.info('Verified companies audit completed successfully', {
        dryRun,
        totalVerified: result.summary.totalVerifiedCompanies,
        companiesWithZeroMetrics: result.summary.companiesWithZeroMetrics,
        companiesUpdated: result.summary.companiesUpdated,
        executionTimeMs: result.executionTime
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      logger.error('Verified companies audit failed', {
        error: errorMessage,
        dryRun,
        targetSyncStatus,
        executionTimeMs: Date.now() - startTime
      });

      result.error = errorMessage;
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Get all companies that should be considered "verified" - either sourceVerified=true OR syncStatus='completed'
   * 
   * @returns Array of verified/completed benchmark companies
   */
  private async getVerifiedCompanies(): Promise<BenchmarkCompany[]> {
    logger.debug('Fetching all verified/completed benchmark companies');
    
    // Get all benchmark companies and filter for verified or completed ones
    const allCompanies = await this.storage.getBenchmarkCompanies();
    const verifiedCompanies = allCompanies.filter(company => 
      (company.sourceVerified === true || company.syncStatus === 'completed') && company.active === true
    );

    logger.debug('Verified/completed companies fetched', {
      totalCompanies: allCompanies.length,
      verifiedCompanies: verifiedCompanies.length,
      sourceVerifiedCount: allCompanies.filter(c => c.sourceVerified === true && c.active === true).length,
      completedSyncCount: allCompanies.filter(c => c.syncStatus === 'completed' && c.active === true).length
    });

    return verifiedCompanies;
  }

  /**
   * Comprehensive validation of company metrics
   * 
   * Validates that a company has:
   * - Required SEMrush metrics: Bounce Rate, Session Duration, Pages per Session
   * - Proper time period coverage (at least 3 months of recent data)
   * - Valid canonical envelope format with SEMrush source type
   * 
   * @param companyId Company ID to validate
   * @returns Detailed validation results
   */
  private async validateCompanyMetrics(companyId: string): Promise<{
    hasRequiredMetrics: boolean;
    missingMetrics: string[];
    validatedTimePeriods: string[];
  }> {
    const requiredMetrics = ['Bounce Rate', 'Session Duration', 'Pages per Session'];
    const missingMetrics: string[] = [];
    const validatedTimePeriods: string[] = [];

    try {
      // Get all metrics for this company (using benchmarkCompanyId for Industry_Avg source type)
      const allMetrics = await this.storage.getMetricsByCompanyId(companyId);
      
      if (allMetrics.length === 0) {
        return {
          hasRequiredMetrics: false,
          missingMetrics: requiredMetrics,
          validatedTimePeriods: []
        };
      }

      // Group metrics by name and time period for validation
      const metricsByName = new Map<string, Set<string>>();
      const validTimePeriods = new Set<string>();

      for (const metric of allMetrics) {
        // Validate canonical envelope format and SEMrush source type
        if (!this.isValidSEMrushMetric(metric)) {
          continue; // Skip invalid metrics
        }

        const metricName = metric.metricName;
        const timePeriod = metric.timePeriod;

        if (!metricsByName.has(metricName)) {
          metricsByName.set(metricName, new Set());
        }
        metricsByName.get(metricName)!.add(timePeriod);
        validTimePeriods.add(timePeriod);
      }

      // Check for required metrics
      for (const requiredMetric of requiredMetrics) {
        if (!metricsByName.has(requiredMetric) || metricsByName.get(requiredMetric)!.size === 0) {
          missingMetrics.push(requiredMetric);
        }
      }

      // Get validated time periods (periods with at least one required metric)
      const sortedTimePeriods = Array.from(validTimePeriods).sort().reverse(); // Most recent first
      
      // Only count periods where we have at least one required metric with proper coverage
      for (const period of sortedTimePeriods) {
        const hasRequiredMetricInPeriod = requiredMetrics.some(metric => 
          metricsByName.has(metric) && metricsByName.get(metric)!.has(period)
        );
        
        if (hasRequiredMetricInPeriod) {
          validatedTimePeriods.push(period);
        }
        
        // Limit to checking last 6 months for performance
        if (validatedTimePeriods.length >= 6) break;
      }

      const hasRequiredMetrics = missingMetrics.length === 0;

      logger.debug('Company metrics validation completed', {
        companyId,
        totalMetrics: allMetrics.length,
        hasRequiredMetrics,
        missingMetrics,
        validatedTimePeriodsCount: validatedTimePeriods.length,
        validatedTimePeriods: validatedTimePeriods.slice(0, 3) // Log first 3 periods
      });

      return {
        hasRequiredMetrics,
        missingMetrics,
        validatedTimePeriods
      };

    } catch (error) {
      logger.error('Error validating company metrics', {
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        hasRequiredMetrics: false,
        missingMetrics: requiredMetrics,
        validatedTimePeriods: []
      };
    }
  }

  /**
   * Validates that a metric is a proper SEMrush metric with canonical envelope format
   * 
   * @param metric The metric to validate
   * @returns True if the metric is valid SEMrush data
   */
  private isValidSEMrushMetric(metric: any): boolean {
    try {
      // Check if metric has canonical envelope
      if (!metric.canonicalEnvelope) {
        return false;
      }

      const envelope = typeof metric.canonicalEnvelope === 'string' 
        ? JSON.parse(metric.canonicalEnvelope)
        : metric.canonicalEnvelope;

      // Validate canonical envelope structure
      if (!envelope.meta || !envelope.series || !Array.isArray(envelope.series)) {
        return false;
      }

      // Check for SEMrush source type
      if (envelope.meta.sourceType !== 'SEMrush') {
        return false;
      }

      // Ensure we have actual data points
      if (envelope.series.length === 0) {
        return false;
      }

      // Validate at least one data point has a valid value
      const hasValidData = envelope.series.some((point: any) => 
        point.date && typeof point.value === 'number' && !isNaN(point.value)
      );

      return hasValidData;

    } catch (error) {
      logger.debug('Error validating SEMrush metric', {
        metricName: metric.metricName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Update multiple companies to failed status efficiently
   * 
   * @param companyIds Array of company IDs to update
   * @param targetSyncStatus Target sync status to set
   * @returns Update operation results
   */
  private async updateCompaniesToFailedStatus(
    companyIds: string[], 
    targetSyncStatus: string
  ): Promise<{ updatedCount: number; updatedIds: string[] }> {
    if (companyIds.length === 0) {
      return { updatedCount: 0, updatedIds: [] };
    }

    logger.info('Updating companies to failed status', {
      companyIds,
      targetSyncStatus,
      count: companyIds.length
    });

    try {
      // Use bulk update method to avoid N+1 update queries
      await this.storage.updateBenchmarkCompanies(companyIds, {
        syncStatus: targetSyncStatus as any,
        lastSyncAttempt: new Date()
      });

      logger.info('Bulk update completed successfully', {
        updatedCount: companyIds.length,
        targetSyncStatus
      });

      return {
        updatedCount: companyIds.length,
        updatedIds: companyIds
      };
    } catch (error) {
      logger.error('Failed to update companies to failed status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        companyIds,
        targetSyncStatus
      });
      throw error;
    }
  }

  /**
   * Validate audit options
   * 
   * @param options Options to validate
   * @returns Validation result with any errors
   */
  static validateOptions(options: VerifiedAuditOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (options.targetSyncStatus && !['failed', 'pending', 'completed'].includes(options.targetSyncStatus)) {
      errors.push('targetSyncStatus must be either "failed", "pending", or "completed"');
    }

    if (typeof options.dryRun !== 'undefined' && typeof options.dryRun !== 'boolean') {
      errors.push('dryRun must be a boolean value');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance - initialized lazily to avoid circular imports
let _verifiedAuditServiceInstance: VerifiedAuditService | null = null;

export async function getVerifiedAuditService(): Promise<VerifiedAuditService> {
  if (!_verifiedAuditServiceInstance) {
    const { storage } = await import('../storage');
    _verifiedAuditServiceInstance = new VerifiedAuditService(storage);
  }
  return _verifiedAuditServiceInstance;
}

// Export the singleton for convenience (will be a Promise)
export const verifiedAuditService = getVerifiedAuditService();