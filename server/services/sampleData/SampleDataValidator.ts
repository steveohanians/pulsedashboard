/**
 * Sample Data Validator
 * 
 * Ensures sample data generation is safe and never overwrites authentic GA4 data.
 */

import { storage } from '../../storage';
import { GA4AuthenticationService } from '../ga4';
import logger from '../../utils/logger';
import type { ClientSafetyCheck } from './types';

export class SampleDataValidator {
  private ga4Auth: GA4AuthenticationService;

  constructor() {
    this.ga4Auth = new GA4AuthenticationService();
  }

  /**
   * Comprehensive safety check before generating sample data
   */
  async validateClientSafety(clientId: string, skipGA4Check: boolean = false): Promise<ClientSafetyCheck> {
    try {
      // Check if client has GA4 property configured
      const hasGA4PropertyConfigured = await this.checkGA4PropertyConfiguration(clientId);
      
      // Check if client has valid GA4 access (unless skipped)
      let hasGA4Access = false;
      if (!skipGA4Check && hasGA4PropertyConfigured) {
        hasGA4Access = await this.ga4Auth.validateClientAccess(clientId);
      }

      // Check for existing GA4 data
      const hasExistingGA4Data = await this.checkExistingGA4Data(clientId);

      // Determine if it's safe to generate sample data
      const isSafeForSampleData = this.determineSafety(
        hasGA4Access,
        hasExistingGA4Data,
        hasGA4PropertyConfigured,
        skipGA4Check
      );

      const reason = this.getSafetyReason(
        hasGA4Access,
        hasExistingGA4Data,
        hasGA4PropertyConfigured,
        skipGA4Check
      );

      const safetyCheck: ClientSafetyCheck = {
        hasGA4Access,
        hasExistingGA4Data,
        hasGA4PropertyConfigured,
        isSafeForSampleData,
        reason
      };

      logger.info(`Safety check for client ${clientId}:`, safetyCheck);
      return safetyCheck;

    } catch (error) {
      logger.error(`Error during safety check for client ${clientId}:`, error);
      return {
        hasGA4Access: false,
        hasExistingGA4Data: false,
        hasGA4PropertyConfigured: false,
        isSafeForSampleData: false,
        reason: `Safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if client has GA4 property configured
   */
  private async checkGA4PropertyConfiguration(clientId: string): Promise<boolean> {
    try {
      const propertyAccess = await storage.getGA4PropertyAccessByClient(clientId);
      return !!propertyAccess && !!propertyAccess.propertyId;
    } catch (error) {
      logger.debug(`No GA4 property configuration found for client ${clientId}`);
      return false;
    }
  }

  /**
   * Check for existing GA4 data in the database
   */
  private async checkExistingGA4Data(clientId: string): Promise<boolean> {
    try {
      // Check for any existing metrics from GA4 sources
      const existingMetrics = await storage.getClientMetrics(clientId);
      
      // Look for recent data that might be from GA4
      const recentMetrics = existingMetrics.filter(metric => {
        const metricDate = new Date(metric.timePeriod);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return metricDate > threeMonthsAgo;
      });

      return recentMetrics.length > 0;
    } catch (error) {
      logger.debug(`Error checking existing GA4 data for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Determine if it's safe to generate sample data
   */
  private determineSafety(
    hasGA4Access: boolean,
    hasExistingGA4Data: boolean,
    hasGA4PropertyConfigured: boolean,
    skipGA4Check: boolean
  ): boolean {
    // Never generate if there's existing GA4 data
    if (hasExistingGA4Data) {
      return false;
    }

    // Never generate if client has valid GA4 access (unless explicitly skipped)
    if (hasGA4Access && !skipGA4Check) {
      return false;
    }

    // Safe to generate if no GA4 configuration exists
    if (!hasGA4PropertyConfigured) {
      return true;
    }

    // Safe to generate if GA4 is configured but not accessible (broken setup)
    // and no existing data found
    return true;
  }

  /**
   * Get human-readable reason for safety determination
   */
  private getSafetyReason(
    hasGA4Access: boolean,
    hasExistingGA4Data: boolean,
    hasGA4PropertyConfigured: boolean,
    skipGA4Check: boolean
  ): string {
    if (hasExistingGA4Data) {
      return 'Client has existing GA4 data - sample generation blocked to preserve authentic data';
    }

    if (hasGA4Access && !skipGA4Check) {
      return 'Client has valid GA4 access - sample generation blocked to prevent data conflicts';
    }

    if (!hasGA4PropertyConfigured) {
      return 'No GA4 configuration found - safe to generate sample data';
    }

    if (skipGA4Check) {
      return 'GA4 check skipped by request - generating sample data (use with caution)';
    }

    return 'GA4 configured but not accessible - safe to generate sample data';
  }

  /**
   * Validate that generated data won't conflict with existing data
   */
  async validateGeneratedData(clientId: string, periods: string[]): Promise<boolean> {
    try {
      for (const period of periods) {
        const existingMetrics = await storage.getClientMetricsByPeriod(clientId, period);
        if (existingMetrics.length > 0) {
          logger.warn(`Found existing metrics for client ${clientId}, period ${period} - skipping generation`);
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(`Error validating generated data for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Check if client exists in the database
   */
  async validateClientExists(clientId: string): Promise<boolean> {
    try {
      const client = await storage.getClientById(clientId);
      return !!client;
    } catch (error) {
      logger.error(`Error validating client existence for ${clientId}:`, error);
      return false;
    }
  }
}