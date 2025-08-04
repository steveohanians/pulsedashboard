#!/usr/bin/env tsx

/**
 * Script to generate benchmark and portfolio data for demo-client-id
 * Following business logic: Generate industry and portfolio averages for 15 months
 */

import { PostgresStorage } from '../server/storage';
import logger from '../server/utils/logger';

const METRIC_NAMES = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];

// Industry averages based on established patterns
const INDUSTRY_AVERAGES = {
  'Bounce Rate': 65.0,
  'Session Duration': 180.0,
  'Pages per Session': 2.5,
  'Sessions per User': 1.8
};

// CD Portfolio averages (slightly better than industry)
const CD_PORTFOLIO_AVERAGES = {
  'Bounce Rate': 45.0,
  'Session Duration': 220.0,
  'Pages per Session': 3.2,
  'Sessions per User': 2.1
};

function generatePeriodList(months: number): string[] {
  const periods: string[] = [];
  const today = new Date(2025, 6, 31); // July 31, 2025 (month is 0-indexed)
  
  for (let i = 0; i < months; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    periods.push(period);
  }
  
  return periods.reverse(); // Oldest first
}

async function generateBenchmarkData() {
  try {
    logger.info('Starting benchmark and portfolio data generation');
    
    const storage = new PostgresStorage();
    const periods = generatePeriodList(15);
    
    let metricsCreated = 0;
    
    for (const period of periods) {
      logger.info(`Generating benchmark data for period: ${period}`);
      
      // Generate Industry benchmarks
      for (const metricName of METRIC_NAMES) {
        const baseValue = INDUSTRY_AVERAGES[metricName as keyof typeof INDUSTRY_AVERAGES];
        // Add slight monthly variation (±5%)
        const variation = (Math.random() - 0.5) * 0.1;
        const value = baseValue * (1 + variation);
        
        await storage.createMetric({
          clientId: 'demo-client-id',
          timePeriod: period,
          metricName,
          sourceType: 'Industry' as const,
          value: Math.round(value * 100) / 100
        });
        metricsCreated++;
      }
      
      // Generate CD Portfolio benchmarks
      for (const metricName of METRIC_NAMES) {
        const baseValue = CD_PORTFOLIO_AVERAGES[metricName as keyof typeof CD_PORTFOLIO_AVERAGES];
        // Add slight monthly variation (±5%)
        const variation = (Math.random() - 0.5) * 0.1;
        const value = baseValue * (1 + variation);
        
        await storage.createMetric({
          clientId: 'demo-client-id',
          timePeriod: period,
          metricName,
          sourceType: 'CD_Portfolio' as const,
          value: Math.round(value * 100) / 100
        });
        metricsCreated++;
      }
    }
    
    logger.info('Benchmark data generation completed successfully', {
      periodsGenerated: periods.length,
      metricsCreated
    });
    
    console.log('✅ Benchmark data generation completed successfully');
    console.log(`📊 Periods generated: ${periods.length}`);
    console.log(`📈 Metrics created: ${metricsCreated}`);
    
  } catch (error) {
    logger.error('Error in benchmark data generation script', { error: (error as Error).message });
    console.error('❌ Script error:', (error as Error).message);
  }
  
  process.exit(0);
}

generateBenchmarkData();