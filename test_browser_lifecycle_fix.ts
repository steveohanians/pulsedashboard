#!/usr/bin/env npx tsx
/**
 * Browser Lifecycle Fix Validation Test
 * 
 * Tests the fixed screenshot service to ensure:
 * 1. No "Target page, context or browser has been closed" errors
 * 2. Proper context isolation
 * 3. Safe cleanup procedures  
 * 4. Consistent HTML capture success rates
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import { screenshotServiceFixed } from './server/services/effectiveness/screenshotServiceFixed';

interface TestResult {
  url: string;
  success: boolean;
  duration: number;
  htmlLength?: number;
  error?: string;
  operationId?: string;
}

class BrowserLifecycleTestRunner {
  private results: TestResult[] = [];
  private testUrls = [
    'https://www.cleardigital.com',
    'https://stripe.com', 
    'https://monday.com'
  ];

  async runTest(): Promise<void> {
    console.log(chalk.bold.cyan('\n======================================='));
    console.log(chalk.bold.cyan('  BROWSER LIFECYCLE FIX VALIDATION'));
    console.log(chalk.bold.cyan('=======================================\n'));

    try {
      // Test 1: Sequential HTML captures (should work reliably)
      await this.test1_SequentialCaptures();
      
      // Test 2: Concurrent HTML captures (stress test)
      await this.test2_ConcurrentCaptures();
      
      // Test 3: Cleanup during operations (race condition test)
      await this.test3_CleanupRaceCondition();
      
      // Test 4: Browser health monitoring
      await this.test4_BrowserHealthMonitoring();
      
      // Final summary
      await this.showResults();
      
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
    }
  }

  /**
   * Test 1: Sequential HTML captures
   */
  async test1_SequentialCaptures(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 1: Sequential HTML Captures'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const url of this.testUrls) {
      const startTime = performance.now();
      
      try {
        console.log(`  Testing HTML capture: ${url}`);
        const html = await screenshotServiceFixed.captureRenderedHTMLOnly(url);
        const duration = performance.now() - startTime;
        
        const success = !!html && html.length > 1000;
        
        this.results.push({
          url,
          success,
          duration,
          htmlLength: html?.length,
        });
        
        const icon = success ? chalk.green('✓') : chalk.red('✗');
        const sizeInfo = html ? `${Math.round(html.length / 1024)}KB` : 'no data';
        console.log(`    ${icon} ${url} (${(duration/1000).toFixed(2)}s, ${sizeInfo})`);
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          url,
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        console.log(`    ${chalk.red('✗')} ${url} - Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Test 2: Concurrent HTML captures  
   */
  async test2_ConcurrentCaptures(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 2: Concurrent HTML Captures'));
    console.log(chalk.gray('─'.repeat(50)));

    const promises = this.testUrls.map(async (url) => {
      const startTime = performance.now();
      
      try {
        console.log(`  Starting concurrent capture: ${url}`);
        const html = await screenshotServiceFixed.captureRenderedHTMLOnly(url);
        const duration = performance.now() - startTime;
        
        const success = !!html && html.length > 1000;
        
        return {
          url,
          success,
          duration,
          htmlLength: html?.length,
          test: 'concurrent'
        };
        
      } catch (error) {
        const duration = performance.now() - startTime;
        return {
          url,
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error),
          test: 'concurrent'
        };
      }
    });
    
    const concurrentResults = await Promise.all(promises);
    
    concurrentResults.forEach(result => {
      const icon = result.success ? chalk.green('✓') : chalk.red('✗');
      const sizeInfo = result.htmlLength ? `${Math.round(result.htmlLength / 1024)}KB` : 'no data';
      console.log(`    ${icon} ${result.url} (${(result.duration/1000).toFixed(2)}s, ${sizeInfo})`);
      
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    
    this.results.push(...concurrentResults);
  }

  /**
   * Test 3: Cleanup during operations (race condition test)
   */
  async test3_CleanupRaceCondition(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 3: Cleanup Race Condition Test'));
    console.log(chalk.gray('─'.repeat(50)));

    // Start a long-running capture
    const longRunningPromise = screenshotServiceFixed.captureRenderedHTMLOnly('https://www.cleardigital.com');
    
    // Wait 2 seconds, then try cleanup (this should wait for operation to complete)
    setTimeout(() => {
      console.log('  Attempting cleanup during active operation...');
      screenshotServiceFixed.cleanup().then(() => {
        console.log('  Cleanup completed (should have waited for operation)');
      });
    }, 2000);
    
    try {
      const startTime = performance.now();
      const html = await longRunningPromise;
      const duration = performance.now() - startTime;
      
      const success = !!html && html.length > 1000;
      
      this.results.push({
        url: 'cleanup-race-test',
        success,
        duration,
        htmlLength: html?.length,
      });
      
      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} HTML capture completed despite cleanup attempt (${(duration/1000).toFixed(2)}s)`);
      
    } catch (error) {
      console.log(`  ${chalk.red('✗')} HTML capture failed during cleanup: ${error instanceof Error ? error.message : String(error)}`);
      
      this.results.push({
        url: 'cleanup-race-test',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test 4: Browser health monitoring
   */
  async test4_BrowserHealthMonitoring(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 4: Browser Health Monitoring'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      const browserInfo = await screenshotServiceFixed.getBrowserInfo();
      
      if (browserInfo) {
        console.log('  Browser Status:');
        console.log(`    Available: ${browserInfo.isAvailable ? chalk.green('✓') : chalk.red('✗')}`);
        console.log(`    Healthy: ${browserInfo.isHealthy ? chalk.green('✓') : chalk.red('✗')}`);
        console.log(`    Active Operations: ${browserInfo.activeOperations}`);
        console.log(`    Browser Age: ${Math.round(browserInfo.browserAge / 1000)}s`);
        console.log(`    Contexts: ${browserInfo.contexts}`);
      } else {
        console.log('  ' + chalk.yellow('⚠') + ' Browser info not available');
      }
      
    } catch (error) {
      console.log(`  ${chalk.red('✗')} Browser health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show test results summary
   */
  async showResults(): Promise<void> {
    console.log(chalk.bold.yellow('\n📊 TEST RESULTS SUMMARY'));
    console.log(chalk.gray('─'.repeat(50)));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;
    
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Successful: ${chalk.green(successfulTests)}`);
    console.log(`  Failed: ${chalk.red(failedTests)}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    
    // Check for specific error patterns
    const browserClosedErrors = this.results.filter(r => 
      r.error?.includes('browser has been closed') || 
      r.error?.includes('context has been closed')
    ).length;
    
    console.log(`\n  Race Condition Errors: ${browserClosedErrors === 0 ? chalk.green('0 ✓') : chalk.red(browserClosedErrors)}`);
    
    if (browserClosedErrors === 0) {
      console.log(chalk.green('\n✅ BROWSER LIFECYCLE FIX VALIDATED - No race condition errors!'));
    } else {
      console.log(chalk.red('\n❌ BROWSER LIFECYCLE ISSUES STILL PRESENT'));
    }
    
    // Final cleanup
    await screenshotServiceFixed.cleanup();
    console.log(chalk.dim('\n🧹 Final cleanup completed'));
  }
}

// Main execution
async function main() {
  const runner = new BrowserLifecycleTestRunner();
  
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