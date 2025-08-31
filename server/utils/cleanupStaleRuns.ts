/**
 * Utility to clean up stale pending effectiveness runs
 * This addresses the issue where pending runs get stuck and block new competitor scoring
 */

import { db } from '../db';
import { effectivenessRuns } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import logger from './logging/logger';
import { storage } from '../storage';

interface CleanupOptions {
  /** Hours after which a pending run is considered stale (default: 2) */
  staleAfterHours?: number;
  /** Whether to actually update the database or just report what would be cleaned */
  dryRun?: boolean;
  /** Specific client ID to clean up (if not provided, cleans all clients) */
  clientId?: string;
}

interface CleanupResult {
  totalStaleRuns: number;
  cleanedRuns: number;
  errors: Array<{ runId: string; error: string }>;
  stalePendingRuns: Array<{
    id: string;
    clientId: string;
    competitorId: string | null;
    createdAt: Date;
    ageHours: number;
    progress: string | null;
  }>;
}

/**
 * Clean up stale pending effectiveness runs
 */
export async function cleanupStaleEffectivenessRuns(options: CleanupOptions = {}): Promise<CleanupResult> {
  const {
    staleAfterHours = 2,
    dryRun = false,
    clientId
  } = options;

  logger.info('Starting cleanup of stale effectiveness runs', {
    staleAfterHours,
    dryRun,
    clientId: clientId || 'all'
  });

  const result: CleanupResult = {
    totalStaleRuns: 0,
    cleanedRuns: 0,
    errors: [],
    stalePendingRuns: []
  };

  try {
    // Build query conditions
    const whereConditions = [
      eq(effectivenessRuns.status, 'pending'),
      sql`created_at < NOW() - INTERVAL '${sql.raw(staleAfterHours.toString())} hours'`
    ];

    if (clientId) {
      whereConditions.push(eq(effectivenessRuns.clientId, clientId));
    }

    // Find all stale pending runs
    const staleRuns = await db
      .select()
      .from(effectivenessRuns)
      .where(and(...whereConditions))
      .orderBy(effectivenessRuns.createdAt);

    result.totalStaleRuns = staleRuns.length;

    if (staleRuns.length === 0) {
      logger.info('No stale pending runs found', { staleAfterHours, clientId });
      return result;
    }

    logger.info('Found stale pending runs', {
      count: staleRuns.length,
      staleAfterHours,
      clientId: clientId || 'all'
    });

    // Process each stale run
    for (const run of staleRuns) {
      const ageHours = Math.round((Date.now() - new Date(run.createdAt).getTime()) / (1000 * 60 * 60));
      
      const stalePendingRun = {
        id: run.id,
        clientId: run.clientId,
        competitorId: run.competitorId,
        createdAt: run.createdAt,
        ageHours,
        progress: run.progress
      };

      result.stalePendingRuns.push(stalePendingRun);

      logger.info('Processing stale pending run', {
        runId: run.id,
        clientId: run.clientId,
        competitorId: run.competitorId,
        ageHours,
        progress: run.progress,
        dryRun
      });

      if (!dryRun) {
        try {
          // Mark as failed with cleanup message
          await storage.updateEffectivenessRun(run.id, {
            status: 'failed',
            progress: `Run timed out after ${ageHours} hours - marked as failed by cleanup process at ${new Date().toISOString()}`
          });

          result.cleanedRuns++;
          
          logger.info('Marked stale run as failed', {
            runId: run.id,
            clientId: run.clientId,
            competitorId: run.competitorId,
            ageHours
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            runId: run.id,
            error: errorMessage
          });

          logger.error('Failed to clean up stale run', {
            runId: run.id,
            clientId: run.clientId,
            competitorId: run.competitorId,
            error: errorMessage
          });
        }
      }
    }

    const summary = {
      totalStaleRuns: result.totalStaleRuns,
      cleanedRuns: result.cleanedRuns,
      errors: result.errors.length,
      dryRun
    };

    if (dryRun) {
      logger.info('Dry run completed - no changes made', summary);
    } else {
      logger.info('Stale run cleanup completed', summary);
    }

    return result;

  } catch (error) {
    logger.error('Error during stale run cleanup', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Run cleanup for a specific client
 */
export async function cleanupStaleRunsForClient(clientId: string, options: Omit<CleanupOptions, 'clientId'> = {}): Promise<CleanupResult> {
  return cleanupStaleEffectivenessRuns({ ...options, clientId });
}

/**
 * Check for stale runs without cleaning them up
 */
export async function checkForStaleRuns(staleAfterHours = 2): Promise<CleanupResult> {
  return cleanupStaleEffectivenessRuns({ staleAfterHours, dryRun: true });
}