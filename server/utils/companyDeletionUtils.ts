

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


export async function deleteCompanyWithCleanup(
  options: CompanyDeletionOptions,
  storage: any // DatabaseStorage instance for calling methods
): Promise<void> {
  const { companyType, companyId, shouldRecalculatePortfolioAverages = false } = options;
  
  try {
    const companyInfo = await getCompanyInfo(companyType, companyId);
    logger.info(`Deleting ${companyType} company`, { 
      companyId, 
      companyName: companyInfo?.name || companyInfo?.domain || 'Unknown',
      companyType 
    });

    const deletionContext = await analyzeDeletionContext(companyType, companyId);
    logger.info(`${companyType} deletion context`, deletionContext);

    await deleteAssociatedMetrics(companyType, companyId, deletionContext, storage);

    if (shouldRecalculatePortfolioAverages && companyType === 'portfolio') {
      await storage.recalculatePortfolioAverages();
      logger.info('Portfolio averages recalculated after deletion');
    }

    await deleteCompanyRecord(companyType, companyId);
    logger.info(`${companyType} company record deleted`, { companyId });

    await clearRelevantCaches(companyType, options);

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


async function analyzeDeletionContext(companyType: CompanyType, companyId: string): Promise<any> {
  switch (companyType) {
    case 'portfolio':
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


async function deleteAssociatedMetrics(
  companyType: CompanyType, 
  companyId: string, 
  context: any,
  storage: any
): Promise<void> {
  switch (companyType) {
    case 'portfolio':
      if (context.isLastCompany) {
        await db.delete(metrics).where(
          or(
            eq(metrics.sourceType, 'CD_Portfolio'),
            eq(metrics.sourceType, 'CD_Avg')
          )
        );
        logger.info('All portfolio metrics deleted (last company)');
      } else {
        await db.delete(metrics).where(
          and(
            eq(metrics.sourceType, 'CD_Portfolio'),
            eq(metrics.cdPortfolioCompanyId, companyId)
          )
        );
        logger.info('Deleted specific company CD_Portfolio metrics', { companyId });
        
        await storage.deleteMetricsBySourceType('CD_Avg');
        logger.info('CD_Avg calculated metrics cleared for recalculation');
      }
      break;
      
    case 'competitor':
      await db.delete(metrics).where(eq(metrics.competitorId, companyId));
      logger.info(`Deleted ${context.associatedMetricsCount} competitor metrics`, { companyId });
      break;
      
    case 'benchmark':
      await db.delete(metrics).where(eq(metrics.benchmarkCompanyId, companyId));
      logger.info(`Deleted ${context.associatedMetricsCount} benchmark metrics`, { companyId });
      break;
  }
}


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

async function clearRelevantCaches(companyType: CompanyType, options: CompanyDeletionOptions): Promise<void> {
  logger.info(`Clearing caches for ${companyType} deletion`, { 
    companyId: options.companyId,
    specificCaches: options.shouldClearSpecificCaches 
  });
}


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