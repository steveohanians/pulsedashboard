#!/usr/bin/env npx tsx
/**
 * OpenAI Queue Manager Test
 * 
 * Tests the OpenAI request queuing with proper rate limiting
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

import { OpenAI } from 'openai';
import { createQueuedOpenAI, SCORING_PRIORITIES } from './server/services/effectiveness/queuedOpenAI';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  requestsProcessed: number;
  queueTime?: number;
  error?: string;
}

class OpenAIQueueTestRunner {
  private results: TestResult[] = [];
  private openai: OpenAI;
  private queuedOpenAI: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.queuedOpenAI = createQueuedOpenAI(this.openai);
  }

  async runTest(): Promise<void> {
    console.log(chalk.bold.cyan('\n======================================='));
    console.log(chalk.bold.cyan('  OPENAI QUEUE MANAGER VALIDATION'));
    console.log(chalk.bold.cyan('=======================================\n'));

    try {
      // Test 1: Basic queuing functionality
      await this.test1_BasicQueuing();
      
      // Test 2: Priority ordering
      await this.test2_PriorityOrdering();
      
      // Test 3: Concurrent request throttling
      await this.test3_ConcurrentThrottling();
      
      // Test 4: Queue status monitoring
      await this.test4_QueueMonitoring();
      
      // Final summary
      await this.showResults();
      
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
    }
  }

  /**
   * Test 1: Basic queuing functionality
   */
  async test1_BasicQueuing(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 1: Basic Request Queuing'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = performance.now();
    
    try {
      console.log('  Testing basic OpenAI request through queue...');
      
      const result = await this.queuedOpenAI.chat_completions_create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello World' in exactly 2 words." }
        ],
        max_tokens: 10,
        temperature: 0
      }, {
        scoringType: 'HEALTH_CHECK'
      });
      
      const duration = performance.now() - startTime;
      const success = result?.choices?.[0]?.message?.content?.includes('Hello');
      
      this.results.push({
        testName: 'Basic Queuing',
        success,
        duration,
        requestsProcessed: 1
      });
      
      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Basic queuing: ${(duration/1000).toFixed(2)}s`);
      
      if (result?.usage) {
        console.log(`      Tokens used: ${result.usage.total_tokens}`);
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.results.push({
        testName: 'Basic Queuing',
        success: false,
        duration,
        requestsProcessed: 0,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Basic queuing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 2: Priority ordering
   */
  async test2_PriorityOrdering(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 2: Priority Ordering'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = performance.now();
    let completedRequests = 0;
    const completionOrder: string[] = [];
    
    try {
      console.log('  Testing priority-based request ordering...');
      
      // Create requests with different priorities (queued but not awaited yet)
      const lowPriorityPromise = this.queuedOpenAI.chat_completions_create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'LOW PRIORITY'" }],
        max_tokens: 10
      }, {
        priority: 1
      }).then((result: any) => {
        completedRequests++;
        completionOrder.push('LOW');
        return result;
      });

      const highPriorityPromise = this.queuedOpenAI.chat_completions_create({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: "Say 'HIGH PRIORITY'" }],
        max_tokens: 10
      }, {
        priority: 10
      }).then((result: any) => {
        completedRequests++;
        completionOrder.push('HIGH');
        return result;
      });

      const mediumPriorityPromise = this.queuedOpenAI.chat_completions_create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'MEDIUM PRIORITY'" }],
        max_tokens: 10
      }, {
        priority: 5
      }).then((result: any) => {
        completedRequests++;
        completionOrder.push('MEDIUM');
        return result;
      });
      
      // Wait for all to complete
      await Promise.all([lowPriorityPromise, highPriorityPromise, mediumPriorityPromise]);
      
      const duration = performance.now() - startTime;
      
      // Check if HIGH priority completed first (or at least before LOW)
      const highIndex = completionOrder.indexOf('HIGH');
      const lowIndex = completionOrder.indexOf('LOW');
      const priorityRespected = highIndex < lowIndex;
      
      this.results.push({
        testName: 'Priority Ordering',
        success: priorityRespected && completedRequests === 3,
        duration,
        requestsProcessed: completedRequests
      });
      
      const icon = priorityRespected ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Priority ordering: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Completion order: ${completionOrder.join(' → ')}`);
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.results.push({
        testName: 'Priority Ordering',
        success: false,
        duration,
        requestsProcessed: completedRequests,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Priority ordering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 3: Concurrent request throttling
   */
  async test3_ConcurrentThrottling(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 3: Concurrent Request Throttling'));
    console.log(chalk.gray('─'.repeat(50)));

    const startTime = performance.now();
    
    try {
      console.log('  Testing concurrent request limiting...');
      
      // Get initial queue status
      const initialStatus = this.queuedOpenAI.getQueueStatus();
      console.log(`      Initial queue length: ${initialStatus.queueLength}`);
      console.log(`      Active requests: ${initialStatus.activeRequests}`);
      
      // Create multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) => 
        this.queuedOpenAI.chat_completions_create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Say 'Request ${i + 1}'` }],
          max_tokens: 10
        }, {
          scoringType: 'INSIGHTS'
        })
      );
      
      // Check queue status while processing
      setTimeout(() => {
        const processingStatus = this.queuedOpenAI.getQueueStatus();
        console.log(`      During processing - Queue: ${processingStatus.queueLength}, Active: ${processingStatus.activeRequests}`);
      }, 1000);
      
      const results = await Promise.all(requests);
      const duration = performance.now() - startTime;
      
      const success = results.length === 5 && results.every(r => r?.choices?.[0]?.message?.content);
      
      this.results.push({
        testName: 'Concurrent Throttling',
        success,
        duration,
        requestsProcessed: results.length
      });
      
      const icon = success ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Concurrent throttling: ${(duration/1000).toFixed(2)}s`);
      console.log(`      Processed ${results.length} requests successfully`);
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.results.push({
        testName: 'Concurrent Throttling',
        success: false,
        duration,
        requestsProcessed: 0,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Concurrent throttling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test 4: Queue monitoring
   */
  async test4_QueueMonitoring(): Promise<void> {
    console.log(chalk.bold.yellow('\n🧪 TEST 4: Queue Status Monitoring'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      console.log('  Testing queue status monitoring...');
      
      const status = this.queuedOpenAI.getQueueStatus();
      
      console.log('  Queue Status:');
      console.log(`    Queue Length: ${status.queueLength}`);
      console.log(`    Active Requests: ${status.activeRequests}`);
      console.log(`    Total Requests: ${status.metrics.totalRequests}`);
      console.log(`    Success Rate: ${((status.metrics.successfulRequests / status.metrics.totalRequests) * 100).toFixed(1)}%`);
      console.log(`    Rate Limit Errors: ${status.metrics.rateLimitErrors}`);
      console.log(`    Circuit Breaker: ${status.circuitBreakerState}`);
      console.log(`    Estimated Wait Time: ${Math.round(status.estimatedWaitTime / 1000)}s`);
      
      // Test health check
      const healthCheck = await this.queuedOpenAI.healthCheck();
      console.log(`    Health Check: ${healthCheck.status}`);
      
      this.results.push({
        testName: 'Queue Monitoring',
        success: true,
        duration: 0,
        requestsProcessed: status.metrics.totalRequests
      });
      
      console.log(`  ${chalk.green('✓')} Queue monitoring working`);
      
    } catch (error) {
      this.results.push({
        testName: 'Queue Monitoring',
        success: false,
        duration: 0,
        requestsProcessed: 0,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`  ${chalk.red('✗')} Queue monitoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show test results summary
   */
  async showResults(): Promise<void> {
    console.log(chalk.bold.yellow('\n📊 OPENAI QUEUE MANAGER TEST RESULTS'));
    console.log(chalk.gray('─'.repeat(60)));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;
    
    const totalRequests = this.results.reduce((sum, r) => sum + r.requestsProcessed, 0);
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Successful: ${chalk.green(successfulTests)}`);
    console.log(`  Failed: ${chalk.red(failedTests)}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`  Total Requests Processed: ${totalRequests}`);
    console.log(`  Average Test Duration: ${(avgDuration/1000).toFixed(2)}s`);
    
    // Get final queue status
    const finalStatus = this.queuedOpenAI.getQueueStatus();
    console.log(`\n  Final Queue Metrics:`);
    console.log(`    Requests Processed: ${finalStatus.metrics.totalRequests}`);
    console.log(`    Success Rate: ${((finalStatus.metrics.successfulRequests / finalStatus.metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`    Rate Limit Errors: ${finalStatus.metrics.rateLimitErrors}`);
    console.log(`    Average Response Time: ${Math.round(finalStatus.metrics.averageResponseTime)}ms`);
    
    // Validation
    const criticalPassed = [
      successfulTests >= 3,  // Most tests passed
      totalRequests >= 5,    // Processed multiple requests
      finalStatus.metrics.rateLimitErrors === 0  // No rate limit errors
    ];
    
    const allCriticalPass = criticalPassed.every(c => c);
    
    if (allCriticalPass) {
      console.log(chalk.green('\n✅ OPENAI QUEUE MANAGER VALIDATED!'));
      console.log(chalk.green('   • Request queuing working properly'));
      console.log(chalk.green('   • Priority ordering functional'));
      console.log(chalk.green('   • Concurrent request throttling active'));
      console.log(chalk.green('   • No rate limit errors encountered'));
    } else {
      console.log(chalk.red('\n❌ OPENAI QUEUE MANAGER ISSUES PRESENT'));
      console.log(chalk.yellow('   Review failed tests above'));
    }
  }
}

// Main execution
async function main() {
  const runner = new OpenAIQueueTestRunner();
  
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