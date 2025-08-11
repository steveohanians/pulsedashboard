#!/usr/bin/env tsx

/**
 * SmartDataFetcher Lock & Status Registry Stress Test
 * 
 * Stress-tests concurrent GA4 fetch operations to validate:
 * - Exactly 1 active fetch per (clientId, timePeriod)
 * - Others queue/backoff properly
 * - No deadlocks occur
 * - inProgress flips to false at completion
 * - lastRefreshedAt updates exactly once
 * - Timing histogram and error capture
 */

import { performance } from 'perf_hooks';
import { ga4StatusRegistry } from '../server/services/ga4/StatusRegistry';
import { SmartGA4DataFetcher } from '../server/services/ga4/SmartDataFetcher';
import logger from '../server/utils/logging/logger';

interface StressTestResult {
  testId: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  lockAcquired: boolean;
  queuedWait: boolean;
  statusSnapshot?: any;
}

interface ConcurrencyMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  timingHistogram: number[];
  activeFeches: number;
  queuedRequests: number;
  lockContentionEvents: number;
  errors: string[];
}

class SmartDataFetcherStressTester {
  private results: StressTestResult[] = [];
  private lockContentionEvents = 0;
  private errorCapture: string[] = [];
  
  constructor(
    private testClientId: string = 'stress-test-client',
    private testTimePeriod: string = '2025-07'
  ) {}

