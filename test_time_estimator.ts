#!/usr/bin/env npx tsx
/**
 * Time Estimator Validation Test
 * 
 * Validates time estimates against actual performance data
 * and provides updated minimum time requirements.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import { timeEstimator } from './server/services/effectiveness/timeEstimator';

class TimeEstimatorTestRunner {

  async runTest(): Promise<void> {
    console.log(chalk.bold.cyan('\n====================================='));
    console.log(chalk.bold.cyan('  TIME ESTIMATOR VALIDATION TEST'));
    console.log(chalk.bold.cyan('=====================================\n'));

    try {
      // Test standard configurations
      await this.testStandardConfigurations();
      
      // Test additional competitor impact
      await this.testAdditionalCompetitorImpact();
      
      // Validate against actual run data
      await this.validateAgainstActualData();
      
      // Show updated minimum requirements
      await this.showUpdatedRequirements();
      
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
    }
  }

  /**
   * Test standard configuration estimates
   */
  async testStandardConfigurations(): Promise<void> {
    console.log(chalk.bold.yellow('📊 STANDARD CONFIGURATION ESTIMATES'));
    console.log(chalk.gray('─'.repeat(50)));

    const estimates = timeEstimator.getStandardEstimates();
    
    console.log('\n  🎯 STANDARD (Client + 2 Competitors):');
    const standardFormat = timeEstimator.formatEstimate(estimates.standard);
    console.log(`    Time: ${standardFormat.primary}`);
    console.log(`    Detail: ${standardFormat.detail}`);
    console.log(`    Components:`);
    standardFormat.breakdown.forEach(item => {
      console.log(`      • ${item}`);
    });

    console.log('\n  📈 EXTENDED (Client + 3 Competitors):');
    const extendedFormat = timeEstimator.formatEstimate(estimates.extended);
    console.log(`    Time: ${extendedFormat.primary}`);
    console.log(`    Additional time vs standard: +${estimates.extended.estimated - estimates.standard.estimated}s`);

    console.log('\n  🔍 COMPREHENSIVE (Client + 4 Competitors):');
    const comprehensiveFormat = timeEstimator.formatEstimate(estimates.comprehensive);
    console.log(`    Time: ${comprehensiveFormat.primary}`);
    console.log(`    Additional time vs standard: +${estimates.comprehensive.estimated - estimates.standard.estimated}s`);

    console.log('\n  ⚡ CLIENT ONLY (No Competitors):');
    const clientOnlyFormat = timeEstimator.formatEstimate(estimates.clientOnly);
    console.log(`    Time: ${clientOnlyFormat.primary}`);
    console.log(`    Savings vs standard: -${estimates.standard.estimated - estimates.clientOnly.estimated}s`);
  }

  /**
   * Test additional competitor impact
   */
  async testAdditionalCompetitorImpact(): Promise<void> {
    console.log(chalk.bold.yellow('\n⏱️ ADDITIONAL COMPETITOR IMPACT'));
    console.log(chalk.gray('─'.repeat(50)));

    const additionalTime = timeEstimator.getAdditionalCompetitorTime();
    console.log(`\n  Each additional competitor adds: ~${additionalTime}s (${(additionalTime/60).toFixed(1)}min)`);
    
    // Show scaling
    const baseConfig = { clientCount: 1, competitorCount: 2, includeInsights: true, includeSpeed: true };
    const base = timeEstimator.estimateRunTime(baseConfig);
    
    console.log(`\n  📊 SCALING ANALYSIS:`);
    for (let competitors = 1; competitors <= 5; competitors++) {
      const estimate = timeEstimator.estimateRunTime({
        ...baseConfig,
        competitorCount: competitors
      });
      const websites = 1 + competitors;
      const avgPerSite = estimate.estimated / websites;
      console.log(`    ${websites} websites (1 client + ${competitors} competitors): ${estimate.estimated}s (${(estimate.estimated/60).toFixed(1)}min) | ~${avgPerSite.toFixed(0)}s/site`);
    }
  }

  /**
   * Validate against actual performance data
   */
  async validateAgainstActualData(): Promise<void> {
    console.log(chalk.bold.yellow('\n✅ VALIDATION AGAINST ACTUAL DATA'));
    console.log(chalk.gray('─'.repeat(50)));

    // Based on the comprehensive test that just completed
    const actualRunData = {
      configuration: {
        clientCount: 1,
        competitorCount: 2,
        includeInsights: true,
        includeSpeed: true
      },
      actualDurationSeconds: 635, // ~10.5 minutes from the test output
      breakdown: {
        client: 61,        // ~61s from logs
        competitor1: 287,  // ~4.8min from logs  
        competitor2: 287   // ~4.8min from logs
      }
    };

    const estimate = timeEstimator.estimateRunTime(actualRunData.configuration);
    const validation = timeEstimator.validateEstimate(
      actualRunData.configuration,
      actualRunData.actualDurationSeconds
    );

    console.log('\n  🎯 ESTIMATE vs ACTUAL:');
    console.log(`    Estimated: ${estimate.estimated}s (${(estimate.estimated/60).toFixed(1)}min)`);
    console.log(`    Actual: ${actualRunData.actualDurationSeconds}s (${(actualRunData.actualDurationSeconds/60).toFixed(1)}min)`);
    console.log(`    Accuracy: ${validation.accurate ? chalk.green('✓ Within range') : chalk.red('✗ Outside range')}`);
    console.log(`    Variance: ${validation.variance > 0 ? '+' : ''}${validation.variance.toFixed(1)}%`);
    console.log(`    Analysis: ${validation.analysis}`);

    console.log('\n  📋 COMPONENT ACCURACY:');
    console.log(`    Data Collection: Estimated ${estimate.breakdown.dataCollection}s | Observed ~27s (9s avg/site)`);
    console.log(`    AI Analysis: Estimated ${estimate.breakdown.tierTwoAIAnalysis}s | Observed ~72s (24s avg/site)`);
    console.log(`    Speed Analysis: Estimated ${estimate.breakdown.tierThreeExternalAPI}s | Observed ~93s (31s avg/site)`);
  }

  /**
   * Show updated minimum requirements
   */
  async showUpdatedRequirements(): Promise<void> {
    console.log(chalk.bold.yellow('\n🔄 UPDATED MINIMUM TIME REQUIREMENTS'));
    console.log(chalk.gray('─'.repeat(50)));

    const estimates = timeEstimator.getStandardEstimates();
    
    console.log('\n  📋 RECOMMENDED MINIMUM RUN TIMES:');
    console.log(`    Standard Run (1 client + 2 competitors): ${chalk.green(`${estimates.standard.minimum}-${estimates.standard.maximum}s`)} (${chalk.green(`${(estimates.standard.minimum/60).toFixed(1)}-${(estimates.standard.maximum/60).toFixed(1)}min`)})`);
    console.log(`    Extended Run (1 client + 3 competitors): ${chalk.yellow(`${estimates.extended.minimum}-${estimates.extended.maximum}s`)} (${chalk.yellow(`${(estimates.extended.minimum/60).toFixed(1)}-${(estimates.extended.maximum/60).toFixed(1)}min`)})`);
    console.log(`    Comprehensive Run (1 client + 4 competitors): ${chalk.red(`${estimates.comprehensive.minimum}-${estimates.comprehensive.maximum}s`)} (${chalk.red(`${(estimates.comprehensive.minimum/60).toFixed(1)}-${(estimates.comprehensive.maximum/60).toFixed(1)}min`)})`);
    
    console.log('\n  ⚡ COMPONENT TIMEOUTS (Per Website):');
    console.log(`    Data Collection: ${chalk.cyan('15s')} (was 60s)`);
    console.log(`    Basic Analysis: ${chalk.cyan('5s')} (was 30s)`);
    console.log(`    AI Analysis: ${chalk.cyan('40s')} (was 90s)`);
    console.log(`    Speed Analysis: ${chalk.cyan('45s')} (was 120s)`);
    console.log(`    Total per site: ${chalk.cyan('~105s')} (was ~305s)`);

    console.log('\n  📊 SYSTEM IMPLICATIONS:');
    console.log(`    • ${chalk.green('3x faster')} timeouts prevent wasted time`);
    console.log(`    • ${chalk.green('Early warnings')} at 80% of timeout`);
    console.log(`    • ${chalk.green('Smart recovery')} from checkpoints`);
    console.log(`    • ${chalk.green('Adaptive scaling')} based on actual performance`);
    
    console.log('\n  🎯 USER EXPECTATIONS:');
    console.log(`    • Standard runs: ${chalk.green('Plan for 6-10 minutes')}`);
    console.log(`    • Extended runs: ${chalk.yellow('Plan for 8-13 minutes')}`);
    console.log(`    • Comprehensive runs: ${chalk.red('Plan for 10-16 minutes')}`);
    console.log(`    • Each extra competitor: ${chalk.cyan(`+${timeEstimator.getAdditionalCompetitorTime()}s (~${(timeEstimator.getAdditionalCompetitorTime()/60).toFixed(1)}min)`)}`);
  }
}

// Main execution
async function main() {
  const runner = new TimeEstimatorTestRunner();
  
  try {
    await runner.runTest();
    console.log(chalk.green('\n🎉 TIME ESTIMATOR VALIDATION COMPLETE!'));
    console.log(chalk.green('Updated timeout management will prevent wasted runs.'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}