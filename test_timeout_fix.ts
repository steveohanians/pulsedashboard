#!/usr/bin/env npx tsx
/**
 * Quick Timeout Fix Validation
 * 
 * Tests that the guaranteed timeout wrapper prevents infinite hanging
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

async function testTimeoutFix() {
  console.log(chalk.bold.cyan('\n🕒 TIMEOUT FIX VALIDATION'));
  console.log(chalk.gray('─'.repeat(40)));

  try {
    // Import the fixed speed scorer
    const { scoreSpeed } = await import('./server/services/effectiveness/criteria/speedFixed.js');
    const mockConfig = {
      thresholds: { lcp_limit: 4.0, cls_limit: 0.25 }
    };

    // Test with problematic URL that should timeout quickly
    const startTime = performance.now();
    console.log('  Testing guaranteed timeout with problematic URL...');
    
    const context = { 
      websiteUrl: 'https://httpstat.us/500', // This was hanging before
      webVitals: null 
    };
    
    const result = await scoreSpeed(context, mockConfig);
    const duration = performance.now() - startTime;
    
    // Success if we get a result (fallback) in reasonable time
    const success = result && result.score > 0 && duration < 60000; // Under 1 minute
    
    const icon = success ? chalk.green('✓') : chalk.red('✗');
    const timeStr = `${(duration/1000).toFixed(1)}s`;
    
    console.log(`  ${icon} Timeout handling: ${timeStr} (${success ? 'no hanging' : 'still hanging'})`);
    
    if (result) {
      console.log(`      Score: ${result.score}/10`);
      console.log(`      Fallback used: ${result.evidence?.details?.fallbackReason ? 'Yes' : 'No'}`);
    }
    
    if (success) {
      console.log(chalk.green('\n✅ TIMEOUT FIX VALIDATED - No more infinite hanging!'));
    } else {
      console.log(chalk.red('\n❌ TIMEOUT ISSUE STILL PRESENT'));
    }
    
  } catch (error) {
    console.error(chalk.red('Test failed:'), error);
  }
}

testTimeoutFix();