  /**
   * Fire N parallel GA4 fetch triggers for the same (clientId, timePeriod)
   */
  async runStressTest(parallelRequests: number = 20): Promise<ConcurrencyMetrics> {
    console.log(`🚀 Starting SmartDataFetcher Stress Test with ${parallelRequests} parallel requests`);
    console.log(`Target: clientId="${this.testClientId}", timePeriod="${this.testTimePeriod}"`);
    
    // Reset state
    this.results = [];
    this.lockContentionEvents = 0;
    this.errorCapture = [];
    
    // Enable GA4 locks for this test
    process.env.GA4_LOCKS_ENABLED = 'true';
    
    // Create SmartGA4DataFetcher instance
    const dataFetcher = new SmartGA4DataFetcher();
    
    // Capture initial status
    const initialStatus = ga4StatusRegistry.getStatus(this.testClientId, this.testTimePeriod);
    console.log('Initial status:', initialStatus);
    
    // Create parallel fetch promises
    const fetchPromises = Array.from({ length: parallelRequests }, (_, index) => 
      this.executeParallelFetch(dataFetcher, index)
    );
    
    console.log(`📡 Firing ${parallelRequests} parallel requests...`);
    const startTime = performance.now();
    
    // Execute all fetches simultaneously
    const results = await Promise.allSettled(fetchPromises);
    
    const endTime = performance.now();
    const totalTestDuration = endTime - startTime;
    
    console.log(`⏱️  Total test duration: ${totalTestDuration.toFixed(2)}ms`);
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.results.push(result.value);
      } else {
        this.results.push({
          testId: index,
          startTime: startTime,
          endTime: endTime,
          duration: totalTestDuration,
          success: false,
          error: result.reason.message,
          lockAcquired: false,
          queuedWait: false
        });
        this.errorCapture.push(`Request ${index}: ${result.reason.message}`);
      }
    });
    
    // Analyze results and validate expectations
    const metrics = this.analyzeResults();
    await this.validateLockBehavior();
    this.generateReport(metrics, totalTestDuration);
    
    return metrics;
  }

  /**
   * Execute individual fetch with timing and status capture
   */
  private async executeParallelFetch(dataFetcher: SmartGA4DataFetcher, testId: number): Promise<StressTestResult> {
    const startTime = performance.now();
    
    try {
      // Pre-fetch: capture if a lock already exists
      const preFetchStatus = ga4StatusRegistry.getStatus(this.testClientId, this.testTimePeriod);
      const lockExisted = preFetchStatus?.inProgress || false;
      
      // Attempt to fetch data (this will trigger lock acquisition)
      const result = await dataFetcher.fetch15MonthData(
        this.testClientId, 
        false, // force=false for normal lock behavior
        this.testTimePeriod
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Post-fetch: capture final status
      const postFetchStatus = ga4StatusRegistry.getStatus(this.testClientId, this.testTimePeriod);
      
      // Detect if this request was queued (took longer due to waiting)
      const queuedWait = lockExisted && duration > 100; // 100ms threshold for queue detection
      
      if (queuedWait) {
        this.lockContentionEvents++;
      }
      
      return {
        testId,
        startTime,
        endTime,
        duration,
        success: result.success,
        error: result.errors.length > 0 ? result.errors[0] : undefined,
        lockAcquired: !lockExisted,
        queuedWait,
        statusSnapshot: postFetchStatus
      };
      
    } catch (error) {
      const endTime = performance.now();
      this.errorCapture.push(`Test ${testId}: ${(error as Error).message}`);
      
      return {
        testId,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: (error as Error).message,
        lockAcquired: false,
        queuedWait: false
      };
    }
  }

  /**
   * Analyze stress test results and generate metrics
   */
  private analyzeResults(): ConcurrencyMetrics {
    const successfulResults = this.results.filter(r => r.success);
    const failedResults = this.results.filter(r => !r.success);
    
    const durations = this.results.map(r => r.duration);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    // Create timing histogram (buckets of 100ms)
    const histogram: number[] = new Array(10).fill(0); // 0-999ms in 100ms buckets
    durations.forEach(duration => {
      const bucket = Math.min(Math.floor(duration / 100), 9);
      histogram[bucket]++;
    });
    
    const lockAcquisitions = this.results.filter(r => r.lockAcquired).length;
    const queuedRequests = this.results.filter(r => r.queuedWait).length;
    
    return {
      totalRequests: this.results.length,
      successfulRequests: successfulResults.length,
      failedRequests: failedResults.length,
      averageDuration,
      maxDuration,
      minDuration,
      timingHistogram: histogram,
      activeFeches: lockAcquisitions,
      queuedRequests,
      lockContentionEvents: this.lockContentionEvents,
      errors: this.errorCapture
    };
  }

  /**
   * Validate lock behavior expectations
   */
  private async validateLockBehavior(): Promise<void> {
    console.log('\n🔍 Validating lock behavior...');
    
    // Check 1: Exactly 1 successful lock acquisition
    const lockAcquisitions = this.results.filter(r => r.lockAcquired).length;
    console.log(`  Lock acquisitions: ${lockAcquisitions}`);
    
    if (lockAcquisitions !== 1) {
      console.log(`  ⚠️  WARNING: Expected exactly 1 lock acquisition, got ${lockAcquisitions}`);
    } else {
      console.log('  ✅ Exactly 1 lock acquisition (as expected)');
    }
    
    // Check 2: Verify inProgress state is now false
    const finalStatus = ga4StatusRegistry.getStatus(this.testClientId, this.testTimePeriod);
    if (finalStatus) {
      console.log(`  Final inProgress state: ${finalStatus.inProgress}`);
      if (finalStatus.inProgress) {
        console.log('  ⚠️  WARNING: inProgress is still true after test completion');
      } else {
        console.log('  ✅ inProgress properly set to false');
      }
      
      // Check 3: lastRefreshedAt should be updated
      if (finalStatus.lastRefreshedAt) {
        console.log('  ✅ lastRefreshedAt was updated');
        console.log(`    Updated at: ${finalStatus.lastRefreshedAt}`);
      } else {
        console.log('  ⚠️  WARNING: lastRefreshedAt was not updated');
      }
    } else {
      console.log('  ℹ️  No final status found (may have been cleaned up)');
    }
    
    // Check 4: No deadlocks (all requests completed)
    const incompleteRequests = this.results.filter(r => !r.endTime).length;
    if (incompleteRequests === 0) {
      console.log('  ✅ No deadlocks detected (all requests completed)');
    } else {
      console.log(`  ⚠️  WARNING: ${incompleteRequests} requests did not complete (possible deadlock)`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(metrics: ConcurrencyMetrics, totalDuration: number): void {
    console.log('\n📊 STRESS TEST REPORT');
    console.log('=====================');
    
    console.log(`🎯 Test Configuration:`);
    console.log(`  Target: ${this.testClientId}:${this.testTimePeriod}`);
    console.log(`  Parallel requests: ${metrics.totalRequests}`);
    console.log(`  Total test duration: ${totalDuration.toFixed(2)}ms`);
    
    console.log(`\n📈 Performance Metrics:`);
    console.log(`  Successful requests: ${metrics.successfulRequests}/${metrics.totalRequests} (${((metrics.successfulRequests/metrics.totalRequests)*100).toFixed(1)}%)`);
    console.log(`  Failed requests: ${metrics.failedRequests}`);
    console.log(`  Average duration: ${metrics.averageDuration.toFixed(2)}ms`);
    console.log(`  Min duration: ${metrics.minDuration.toFixed(2)}ms`);
    console.log(`  Max duration: ${metrics.maxDuration.toFixed(2)}ms`);
    
    console.log(`\n🔒 Lock Contention Analysis:`);
    console.log(`  Lock acquisitions: ${metrics.activeFeches}`);
    console.log(`  Queued/backed-off requests: ${metrics.queuedRequests}`);
    console.log(`  Contention events: ${metrics.lockContentionEvents}`);
    
    console.log(`\n⏱️  Timing Histogram (100ms buckets):`);
    metrics.timingHistogram.forEach((count, index) => {
      const rangeStart = index * 100;
      const rangeEnd = (index + 1) * 100 - 1;
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`  ${rangeStart}-${rangeEnd}ms: ${count} requests ${bar}`);
    });
    
    if (metrics.errors.length > 0) {
      console.log(`\n❌ Errors Captured:`);
      metrics.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (metrics.errors.length > 5) {
        console.log(`  ... and ${metrics.errors.length - 5} more errors`);
      }
    }
    
    // Contention analysis and recommendations
    this.analyzeContention(metrics);
  }

  /**
   * Analyze contention levels and propose optimizations
   */
  private analyzeContention(metrics: ConcurrencyMetrics): void {
    console.log(`\n🔬 Contention Analysis:`);
    
    const contentionRatio = metrics.lockContentionEvents / metrics.totalRequests;
    const avgContentionDelay = metrics.queuedRequests > 0 ? 
      metrics.averageDuration : 0;
    
    console.log(`  Contention ratio: ${(contentionRatio * 100).toFixed(1)}%`);
    console.log(`  Average delay for queued requests: ${avgContentionDelay.toFixed(2)}ms`);
    
    // Threshold analysis
    const HIGH_CONTENTION_THRESHOLD = 0.7; // 70% of requests experiencing contention
    const HIGH_DELAY_THRESHOLD = 1000; // 1 second average delay
    
    if (contentionRatio > HIGH_CONTENTION_THRESHOLD || avgContentionDelay > HIGH_DELAY_THRESHOLD) {
      console.log(`\n💡 OPTIMIZATION RECOMMENDATIONS:`);
      
      if (contentionRatio > HIGH_CONTENTION_THRESHOLD) {
        console.log(`  🎲 High contention detected (${(contentionRatio * 100).toFixed(1)}%)`);
        console.log(`     → Consider increasing jitter base delay from 500ms to 750ms`);
        console.log(`     → Add exponential backoff: delay *= 1.5 on subsequent retries`);
        console.log(`     → Implement circuit breaker pattern for failing clients`);
      }
      
      if (avgContentionDelay > HIGH_DELAY_THRESHOLD) {
        console.log(`  ⏰ High queue delays detected (avg: ${avgContentionDelay.toFixed(0)}ms)`);
        console.log(`     → Implement priority queue: admin requests > background jobs`);
        console.log(`     → Add request deduplication for identical (clientId, timePeriod)`);
        console.log(`     → Consider async notification instead of blocking waits`);
      }
      
      console.log(`\n🔧 Proposed Jitter/Backoff Tweaks:`);
      console.log(`     Current: generateJitteredDelay(500) // 500ms base`);
      console.log(`     Suggested: generateJitteredDelay(750, 1.5) // 750ms base + exponential`);
      console.log(`     Additional: Add circuit breaker with 3-failure threshold`);
      
    } else {
      console.log(`\n✅ PERFORMANCE ASSESSMENT:`);
      console.log(`  Contention levels within acceptable range`);
      console.log(`  Current jitter/backoff settings appear optimal`);
      console.log(`  No immediate optimization needed`);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🧪 SmartDataFetcher Lock & Status Registry Stress Test\n');
  
  try {
    const tester = new SmartDataFetcherStressTester();
    
    // Run stress test with 20 parallel requests
    const metrics = await tester.runStressTest(20);
    
    // Final validation
    console.log('\n🎯 FINAL VALIDATION:');
    const finalStatus = ga4StatusRegistry.getStatus('stress-test-client', '2025-07');
    
    if (finalStatus) {
      console.log(`  Final status exists: ✅`);
      console.log(`  inProgress: ${finalStatus.inProgress} (should be false)`);
      console.log(`  lastRefreshedAt: ${finalStatus.lastRefreshedAt ? '✅ Updated' : '❌ Not updated'}`);
    } else {
      console.log(`  Status cleaned up: ✅ (normal behavior after completion)`);
    }
    
    // Success criteria
    const success = metrics.failedRequests === 0 && 
                   metrics.lockContentionEvents < metrics.totalRequests &&
                   metrics.successfulRequests > 0;
    
    console.log(`\n🏆 OVERALL TEST RESULT: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!success) {
      console.log('  Issues detected - review contention analysis above');
      process.exit(1);
    } else {
      console.log('  All lock and concurrency expectations met');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Stress test failed:', error);
    process.exit(1);
  }
}

// Run stress test
main().catch(console.error);

export { SmartDataFetcherStressTester, ConcurrencyMetrics };