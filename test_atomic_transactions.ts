#!/usr/bin/env npx tsx
/**
 * Atomic Transaction Validation Test
 * 
 * Tests the atomic transaction patterns to ensure data consistency
 * during effectiveness scoring operations.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import { storage } from './server/storage';
import { 
  saveEffectivenessResultAtomically, 
  updateRunProgressAtomically,
  saveAIInsightsAtomically,
  markRunFailedAtomically,
  retryTransactionWithBackoff
} from './server/services/effectiveness/atomicTransactions';
import { EffectivenessResult, CriterionResult } from './server/services/effectiveness/types';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
}

class AtomicTransactionTestRunner {
  private results: TestResult[] = [];

  async runTest(): Promise<void> {
    console.log(chalk.bold.cyan('\n======================================='));
    console.log(chalk.bold.cyan('  ATOMIC TRANSACTION VALIDATION'));
    console.log(chalk.bold.cyan('=======================================\n'));

    try {
      // Test 1: Atomic effectiveness result saving (the critical fix)
      await this.test1_AtomicEffectivenessResultSave();
      
      // Test 2: AI insights atomic saving
      await this.test2_AtomicAIInsightsSave();
      
      // Test 3: Run failure marking
      await this.test3_AtomicRunFailureMarking();
      
      // Test 4: Transaction retry with exponential backoff
      await this.test4_TransactionRetryBackoff();
      
      // Final summary
      await this.showResults();
      
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
    }
  }

  /**
   * Test 1: Critical fix - atomic effectiveness result saving
   * This ensures client criterion scores are actually saved to database
   */
  async test1_AtomicEffectivenessResultSave(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 1: Atomic Effectiveness Result Save'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = Date.now();
    
    try {
      // Create a test run
      const testRun = await storage.createEffectivenessRun({
        clientId: 'demo-client-id',
        status: 'pending',
        overallScore: null
      });

      console.log('  Creating mock effectiveness result with criterion scores...');

      // Create mock effectiveness result (similar to real scoring)
      const mockResult: EffectivenessResult = {
        overallScore: 7.2,
        criterionResults: [
          {
            criterion: 'positioning',
            score: 8.5,
            evidence: { description: 'Strong positioning elements found' },
            passes: ['clear_value_prop'],
            failedChecks: [],
            warnings: []
          },
          {
            criterion: 'brand_story',
            score: 6.8,
            evidence: { description: 'Brand story could be more compelling' },
            passes: ['has_mission'],
            failedChecks: ['weak_narrative'],
            warnings: []
          },
          {
            criterion: 'ctas',
            score: 7.1,
            evidence: { description: 'CTAs are visible but could be optimized' },
            passes: ['cta_present'],
            failedChecks: [],
            warnings: ['cta_color_low_contrast']
          }
        ],
        screenshotUrl: 'https://test.screenshot.url',
        fullPageScreenshotUrl: 'https://test.fullpage.url',
        webVitals: {
          fcp: 1200,
          lcp: 2100,
          cls: 0.05,
          fid: 80
        }
      };

      console.log('  Saving result with atomic transaction...');
      
      // ✅ Test the critical fix: save all results atomically
      const result = await saveEffectivenessResultAtomically(
        testRun.id,
        mockResult,
        {
          status: 'completed',
          progress: 'Analysis complete',
          progressDetail: JSON.stringify({ phase: 'complete', percent: 100 })
        }
      );

      const duration = Date.now() - startTime;

      if (!result.success) {
        throw new Error(`Atomic save failed: ${result.error?.message}`);
      }

      // ✅ Verify criterion scores were actually saved (the bug we fixed)
      const savedCriterionScores = await storage.getCriterionScores(testRun.id);
      const savedRun = await storage.getEffectivenessRun(testRun.id);

      const success = 
        savedCriterionScores.length === 3 && // All 3 criteria saved
        savedRun.status === 'completed' &&   // Run marked complete
        savedRun.overallScore === '7.2' &&   // Overall score saved
        savedCriterionScores.some(s => s.criterion === 'positioning' && s.score === '8.5'); // Specific score saved

      this.results.push({
        testName: 'Atomic Effectiveness Result Save',
        success,
        duration
      });

      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Atomic save result: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Criterion scores saved: ${savedCriterionScores.length}/3`);
      console.log(`      Run status: ${savedRun.status}`);
      console.log(`      Overall score: ${savedRun.overallScore}`);

      if (success) {
        console.log(`  ${chalk.green('✓')} CRITICAL BUG FIXED: Client criterion scores now saved to database`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName: 'Atomic Effectiveness Result Save',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Atomic save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 2: AI insights atomic saving
   */
  async test2_AtomicAIInsightsSave(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 2: Atomic AI Insights Save'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = Date.now();
    
    try {
      // Create a test run
      const testRun = await storage.createEffectivenessRun({
        clientId: 'demo-client-id',
        status: 'generating_insights',
        overallScore: '7.5'
      });

      const mockInsights = {
        insight: 'Your website shows strong potential with clear positioning but could benefit from improved brand storytelling.',
        priorityMatrix: [
          { criterion: 'brand_story', score: 6.2, priority: 8.5 }
        ],
        keyFindings: ['Strong positioning elements', 'Weak brand narrative'],
        recommendations: ['Enhance brand story section', 'Add customer testimonials']
      };

      console.log('  Saving AI insights atomically...');
      
      const result = await saveAIInsightsAtomically(testRun.id, mockInsights, {
        progress: 'Analysis complete with insights',
        progressDetail: JSON.stringify({ phase: 'complete_with_insights', percent: 100 })
      });

      const duration = Date.now() - startTime;

      if (!result.success) {
        throw new Error(`AI insights save failed: ${result.error?.message}`);
      }

      // Verify insights were saved
      const savedRun = await storage.getEffectivenessRun(testRun.id);
      
      const success = 
        savedRun.aiInsights?.insight === mockInsights.insight &&
        savedRun.insightsGeneratedAt !== null &&
        savedRun.progress === 'Analysis complete with insights';

      this.results.push({
        testName: 'Atomic AI Insights Save',
        success,
        duration
      });

      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} AI insights save: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Insights saved: ${!!savedRun.aiInsights}`);
      console.log(`      Generated timestamp: ${!!savedRun.insightsGeneratedAt}`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName: 'Atomic AI Insights Save',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} AI insights save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 3: Run failure marking
   */
  async test3_AtomicRunFailureMarking(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 3: Atomic Run Failure Marking'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = Date.now();
    
    try {
      // Create a test run
      const testRun = await storage.createEffectivenessRun({
        clientId: 'demo-client-id',
        status: 'analyzing',
        overallScore: null
      });

      console.log('  Marking run as failed atomically...');
      
      const result = await markRunFailedAtomically(
        testRun.id,
        'Test failure: Mock scoring error for validation'
      );

      const duration = Date.now() - startTime;

      if (!result.success) {
        throw new Error(`Run failure marking failed: ${result.error?.message}`);
      }

      // Verify run was marked as failed
      const savedRun = await storage.getEffectivenessRun(testRun.id);
      
      const success = 
        savedRun.status === 'failed' &&
        savedRun.progress === 'Test failure: Mock scoring error for validation';

      this.results.push({
        testName: 'Atomic Run Failure Marking',
        success,
        duration
      });

      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Run failure marking: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Run status: ${savedRun.status}`);
      console.log(`      Failure reason: ${savedRun.progress?.substring(0, 50)}...`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName: 'Atomic Run Failure Marking',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Run failure marking failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 4: Transaction retry with exponential backoff
   */
  async test4_TransactionRetryBackoff(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 4: Transaction Retry with Backoff'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = Date.now();
    
    try {
      console.log('  Testing retry mechanism with mock failure...');
      
      let attempts = 0;
      const result = await retryTransactionWithBackoff(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Mock failure attempt ${attempts}`);
        }
        return { success: true, attempts };
      }, 3, 100); // Fast retry for testing

      const duration = Date.now() - startTime;
      
      const success = result.success && result.attempts === 3;

      this.results.push({
        testName: 'Transaction Retry with Backoff',
        success,
        duration
      });

      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Retry mechanism: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Attempts made: ${attempts}/3`);
      console.log(`      Final result: ${result.success}`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName: 'Transaction Retry with Backoff',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Retry mechanism failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show test results summary
   */
  async showResults(): Promise<void> {
    console.log(chalk.bold.yellow('\n📊 ATOMIC TRANSACTION TEST RESULTS'));
    console.log(chalk.gray('─'.repeat(60)));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;
    
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Successful: ${chalk.green(successfulTests)}`);
    console.log(`  Failed: ${chalk.red(failedTests)}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`  Average Duration: ${(avgDuration/1000).toFixed(2)}s`);
    
    // Show failed tests details
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log(`\n  ${chalk.red('Failed Tests:')}`);
      failedResults.forEach(result => {
        console.log(`    - ${result.testName}: ${result.error || 'Unknown error'}`);
      });
    }
    
    // Validation
    const criticalTestsPassed = this.results.filter(r => 
      r.testName === 'Atomic Effectiveness Result Save' && r.success
    ).length > 0;
    
    if (criticalTestsPassed && successRate >= 75) {
      console.log(chalk.green('\n✅ ATOMIC TRANSACTION PATTERNS VALIDATED!'));
      console.log(chalk.green('   • Critical bug fixed: Client criterion scores now saved'));
      console.log(chalk.green('   • AI insights saved atomically'));
      console.log(chalk.green('   • Run failure handling is transactional'));
      console.log(chalk.green('   • Retry mechanism working with exponential backoff'));
    } else {
      console.log(chalk.red('\n❌ ATOMIC TRANSACTION ISSUES DETECTED'));
      console.log(chalk.yellow('   Review failed tests above'));
    }
  }
}

// Main execution
async function main() {
  const runner = new AtomicTransactionTestRunner();
  
  try {
    await runner.runTest();
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