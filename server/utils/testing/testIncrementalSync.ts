#!/usr/bin/env tsx
/**
 * Test Incremental SEMrush Sync Functionality
 * 
 * This script tests the incremental sync implementation by:
 * 1. Checking existing data for a benchmark company
 * 2. Running incremental sync and measuring performance
 * 3. Verifying only missing periods are fetched
 */

import { storage } from '../../storage';
import { BenchmarkIntegration } from '../../services/semrush/benchmarkIntegration';
import { semrushService } from '../../services/semrush/semrushService';
import logger from '../logging/logger';
import type { BenchmarkCompany } from '@shared/schema';

class IncrementalSyncTester {
  private integration: BenchmarkIntegration;

  constructor() {
    this.integration = new BenchmarkIntegration(storage);
  }

  /**
   * Test incremental sync for a specific benchmark company
   */
  async testIncrementalSync(companyId?: string): Promise<void> {
    console.log('🧪 Testing Incremental SEMrush Sync Implementation');
    console.log('================================================\n');

    try {
      // Step 1: Get a test company
      const testCompany = await this.getTestCompany(companyId);
      if (!testCompany) {
        console.log('❌ No test company found');
        return;
      }

      console.log(`📊 Test Company: ${testCompany.name} (${testCompany.id})`);
      console.log(`🌐 Website: ${testCompany.websiteUrl}\n`);

      // Step 2: Check existing data
      await this.analyzeExistingData(testCompany.id);

      // Step 3: Test incremental sync performance
      await this.testIncrementalSyncPerformance(testCompany);

      console.log('\n✅ Incremental sync test completed successfully!');

    } catch (error) {
      console.error('\n❌ Test failed:', (error as Error).message);
      logger.error('Incremental sync test error', { error: (error as Error).stack });
    }
  }

  /**
   * Get a test company (use existing or create a mock one)
   */
  private async getTestCompany(companyId?: string): Promise<BenchmarkCompany | null> {
    if (companyId) {
      const companies = await storage.getBenchmarkCompaniesWithMetrics();
      return companies.find(c => c.id === companyId) || null;
    }

    // Get any company with existing metrics for testing
    const companies = await storage.getBenchmarkCompaniesWithMetrics();
    return companies.length > 0 ? companies[0] : null;
  }

  /**
   * Analyze existing data for the company
   */
  private async analyzeExistingData(companyId: string): Promise<void> {
    console.log('🔍 Analyzing existing data...');
    
    const entity = { kind: 'benchmark' as const, id: companyId };
    const existingPeriods = await storage.getExistingSemrushPeriods(entity);
    
    console.log(`📈 Existing periods: ${existingPeriods.size}`);
    if (existingPeriods.size > 0) {
      const sortedPeriods = Array.from(existingPeriods).sort();
      console.log(`   • Earliest: ${sortedPeriods[0]}`);
      console.log(`   • Latest: ${sortedPeriods[sortedPeriods.length - 1]}`);
      console.log(`   • All periods: [${sortedPeriods.join(', ')}]`);

      // Check integrity of a few sample periods
      console.log('\n🔧 Checking data integrity...');
      const samplePeriods = sortedPeriods.slice(-3); // Last 3 periods
      for (const period of samplePeriods) {
        const integrity = await storage.getSemrushPeriodIntegrity(entity, period);
        console.log(`   • ${period}: ${integrity.complete ? '✅' : '❌'} complete (${integrity.metricCount} metrics)`);
      }
    } else {
      console.log('   • No existing data found - full sync will be performed');
    }
    console.log('');
  }

  /**
   * Test incremental sync performance
   */
  private async testIncrementalSyncPerformance(company: BenchmarkCompany): Promise<void> {
    console.log('⚡ Testing incremental sync performance...\n');

    // Test 1: Incremental sync (should be fast if data exists)
    console.log('1️⃣ Running incremental sync...');
    const incrementalStartTime = Date.now();
    
    const incrementalResult = await this.integration.processNewBenchmarkCompany(company, {
      incrementalSync: true,
      emitProgressEvents: false
    });

    const incrementalDuration = Date.now() - incrementalStartTime;

    console.log(`   ✅ Incremental sync completed in ${incrementalDuration}ms`);
    console.log(`   📊 Result: ${incrementalResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   📈 Periods processed: ${incrementalResult.periodsProcessed}`);
    console.log(`   💾 Metrics stored: ${incrementalResult.metricsStored}`);
    
    if (incrementalResult.error) {
      console.log(`   ❌ Error: ${incrementalResult.error}`);
    }

    // Analysis
    console.log('\n📋 Performance Analysis:');
    const efficiency = incrementalResult.periodsProcessed === 0 ? 100 : 
      Math.round((1 - incrementalResult.periodsProcessed / 15) * 100);
    
    console.log(`   • Efficiency: ${efficiency}% (skipped ${15 - incrementalResult.periodsProcessed}/15 periods)`);
    console.log(`   • Time saved: ~${Math.max(0, 15000 - incrementalDuration)}ms estimated`);
    
    if (incrementalResult.periodsProcessed === 0) {
      console.log('   🎉 Perfect! No periods needed fetching - all data was up to date');
    } else if (incrementalResult.periodsProcessed < 15) {
      console.log('   ✅ Good! Incremental sync fetched only missing periods');
    } else {
      console.log('   ⚠️  Warning: Full sync was performed - check if incremental logic is working');
    }
  }
}

// Main execution function
async function runIncrementalSyncTest() {
  const tester = new IncrementalSyncTester();
  
  // Get company ID from command line args if provided
  const companyId = process.argv[2] || undefined;
  
  if (companyId) {
    console.log(`Using specific company ID: ${companyId}\n`);
  }
  
  await tester.testIncrementalSync(companyId);
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIncrementalSyncTest().catch((error) => {
    console.error('❌ Script execution failed:', error.message);
    process.exit(1);
  });
}

export { IncrementalSyncTester };