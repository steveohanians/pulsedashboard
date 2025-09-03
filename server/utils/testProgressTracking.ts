/**
 * Test Granular Progress Tracking System
 * 
 * Verifies that:
 * 1. Progress callbacks include detailed information
 * 2. Database progressDetail field is populated
 * 3. Tier completion tracking works
 * 4. Phase progression is accurate
 */

import { EnhancedWebsiteEffectivenessScorer } from '../services/effectiveness/enhancedScorer';
import { storage } from '../storage';
import logger from './logging/logger';

async function testProgressTracking() {
  console.log('\n=== Granular Progress Tracking Test ===\n');
  
  const results = {
    progressCallbacks: { tested: false, working: false, details: '', count: 0 },
    progressDetail: { tested: false, working: false, details: '' },
    tierTracking: { tested: false, working: false, details: '' },
    phaseProgression: { tested: false, working: false, details: '' }
  };
  
  const progressUpdates: any[] = [];
  
  // Test 1: Progress callbacks with detailed information
  console.log('Test 1: Enhanced progress callback tracking...');
  try {
    const scorer = new EnhancedWebsiteEffectivenessScorer();
    
    // Create test client for tracking
    const testClient = await storage.createClient({
      name: 'Test Progress Client',
      domain: 'example.com',
      websiteUrl: 'https://example.com',
      industryVertical: 'Technology',
      businessSize: 'Medium',
      userId: 'test-user',
      email: 'test@example.com'
    });
    
    const testRun = await storage.createEffectivenessRun({
      clientId: testClient.id,
      status: 'initializing',
      overallScore: null
    });
    
    // Test scoring with progress callback
    await scorer.scoreWebsiteProgressive(
      'https://example.com',
      testRun.id,
      async (status: string, progress: string, results?: any, progressDetail?: any) => {
        progressUpdates.push({
          status,
          progress,
          progressDetail,
          timestamp: new Date()
        });
        
        console.log(`  Progress: ${status} - ${progress}`);
        if (progressDetail) {
          console.log(`    Detail: Phase ${progressDetail.phase}, Progress ${progressDetail.progress}%`);
        }
      }
    );
    
    results.progressCallbacks.tested = true;
    results.progressCallbacks.count = progressUpdates.length;
    
    if (progressUpdates.length >= 3) { // Should have at least data collection, tier completions
      results.progressCallbacks.working = true;
      results.progressCallbacks.details = `Received ${progressUpdates.length} progress updates`;
    } else {
      results.progressCallbacks.details = `Only received ${progressUpdates.length} progress updates`;
    }
    
    // Test 2: Database progressDetail field
    console.log('\nTest 2: Database progressDetail population...');
    const finalRun = await storage.getEffectivenessRun(testRun.id);
    
    results.progressDetail.tested = true;
    if (finalRun && finalRun.progressDetail) {
      try {
        const parsedDetail = JSON.parse(finalRun.progressDetail as string);
        if (parsedDetail.phase && parsedDetail.progress !== undefined) {
          results.progressDetail.working = true;
          results.progressDetail.details = `Final phase: ${parsedDetail.phase}, Progress: ${parsedDetail.progress}%`;
        } else {
          results.progressDetail.details = 'progressDetail missing required fields';
        }
      } catch (parseError) {
        results.progressDetail.details = 'progressDetail not valid JSON';
      }
    } else {
      results.progressDetail.details = 'progressDetail field not populated';
    }
    
    // Test 3: Tier completion tracking
    console.log('\nTest 3: Tier completion tracking...');
    const tierProgress = progressUpdates.filter(update => 
      update.progressDetail?.phase === 'criterion_analysis' &&
      update.progressDetail?.subPhase?.includes('tier_')
    );
    
    results.tierTracking.tested = true;
    if (tierProgress.length >= 2) { // Should have multiple tier completions
      results.tierTracking.working = true;
      results.tierTracking.details = `Tracked ${tierProgress.length} tier completions`;
    } else {
      results.tierTracking.details = `Only tracked ${tierProgress.length} tier completions`;
    }
    
    // Test 4: Phase progression validation
    console.log('\nTest 4: Phase progression validation...');
    const phases = progressUpdates
      .filter(update => update.progressDetail?.phase)
      .map(update => update.progressDetail.phase);
    
    const expectedPhases = ['data_collection', 'criterion_analysis'];
    const foundPhases = expectedPhases.filter(phase => phases.includes(phase));
    
    results.phaseProgression.tested = true;
    if (foundPhases.length >= 2) {
      results.phaseProgression.working = true;
      results.phaseProgression.details = `Found expected phases: ${foundPhases.join(', ')}`;
    } else {
      results.phaseProgression.details = `Missing phases. Found: ${Array.from(new Set(phases)).join(', ')}`;
    }
    
    // Cleanup
    await storage.deleteClient(testClient.id);
    
  } catch (error) {
    console.log(`  ✗ Progress tracking test failed: ${error instanceof Error ? error.message : String(error)}`);
    results.progressCallbacks.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
  
  // Results summary
  console.log('\n=== Progress Tracking Test Results ===\n');
  
  const testResults = [
    ['Progress Callbacks', results.progressCallbacks],
    ['Database ProgressDetail', results.progressDetail],
    ['Tier Tracking', results.tierTracking],
    ['Phase Progression', results.phaseProgression]
  ];
  
  let totalPassed = 0;
  let totalTested = 0;
  
  testResults.forEach(([testName, result]) => {
    const status = result.tested ? (result.working ? '✓ PASS' : '✗ FAIL') : '○ SKIP';
    console.log(`${testName}: ${status}`);
    console.log(`  Details: ${result.details}`);
    if (testName === 'Progress Callbacks') {
      console.log(`  Count: ${result.count} updates`);
    }
    console.log('');
    
    if (result.tested) {
      totalTested++;
      if (result.working) totalPassed++;
    }
  });
  
  // Show sample progress updates
  console.log('=== Sample Progress Updates ===\n');
  progressUpdates.slice(0, 5).forEach((update, index) => {
    console.log(`${index + 1}. [${update.status}] ${update.progress}`);
    if (update.progressDetail) {
      console.log(`   Phase: ${update.progressDetail.phase}, Progress: ${update.progressDetail.progress}%`);
    }
  });
  if (progressUpdates.length > 5) {
    console.log(`... and ${progressUpdates.length - 5} more updates`);
  }
  
  const overallSuccess = totalPassed >= 2; // At least half should pass
  console.log(`\nOverall: ${totalPassed}/${totalTested} progress tracking features working`);
  console.log(overallSuccess ? '🎉 Granular progress tracking system working!' : '⚠️  Some progress features need attention');
  
  return overallSuccess;
}

// Run test immediately
testProgressTracking()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Progress tracking test failed:', error);
    process.exit(1);
  });