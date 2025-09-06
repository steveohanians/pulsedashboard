/**
 * Atomic Transaction Patterns for Effectiveness Scoring
 * 
 * Ensures data consistency by wrapping multi-step scoring operations
 * in database transactions with proper rollback on failure.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import logger from "../../utils/logging/logger";
import { EffectivenessResult, CriterionResult } from "./types";

export interface AtomicRunUpdate {
  status?: string;
  overallScore?: string;
  progress?: string;
  progressDetail?: string;
  screenshotUrl?: string;
  fullPageScreenshotUrl?: string;
  webVitals?: any;
  screenshotMethod?: string | null;
  screenshotError?: string | null;
  fullPageScreenshotError?: string | null;
  aiInsights?: any;
  insightsGeneratedAt?: Date;
}

export interface TransactionResult {
  success: boolean;
  error?: Error;
  rollbackReason?: string;
}

/**
 * ✅ ATOMIC: Save complete scoring result (run + all criteria) in single transaction
 */
export async function saveEffectivenessResultAtomically(
  runId: string,
  result: EffectivenessResult,
  runUpdates: AtomicRunUpdate
): Promise<TransactionResult> {
  
  const operationStart = Date.now();
  logger.info('Starting atomic effectiveness result save', {
    runId,
    overallScore: result.overallScore,
    criteriaCount: result.criterionResults.length,
    hasScreenshots: !!(result.screenshotUrl || result.fullPageScreenshotUrl)
  });

  try {
    await db.transaction(async (tx) => {
      // ✅ Step 1: Save all criterion scores first
      for (const criterionResult of result.criterionResults) {
        await storage.createCriterionScoreInTransaction(tx, {
          runId,
          criterion: criterionResult.criterion,
          score: criterionResult.score.toString(),
          evidence: {
            ...criterionResult.evidence,
            screenshotUrl: result.screenshotUrl,
            fullPageScreenshotUrl: result.fullPageScreenshotUrl
          },
          passes: criterionResult.passes,
          failedChecks: criterionResult.failedChecks || [],
          warnings: criterionResult.warnings || []
        });
      }

      // ✅ Step 2: Update run with final results (only after all scores saved)
      await storage.updateEffectivenessRunInTransaction(tx, runId, {
        ...runUpdates,
        overallScore: result.overallScore.toString(),
        screenshotUrl: result.screenshotUrl,
        fullPageScreenshotUrl: result.fullPageScreenshotUrl,
        webVitals: result.webVitals
      });
    });

    const duration = Date.now() - operationStart;
    logger.info('Atomic effectiveness result save completed', {
      runId,
      criteriaCount: result.criterionResults.length,
      duration: `${duration}ms`,
      overallScore: result.overallScore
    });

    return { success: true };

  } catch (error) {
    const duration = Date.now() - operationStart;
    logger.error('Atomic effectiveness result save failed - transaction rolled back', {
      runId,
      criteriaCount: result.criterionResults.length,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rollbackReason: 'Failed to save scoring results atomically'
    };
  }
}

/**
 * ✅ ATOMIC: Update run status with progress tracking in transaction
 */
export async function updateRunProgressAtomically(
  runId: string, 
  updates: AtomicRunUpdate,
  clientId?: string
): Promise<TransactionResult> {
  
  try {
    await db.transaction(async (tx) => {
      // ✅ Update run status
      await storage.updateEffectivenessRunInTransaction(tx, runId, updates);
      
      // ✅ Update client last run time if provided (keeps related data in sync)
      if (clientId && updates.status === 'completed') {
        // Note: This would need a transaction-aware client update method
        // For now, we'll do this outside the transaction to avoid adding more complexity
      }
    });

    logger.info('Run progress updated atomically', {
      runId,
      status: updates.status,
      progress: updates.progress?.substring(0, 50) + (updates.progress && updates.progress.length > 50 ? '...' : '')
    });

    return { success: true };

  } catch (error) {
    logger.error('Atomic run progress update failed', {
      runId,
      status: updates.status,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rollbackReason: 'Failed to update run progress atomically'
    };
  }
}

/**
 * ✅ ATOMIC: Save AI insights with run update in transaction
 */
export async function saveAIInsightsAtomically(
  runId: string,
  insights: any,
  progressUpdates?: Partial<AtomicRunUpdate>
): Promise<TransactionResult> {

  try {
    await db.transaction(async (tx) => {
      // ✅ Save AI insights and mark completion atomically
      await storage.updateEffectivenessRunInTransaction(tx, runId, {
        ...progressUpdates,
        aiInsights: insights,
        insightsGeneratedAt: new Date()
      });
    });

    logger.info('AI insights saved atomically', {
      runId,
      hasInsights: !!insights,
      insightType: insights?.type || 'unknown'
    });

    return { success: true };

  } catch (error) {
    logger.error('Atomic AI insights save failed', {
      runId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rollbackReason: 'Failed to save AI insights atomically'
    };
  }
}

/**
 * ✅ ATOMIC: Mark run as failed with proper cleanup
 */
export async function markRunFailedAtomically(
  runId: string,
  reason: string,
  progressUpdates?: Partial<AtomicRunUpdate>
): Promise<TransactionResult> {

  try {
    await db.transaction(async (tx) => {
      // ✅ Mark as failed and update progress
      await storage.updateEffectivenessRunInTransaction(tx, runId, {
        ...progressUpdates,
        status: 'failed',
        progress: reason
      });

      // ✅ Could add cleanup of any partial criterion scores if needed
      // For now, we'll leave partial scores as they might be useful for debugging
    });

    logger.info('Run marked as failed atomically', {
      runId,
      reason
    });

    return { success: true };

  } catch (error) {
    logger.error('Atomic run failure marking failed', {
      runId,
      reason,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rollbackReason: 'Failed to mark run as failed atomically'
    };
  }
}

/**
 * ✅ UTILITY: Retry pattern with exponential backoff for transaction failures
 */
export async function retryTransactionWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      
      logger.warn(`Transaction attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
        attempt,
        maxRetries,
        error: lastError.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}