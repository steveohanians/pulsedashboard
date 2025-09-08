#!/usr/bin/env npx tsx

import { effectivenessService } from './server/services/EffectivenessService';

// Capture console output
const logs: string[] = [];
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

['log', 'info', 'warn', 'error'].forEach(method => {
  (console as any)[method] = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    logs.push(`[${method.toUpperCase()}] ${msg}`);
    if (method === 'log') originalLog(...args);
    else if (method === 'info') originalInfo(...args);
    else if (method === 'warn') originalWarn(...args);
    else if (method === 'error') originalError(...args);
  };
});

async function triggerTestRun() {
  console.log('\n=== TRIGGERING TEST RUN TO CAPTURE TIER 2 LOGS ===\n');
  
  try {
    // Start analysis for demo client
    const result = await effectivenessService.startAnalysis('demo-client-id', true);
    console.log('Analysis started with runId:', result.runId);
    
    // Wait a bit for some processing
    console.log('Waiting 30 seconds for Tier 2 to execute...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.log('Error:', error);
  }
  
  // Restore console
  console.log = originalLog;
  console.info = originalInfo;
  console.warn = originalWarn;
  console.error = originalError;
  
  // Filter Tier 2 logs
  console.log('\n=== TIER 2 RELATED LOGS ===\n');
  const tier2Logs = logs.filter(log => 
    log.includes('[TIER 2') ||
    log.includes('Tier 2') ||
    log.includes('tier 2') ||
    log.includes('AI-Powered') ||
    log.includes('brand_story') ||
    log.includes('positioning') ||
    log.includes('ctas') ||
    log.includes('OpenAI') ||
    log.includes('hasOpenAI') ||
    log.includes('requiresAI')
  );
  
  if (tier2Logs.length === 0) {
    console.log('No Tier 2 logs found! Showing all tier-related logs:\n');
    const tierLogs = logs.filter(log => log.toLowerCase().includes('tier'));
    tierLogs.slice(-30).forEach(log => console.log(log.substring(0, 200)));
  } else {
    tier2Logs.forEach(log => console.log(log.substring(0, 500)));
  }
  
  process.exit(0);
}

triggerTestRun().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
