/**
 * Global utilities for company deletion across portfolio companies, competitors, and benchmarks
 * Consolidates proven deletion logic for consistency and maintainability
 */

import { db } from "../db";
import { eq, and, or, ne } from "drizzle-orm";
import { 
  metrics, 
  cdPortfolioCompanies, 
  competitors, 
  benchmarkCompanies 
} from "@shared/schema";
import logger from "./logger";

export type CompanyType = 'portfolio' | 'competitor' | 'benchmark';

export interface CompanyDeletionOptions {
  companyType: CompanyType;
  companyId: string;
  shouldRecalculatePortfolioAverages?: boolean;
  shouldClearSpecificCaches?: string[];
  additionalCleanup?: () => Promise<void>;
}

/**
 * Enhanced company deletion with comprehensive cleanup
 * Based on proven portfolio company deletion logic
 */
export async function deleteCompanyWithCleanup(
  options: CompanyDeletionOptions,
  storage: any // DatabaseStorage instance for calling methods
): Promise<void> {
  const { companyType, companyId, shouldRecalculatePortfolioAverages = false } = options;
  
  try {
    // Step 1: Get company info for logging before deletion
    const companyInfo = await getCompanyInfo(companyType, companyId);
    logger.info(`Deleting ${companyType} company`, { 
      companyId, 
      companyName: companyInfo?.name || companyInfo?.domain || 'Unknown',
      companyType 
    });

    // Step 2: Context analysis for sophisticated deletion logic
    const deletionContext = await analyzeDeletionContext(companyType, companyId);
    logger.info(`${companyType} deletion context`, deletionContext);

    // Step 3: Delete associated metrics using appropriate strategy
    await deleteAssociatedMetrics(companyType, companyId, deletionContext, storage);

    // Step 4: Handle recalculations if needed (mainly for portfolio)
    if (shouldRecalculatePortfolioAverages && companyType === 'portfolio') {
      await storage.recalculatePortfolioAverages();
      logger.info('Portfolio averages recalculated after deletion');
    }

    // Step 5: Delete the company record itself
    await deleteCompanyRecord(companyType, companyId);
    logger.info(`${companyType} company record deleted`, { companyId });

    // Step 6: Clear relevant caches
    await clearRelevantCaches(companyType, options);

    // Step 7: Additional cleanup if provided
    if (options.additionalCleanup) {
      await options.additionalCleanup();
    }

    logger.info(`Complete ${companyType} company deletion finished`, { 
      companyId, 
      companyName: companyInfo?.name || companyInfo?.domain || 'Unknown'
    });
      
  } catch (error) {
    logger.error(`Failed to complete ${companyType} company deletion`, {
      companyId,
      companyType,
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

/**
 * Get company information before deletion
 */
async function getCompanyInfo(companyType: CompanyType, companyId: string): Promise<any> {
  switch (companyType) {
    case 'portfolio':
      const portfolioCompany = await db
        .select()
        .from(cdPortfolioCompanies)
        .where(eq(cdPortfolioCompanies.id, companyId))
        .limit(1);
      return portfolioCompany[0];
      
    case 'competitor':
      const competitor = await db
        .select()
        .from(competitors)
        .where(eq(competitors.id, companyId))
        .limit(1);
      return competitor[0];
      
    case 'benchmark':
      const benchmarkCompany = await db
        .select()
        .from(benchmarkCompanies)
        .where(eq(benchmarkCompanies.id, companyId))
        .limit(1);
      return benchmarkCompany[0];
      
    default:
      throw new Error(`Unknown company type: ${companyType}`);
  }
}

/**
 * Analyze deletion context for intelligent cleanup decisions
 */
async function analyzeDeletionContext(companyType: CompanyType, companyId: string): Promise<any> {
  switch (companyType) {
    case 'portfolio':
      // Check if this is the last portfolio company
      const remainingPortfolioCompanies = await db
        .select()
        .from(cdPortfolioCompanies)
        .where(ne(cdPortfolioCompanies.id, companyId));
      return {
        companyId,
        isLastCompany: remainingPortfolioCompanies.length === 0,
        remainingCompaniesCount: remainingPortfolioCompanies.length,
        companyType: 'portfolio'
      };
      
    case 'competitor':
      // For competitors, check metrics count for this company
      const competitorMetrics = await db
        .select()
        .from(metrics)
        .where(eq(metrics.competitorId, companyId));
      return {
        companyId,
        associatedMetricsCount: competitorMetrics.length,
        companyType: 'competitor'
      };
      
    case 'benchmark':
      // For benchmarks, check metrics count for this company
      const benchmarkMetrics = await db
        .select()
        .from(metrics)
        .where(eq(metrics.benchmarkCompanyId, companyId));
      return {
        companyId,
        associatedMetricsCount: benchmarkMetrics.length,
        companyType: 'benchmark'
      };
      
    default:
      return { companyId, companyType };
  }
}

/**
 * Delete associated metrics using appropriate strategy for each company type
 */
async function deleteAssociatedMetrics(
  companyType: CompanyType, 
  companyId: string, 
  context: any,
  storage: any
): Promise<void> {
  switch (companyType) {
    case 'portfolio':
      // Use sophisticated portfolio deletion logic
      if (context.isLastCompany) {
        // Delete ALL portfolio-related metrics when no companies remain
        await db.delete(metrics).where(
          or(
            eq(metrics.sourceType, 'CD_Portfolio'),
            eq(metrics.sourceType, 'CD_Avg')
          )
        );
        logger.info('All portfolio metrics deleted (last company)');
      } else {
        // Delete the specific company's CD_Portfolio metrics
        await db.delete(metrics).where(
          and(
            eq(metrics.sourceType, 'CD_Portfolio'),
            eq(metrics.cdPortfolioCompanyId, companyId)
          )
        );
        logger.info('Deleted specific company CD_Portfolio metrics', { companyId });
        
        // Clear calculated averages for recalculation
        await storage.deleteMetricsBySourceType('CD_Avg');
        logger.info('CD_Avg calculated metrics cleared for recalculation');
      }
      break;
      
    case 'competitor':
      // Delete all competitor metrics
      await db.delete(metrics).where(eq(metrics.competitorId, companyId));
      logger.info(`Deleted ${context.associatedMetricsCount} competitor metrics`, { companyId });
      break;
      
    case 'benchmark':
      // Delete all benchmark metrics
      await db.delete(metrics).where(eq(metrics.benchmarkCompanyId, companyId));
      logger.info(`Deleted ${context.associatedMetricsCount} benchmark metrics`, { companyId });
      break;
  }
}

/**
 * Delete the actual company record
 */
async function deleteCompanyRecord(companyType: CompanyType, companyId: string): Promise<void> {
  switch (companyType) {
    case 'portfolio':
      await db.delete(cdPortfolioCompanies).where(eq(cdPortfolioCompanies.id, companyId));
      break;
    case 'competitor':
      await db.delete(competitors).where(eq(competitors.id, companyId));
      break;
    case 'benchmark':
      await db.delete(benchmarkCompanies).where(eq(benchmarkCompanies.id, companyId));
      break;
  }
}

/**
 * Clear relevant caches based on company type
 */
async function clearRelevantCaches(companyType: CompanyType, options: CompanyDeletionOptions): Promise<void> {
  // This would integrate with existing cache clearing systems
  // For now, just log what should be cleared
  logger.info(`Clearing caches for ${companyType} deletion`, { 
    companyId: options.companyId,
    specificCaches: options.shouldClearSpecificCaches 
  });
}

/**
 * Enhanced competitor deletion using the global utility
 */
export async function deleteCompetitorEnhanced(
  competitorId: string, 
  storage: any
): Promise<void> {
  await deleteCompanyWithCleanup({
    companyType: 'competitor',
    companyId: competitorId,
    shouldRecalculatePortfolioAverages: false,
    shouldClearSpecificCaches: ['dashboard', 'metrics']
  }, storage);
}

/**
 * Enhanced benchmark deletion using the global utility
 */
export async function deleteBenchmarkCompanyEnhanced(
  benchmarkId: string, 
  storage: any
): Promise<void> {
  await deleteCompanyWithCleanup({
    companyType: 'benchmark',
    companyId: benchmarkId,
    shouldRecalculatePortfolioAverages: false,
    shouldClearSpecificCaches: ['dashboard', 'benchmarks']
  }, storage);
}

/**
 * Enhanced portfolio deletion using the global utility
 */
export async function deletePortfolioCompanyEnhanced(
  portfolioId: string, 
  storage: any
): Promise<void> {
  await deleteCompanyWithCleanup({
    companyType: 'portfolio',
    companyId: portfolioId,
    shouldRecalculatePortfolioAverages: true,
    shouldClearSpecificCaches: ['dashboard', 'portfolio', 'cd-avg'],
    additionalCleanup: async () => {
      await storage.clearPortfolioCaches();
      logger.info('Additional portfolio cache clearing completed');
    }
  }, storage);
}