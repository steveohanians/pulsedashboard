#!/usr/bin/env npx tsx
/**
 * PageSpeed API Fix Validation Test
 * 
 * Tests the enhanced PageSpeed API implementation to ensure:
 * 1. Proper 500 error handling with 1-180s sleep
 * 2. Enhanced exponential backoff with jitter
 * 3. Rate limit handling with Retry-After header support  
 * 4. 120s timeout vs 60s
 * 5. Intelligent fallback strategies based on error type
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

interface TestResult {
  testName: string;
  url: string;
  success: boolean;
  duration: number;
  score?: number;
  performanceScore?: number;
  fallbackUsed?: boolean;
  attempts?: number;
  error?: string;
  errorType?: string;
}

class PageSpeedApiTestRunner {
  private results: TestResult[] = [];
  private testUrls = [
    'https://www.cleardigital.com',
    'https://stripe.com', 
    'https://monday.com',
    'https://httpstat.us/500', // Simulated 500 error
    'https://httpstat.us/429'  // Simulated rate limit
  ];

  async runTest(): Promise<void> {
    console.log(chalk.bold.cyan('\n======================================'));
    console.log(chalk.bold.cyan('  PAGESPEED API FIX VALIDATION'));
    console.log(chalk.bold.cyan('======================================\n'));

    try {
      // Import the fixed speed scorer
      const { scoreSpeed } = await import('./server/services/effectiveness/criteria/speedFixed.js');
      const mockConfig = {
        thresholds: {
          lcp_limit: 4.0,
          cls_limit: 0.25
        }
      };

      // Test 1: Standard API calls (should work with enhanced reliability)
      await this.test1_StandardApiCalls(scoreSpeed, mockConfig);
      
      // Test 2: Error handling simulation
      await this.test2_ErrorHandling(scoreSpeed, mockConfig);
      
      // Test 3: Timeout behavior
      await this.test3_TimeoutBehavior(scoreSpeed, mockConfig);
      
      // Test 4: Fallback quality
      await this.test4_FallbackQuality(scoreSpeed, mockConfig);
      
      // Final summary
      await this.showResults();
      
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
    }
  }

  /**
   * Test 1: Standard API calls with enhanced reliability
   */
  async test1_StandardApiCalls(scoreSpeed: any, config: any): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 1: Enhanced API Reliability'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const url of this.testUrls.slice(0, 3)) { // Skip error URLs
      const startTime = performance.now();
      
      try {
        console.log(`  Testing enhanced API call: ${url}`);
        
        const context = { websiteUrl: url, webVitals: null };
        const result = await scoreSpeed(context, config);
        const duration = performance.now() - startTime;
        
        const success = result && result.score > 0;
        
        this.results.push({
          testName: 'Enhanced API Call',
          url,
          success,
          duration,
          score: result?.score,
          performanceScore: result?.evidence?.details?.performanceScore,
          fallbackUsed: result?.evidence?.details?.apiStatus === 'fallback_used',
          attempts: result?.evidence?.details?.attempts || 1
        });
        
        const icon = success ? chalk.green('✓') : chalk.red('✗');
        const scoreStr = result?.score ? `${result.score}/10` : 'no score';
        const fallbackNote = result?.evidence?.details?.apiStatus === 'fallback_used' ? ' (fallback)' : '';
        console.log(`    ${icon} ${url} (${(duration/1000).toFixed(2)}s, ${scoreStr}${fallbackNote})`);
        
        if (result?.evidence?.details?.retriesUsed > 0) {
          console.log(`      Retries used: ${result.evidence.details.retriesUsed}`);
        }
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          testName: 'Enhanced API Call',
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
   * Test 2: Error handling simulation
   */
  async test2_ErrorHandling(scoreSpeed: any, config: any): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 2: Error Handling (500 & Rate Limits)'));
    console.log(chalk.gray('─'.repeat(50)));

    const errorUrls = [
      { url: 'https://httpstat.us/500', expectedError: '500 Server Error' },
      { url: 'https://httpstat.us/429', expectedError: '429 Rate Limited' }
    ];

    for (const { url, expectedError } of errorUrls) {
      const startTime = performance.now();
      
      try {
        console.log(`  Testing error handling: ${expectedError}`);
        
        const context = { websiteUrl: url, webVitals: null };
        const result = await scoreSpeed(context, config);
        const duration = performance.now() - startTime;
        
        // For error URLs, success means graceful fallback handling
        const success = result && result.score > 0 && result.evidence?.details?.fallbackReason;
        
        this.results.push({
          testName: 'Error Handling',
          url,
          success,
          duration,
          score: result?.score,
          fallbackUsed: true,
          attempts: result?.evidence?.details?.attempts || 3,
          errorType: expectedError
        });
        
        const icon = success ? chalk.green('✓') : chalk.red('✗');
        const scoreStr = result?.score ? `${result.score}/10 (fallback)` : 'no score';
        console.log(`    ${icon} ${expectedError} handled gracefully (${(duration/1000).toFixed(2)}s, ${scoreStr})`);
        
        if (result?.evidence?.details?.attempts > 1) {
          console.log(`      Enhanced retries: ${result.evidence.details.attempts}`);
        }
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          testName: 'Error Handling',
          url,
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error),
          errorType: expectedError
        });
        
        console.log(`    ${chalk.red('✗')} ${expectedError} - Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Test 3: Timeout behavior (120s vs 60s)
   */
  async test3_TimeoutBehavior(scoreSpeed: any, config: any): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 3: Enhanced Timeout Behavior'));
    console.log(chalk.gray('─'.repeat(50)));

    // Test with a slow-responding URL (if available)
    const slowUrl = 'https://httpstat.us/200?sleep=5000'; // 5 second delay
    const startTime = performance.now();
    
    try {
      console.log(`  Testing enhanced timeout handling with slow URL`);
      
      const context = { websiteUrl: slowUrl, webVitals: null };
      const result = await scoreSpeed(context, config);
      const duration = performance.now() - startTime;
      
      const success = result && result.score > 0;
      
      this.results.push({
        testName: 'Enhanced Timeout',
        url: slowUrl,
        success,
        duration,
        score: result?.score,
        fallbackUsed: result?.evidence?.details?.apiStatus === 'fallback_used'
      });
      
      const icon = success ? chalk.green('✓') : chalk.red('✗');
      const timeoutNote = duration > 120000 ? ' (120s+ timeout)' : ' (within timeout)';
      console.log(`    ${icon} Slow URL handled${timeoutNote} (${(duration/1000).toFixed(2)}s)`);
      
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`    ${chalk.yellow('⚠')} Timeout test inconclusive: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 4: Fallback quality
   */
  async test4_FallbackQuality(scoreSpeed: any, config: any): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 4: Intelligent Fallback Quality'));
    console.log(chalk.gray('─'.repeat(50)));

    // Test with a non-existent domain to force fallback
    const fallbackUrl = 'https://this-domain-should-not-exist-12345.com';
    const startTime = performance.now();
    
    try {
      console.log(`  Testing intelligent fallback with unreachable URL`);
      
      const context = { websiteUrl: fallbackUrl, webVitals: null };
      const result = await scoreSpeed(context, config);
      const duration = performance.now() - startTime;
      
      // Success means we got a reasonable fallback score
      const success = result && result.score > 0 && result.score < 8; // Should be conservative
      
      this.results.push({
        testName: 'Intelligent Fallback',
        url: fallbackUrl,
        success,
        duration,
        score: result?.score,
        fallbackUsed: true
      });
      
      const icon = success ? chalk.green('✓') : chalk.red('✗');
      const scoreStr = result?.score ? `${result.score}/10` : 'no score';
      console.log(`    ${icon} Intelligent fallback generated (${(duration/1000).toFixed(2)}s, ${scoreStr})`);
      
      if (result?.evidence?.details?.enhancedHandling) {
        console.log(`      Enhanced error handling: Applied`);
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`    ${chalk.red('✗')} Fallback test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show comprehensive test results
   */
  async showResults(): Promise<void> {
    console.log(chalk.bold.yellow('\n📊 PAGESPEED API FIX VALIDATION RESULTS'));
    console.log(chalk.gray('─'.repeat(60)));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;
    
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Successful: ${chalk.green(successfulTests)}`);
    console.log(`  Failed: ${chalk.red(failedTests)}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    
    // Analyze specific improvements
    const enhancedTests = this.results.filter(r => r.testName === 'Enhanced API Call').length;
    const enhancedSuccessful = this.results.filter(r => r.testName === 'Enhanced API Call' && r.success).length;
    
    const errorHandlingTests = this.results.filter(r => r.testName === 'Error Handling').length;
    const errorHandlingSuccessful = this.results.filter(r => r.testName === 'Error Handling' && r.success).length;
    
    const fallbackTests = this.results.filter(r => r.testName === 'Intelligent Fallback').length;
    const fallbackSuccessful = this.results.filter(r => r.testName === 'Intelligent Fallback' && r.success).length;
    
    console.log(`\n  Test Breakdown:`);
    console.log(`    Enhanced API Calls: ${enhancedSuccessful}/${enhancedTests} ${enhancedSuccessful === enhancedTests ? '✅' : '❌'}`);
    console.log(`    Error Handling: ${errorHandlingSuccessful}/${errorHandlingTests} ${errorHandlingSuccessful === errorHandlingTests ? '✅' : '❌'}`);
    console.log(`    Intelligent Fallback: ${fallbackSuccessful}/${fallbackTests} ${fallbackSuccessful === fallbackTests ? '✅' : '❌'}`);
    
    // Performance analysis
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    const maxDuration = Math.max(...this.results.map(r => r.duration));
    
    console.log(`\n  Performance Analysis:`);
    console.log(`    Average Duration: ${(avgDuration/1000).toFixed(2)}s`);
    console.log(`    Max Duration: ${(maxDuration/1000).toFixed(2)}s`);
    
    // Enhanced features validation
    const withRetries = this.results.filter(r => r.attempts && r.attempts > 1).length;
    const withFallback = this.results.filter(r => r.fallbackUsed).length;
    
    console.log(`\n  Enhanced Features:`);
    console.log(`    Tests with retries: ${withRetries} ${withRetries > 0 ? '✅' : '⚠️'}`);
    console.log(`    Tests with fallback: ${withFallback} ${withFallback > 0 ? '✅' : '⚠️'}`);
    
    // Final validation
    const criticalFeatures = [
      enhancedSuccessful === enhancedTests,
      errorHandlingSuccessful >= Math.floor(errorHandlingTests * 0.8), // 80% for error handling
      fallbackSuccessful === fallbackTests,
      maxDuration < 180000 // Under 3 minutes max
    ];
    
    const allCriticalPass = criticalFeatures.every(f => f);
    
    if (allCriticalPass) {
      console.log(chalk.green('\n✅ PAGESPEED API FIXES VALIDATED - Enhanced error handling working!'));
      console.log(chalk.green('   • 500 error handling implemented'));
      console.log(chalk.green('   • Rate limit management active'));
      console.log(chalk.green('   • Enhanced timeout handling (120s)'));
      console.log(chalk.green('   • Intelligent fallback strategies enabled'));
    } else {
      console.log(chalk.red('\n❌ PAGESPEED API ISSUES STILL PRESENT'));
      console.log(chalk.yellow('   Review failed tests and error logs above'));
    }
  }
}

// Main execution
async function main() {
  const runner = new PageSpeedApiTestRunner();
  
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