/**
 * Fix CD_Avg portfolio averages calculation bug
 * This utility recalculates all CD_Avg values from the actual individual company data
 */

import logger from './logger';
import type { InsertMetric } from '@shared/schema';
import { neon } from '@neondatabase/serverless';

interface MetricData {
  metricName: string;
  timePeriod: string;
  values: number[];
  currentCdAvg: number;
  correctAverage: number;
}

const db = neon(process.env.DATABASE_URL!);

export class PortfolioAverageFix {
  
  /**
   * Fix all CD_Avg metrics by recalculating from individual company data
   */
  public static async fixAllCdAvgMetrics(): Promise<void> {
    logger.info('🔧 Starting CD_Avg portfolio averages fix');

    try {
      // Get all unique time periods that have CD_Portfolio data
      const periods = await this.getUniqueTimePeriods();
      logger.info('Found time periods with portfolio data', { periodsCount: periods.length });

      let totalFixed = 0;
      
      for (const period of periods) {
        const fixedInPeriod = await this.fixMetricsForPeriod(period);
        totalFixed += fixedInPeriod;
      }

      logger.info('✅ CD_Avg portfolio averages fix completed', { 
        periodsProcessed: periods.length,
        totalMetricsFixed: totalFixed 
      });

    } catch (error) {
      logger.error('❌ Failed to fix CD_Avg portfolio averages', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get all unique time periods that have CD_Portfolio data
   */
  private static async getUniqueTimePeriods(): Promise<string[]> {
    const query = `
      SELECT DISTINCT time_period 
      FROM metrics 
      WHERE source_type = 'CD_Portfolio'
        AND metric_name IN ('Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User')
      ORDER BY time_period DESC
    `;
    
    const result = await db(query);
    return (result as any[]).map((row: any) => row.time_period);
  }

  /**
   * Fix all metrics for a specific time period
   */
  private static async fixMetricsForPeriod(period: string): Promise<number> {
    logger.info(`🔧 Fixing metrics for period: ${period}`);
    
    const metricNames = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
    let fixedCount = 0;

    for (const metricName of metricNames) {
      const metricData = await this.getMetricData(metricName, period);
      
      if (metricData && metricData.values.length > 0) {
        const wasFixed = await this.updateCdAvgMetric(metricData);
        if (wasFixed) {
          fixedCount++;
          logger.info(`✅ Fixed ${metricName} for ${period}`, { 
            individualValues: metricData.values,
            oldCdAvg: metricData.currentCdAvg,
            newCdAvg: metricData.correctAverage
          });
        }
      }
    }

    return fixedCount;
  }

  /**
   * Get metric data for analysis and fixing
   */
  private static async getMetricData(metricName: string, period: string): Promise<MetricData | null> {
    // Get individual company values
    const portfolioQuery = `
      SELECT CAST(value::jsonb->>'value' AS NUMERIC) as metric_value
      FROM metrics 
      WHERE source_type = 'CD_Portfolio'
        AND metric_name = $1
        AND time_period = $2
      ORDER BY created_at DESC
    `;
    
    const portfolioResult = await db(portfolioQuery, [metricName, period]);
    const values = (portfolioResult as any[]).map((row: any) => row.metric_value);
    
    if (values.length === 0) {
      return null;
    }

    // Get current CD_Avg value
    const cdAvgQuery = `
      SELECT CAST(value::jsonb->>'value' AS NUMERIC) as cd_avg_value
      FROM metrics 
      WHERE source_type = 'CD_Avg'
        AND metric_name = $1
        AND time_period = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const cdAvgResult = await db(cdAvgQuery, [metricName, period]);
    const currentCdAvg = (cdAvgResult as any[]).length > 0 ? (cdAvgResult as any[])[0].cd_avg_value : 0;
    
    const correctAverage = values.reduce((sum, val) => sum + val, 0) / values.length;

    return {
      metricName,
      timePeriod: period,
      values,
      currentCdAvg,
      correctAverage
    };
  }

  /**
   * Update CD_Avg metric with correct average
   */
  private static async updateCdAvgMetric(metricData: MetricData): Promise<boolean> {
    // Only update if the current value is significantly different from correct average
    const tolerance = 0.001; // Small tolerance for floating point comparison
    const needsUpdate = Math.abs(metricData.currentCdAvg - metricData.correctAverage) > tolerance;
    
    if (!needsUpdate) {
      return false; // No update needed
    }

    // Delete existing CD_Avg entry for this metric and period
    const deleteQuery = `
      DELETE FROM metrics 
      WHERE source_type = 'CD_Avg'
        AND metric_name = $1
        AND time_period = $2
    `;
    
    await db(deleteQuery, [metricData.metricName, metricData.timePeriod]);

    // Insert corrected CD_Avg entry
    const insertQuery = `
      INSERT INTO metrics (client_id, competitor_id, metric_name, value, source_type, time_period, channel, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    
    await db(insertQuery, [
      null,
      null,
      metricData.metricName,
      JSON.stringify({ value: metricData.correctAverage, source: 'cd_portfolio_average' }),
      'CD_Avg',
      metricData.timePeriod,
      null
    ]);

    return true;
  }

  /**
   * Get a summary of current vs correct averages for debugging
   */
  public static async getAveragingReport(period: string = '2025-06'): Promise<void> {
    logger.info(`📊 CD_Avg Averaging Report for ${period}`);
    
    const metricNames = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
    
    for (const metricName of metricNames) {
      const metricData = await this.getMetricData(metricName, period);
      
      if (metricData) {
        logger.info(`${metricName}:`, {
          individualValues: metricData.values,
          currentCdAvg: metricData.currentCdAvg,
          correctAverage: metricData.correctAverage,
          needsFix: Math.abs(metricData.currentCdAvg - metricData.correctAverage) > 0.001
        });
      }
    }
  }
}