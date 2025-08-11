#!/usr/bin/env tsx

/**
 * Canonical Metric Envelope Migration Script
 * 
 * Migrates existing metrics from legacy format to canonical envelope format.
 * Gates with FEATURE_CANONICAL_ENVELOPE=true environment variable.
 */

import { db } from "../server/db";
import { metrics } from "../shared/schema";
import { eq, sql, isNull } from "drizzle-orm";
import { transformToCanonical, isValidCanonicalEnvelope } from "../server/utils/metricTransformers";
import logger from "../server/utils/logging/logger";

interface MigrationStats {
  totalMetrics: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

async function migrateMetricsToCanonical(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalMetrics: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    logger.info('Starting canonical metric envelope migration...');

    // Check if feature is enabled
    if (process.env.FEATURE_CANONICAL_ENVELOPE !== 'true') {
      logger.warn('FEATURE_CANONICAL_ENVELOPE is not enabled. Exiting migration.');
      return stats;
    }

    // Get all metrics that don't have canonical envelope
    const legacyMetrics = await db.select()
      .from(metrics)
      .where(isNull(metrics.canonicalEnvelope));

    stats.totalMetrics = legacyMetrics.length;
    logger.info(`Found ${stats.totalMetrics} metrics to migrate`);

    if (stats.totalMetrics === 0) {
      logger.info('No metrics require migration');
      return stats;
    }

    // Process metrics in batches to avoid memory issues
    const batchSize = 100;
    const batches = Math.ceil(legacyMetrics.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, legacyMetrics.length);
      const batch = legacyMetrics.slice(start, end);

      logger.info(`Processing batch ${i + 1}/${batches} (${batch.length} metrics)`);

      for (const metric of batch) {
        try {
          // Skip if already has canonical envelope
          if (metric.canonicalEnvelope) {
            stats.skipped++;
            continue;
          }

          // Extract dimensions from existing data
          const dimensions: { deviceCategory?: string; channel?: string } = {};
          if (metric.channel) {
            if (['Desktop', 'Mobile', 'Tablet'].includes(metric.channel)) {
              dimensions.deviceCategory = metric.channel;
            } else {
              dimensions.channel = metric.channel;
            }
          }

          // Transform to canonical envelope
          const canonicalEnvelope = transformToCanonical(
            metric.metricName,
            metric.value,
            metric.timePeriod,
            metric.sourceType,
            Object.keys(dimensions).length > 0 ? dimensions : undefined
          );

          // Validate the envelope
          if (!isValidCanonicalEnvelope(canonicalEnvelope)) {
            throw new Error('Generated canonical envelope failed validation');
          }

          // Update the metric with canonical envelope
          await db.update(metrics)
            .set({ canonicalEnvelope })
            .where(eq(metrics.id, metric.id));

          stats.migrated++;

          if (stats.migrated % 50 === 0) {
            logger.info(`Migrated ${stats.migrated}/${stats.totalMetrics} metrics...`);
          }

        } catch (error) {
          stats.failed++;
          const errorMsg = `Failed to migrate metric ${metric.id} (${metric.metricName}): ${(error as Error).message}`;
          stats.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Small delay between batches to reduce database load
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Migration completed', {
      total: stats.totalMetrics,
      migrated: stats.migrated,
      skipped: stats.skipped,
      failed: stats.failed
    });

    if (stats.errors.length > 0) {
      logger.error('Migration errors:', stats.errors.slice(0, 10)); // Log first 10 errors
    }

    return stats;

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Validate migration results
 */
async function validateMigration(): Promise<void> {
  logger.info('Validating migration results...');

  // Count metrics with and without canonical envelopes
  const [withEnvelope] = await db.select({ count: sql<number>`count(*)` })
    .from(metrics)
    .where(sql`${metrics.canonicalEnvelope} IS NOT NULL`);

  const [withoutEnvelope] = await db.select({ count: sql<number>`count(*)` })
    .from(metrics)
    .where(isNull(metrics.canonicalEnvelope));

  logger.info('Migration validation results:', {
    withCanonicalEnvelope: withEnvelope.count,
    withoutCanonicalEnvelope: withoutEnvelope.count
  });

  // Sample validation: check first 10 migrated metrics
  const sampleMetrics = await db.select()
    .from(metrics)
    .where(sql`${metrics.canonicalEnvelope} IS NOT NULL`)
    .limit(10);

  let validationPassed = 0;
  let validationFailed = 0;

  for (const metric of sampleMetrics) {
    try {
      if (isValidCanonicalEnvelope(metric.canonicalEnvelope)) {
        validationPassed++;
      } else {
        validationFailed++;
        logger.warn(`Invalid canonical envelope for metric ${metric.id}`);
      }
    } catch (error) {
      validationFailed++;
      logger.warn(`Validation error for metric ${metric.id}:`, error);
    }
  }

  logger.info('Sample validation results:', {
    passed: validationPassed,
    failed: validationFailed
  });
}

/**
 * Dry run mode - just logs what would be migrated
 */
async function dryRun(): Promise<void> {
  logger.info('Running migration in dry-run mode...');

  const legacyMetrics = await db.select({
    id: metrics.id,
    metricName: metrics.metricName,
    sourceType: metrics.sourceType,
    timePeriod: metrics.timePeriod,
    hasValue: sql<boolean>`${metrics.value} IS NOT NULL`,
    hasCanonicalEnvelope: sql<boolean>`${metrics.canonicalEnvelope} IS NOT NULL`
  })
  .from(metrics)
  .where(isNull(metrics.canonicalEnvelope))
  .limit(10);

  logger.info(`DRY RUN: Would migrate ${legacyMetrics.length} metrics (showing first 10):`);
  
  for (const metric of legacyMetrics) {
    logger.info(`  - ${metric.metricName} (${metric.sourceType}, ${metric.timePeriod}) - HasValue: ${metric.hasValue}`);
  }

  const [totalCount] = await db.select({ count: sql<number>`count(*)` })
    .from(metrics)
    .where(isNull(metrics.canonicalEnvelope));

  logger.info(`DRY RUN: Total metrics requiring migration: ${totalCount.count}`);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const skipValidation = args.includes('--skip-validation');

  try {
    if (isDryRun) {
      await dryRun();
      return;
    }

    const stats = await migrateMetricsToCanonical();
    
    if (!skipValidation && stats.migrated > 0) {
      await validateMigration();
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total metrics processed: ${stats.totalMetrics}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already migrated): ${stats.skipped}`);
    console.log(`Failed: ${stats.failed}`);
    
    if (stats.failed > 0) {
      console.log('\nFirst 5 errors:');
      stats.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    process.exit(stats.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration (ES module compatible)
main().catch(console.error);

export { migrateMetricsToCanonical, validateMigration };