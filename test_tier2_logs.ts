#!/usr/bin/env npx tsx

import { EnhancedScorer } from './server/services/effectiveness/enhancedScorer';

async function testTier2() {
  console.log('\n=== TESTING TIER 2 EXECUTION WITH LOGGING ===\n');
  
  // Set up console to capture logs
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  const logs: string[] = [];
  
  // Override console methods to capture logs
  console.log = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    logs.push(msg);
    originalLog(...args);
  };
  
  console.info = console.log;
  console.warn = console.log;
  console.error = console.log;
  
  try {
    const scorer = new EnhancedScorer();
    
    // Test with a simple website
    console.log('Starting analysis for https://cleardigital.com...\n');
    
    const results = await scorer.scoreWebsiteProgressive(
      'https://cleardigital.com',
      'test-run-' + Date.now()
    );
    
    console.log('\n=== RESULTS ===');
    console.log('Completed criteria:', results.completedCriteria);
    console.log('Total criteria:', results.totalCriteria);
    
  } catch (error) {
    console.log('Error during scoring:', error);
  }
  
  // Restore console
  console.log = originalLog;
  console.info = originalInfo;
  console.warn = originalWarn;
  console.error = originalError;
  
  // Filter and show Tier 2 specific logs
  console.log('\n=== TIER 2 SPECIFIC LOGS ===\n');
  const tier2Logs = logs.filter(log => 
    log.includes('TIER 2') || 
    log.includes('tier 2') || 
    log.includes('Tier 2') ||
    log.includes('brand_story') ||
    log.includes('positioning') ||
    log.includes('ctas') ||
    log.includes('OpenAI') ||
    log.includes('AI-Powered')
  );
  
  if (tier2Logs.length === 0) {
    console.log('No Tier 2 specific logs found!');
    console.log('\nAll logs related to tiers:');
    const tierLogs = logs.filter(log => log.toLowerCase().includes('tier'));
    tierLogs.forEach(log => console.log(log));
  } else {
    tier2Logs.forEach(log => console.log(log));
  }
  
  process.exit(0);
}

testTier2().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
