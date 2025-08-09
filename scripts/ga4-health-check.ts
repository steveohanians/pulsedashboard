#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chdir, cwd } from 'process';

// Ensure we're running from the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Change to project root BEFORE importing modules
process.chdir(projectRoot);

const { db } = await import(join(cwd(), 'server', 'db.js'));
const { clients, metrics } = await import(join(cwd(), 'shared', 'schema.js'));
const { sql, eq, and, inArray } = await import('drizzle-orm');
import { exit } from 'process';

console.log('🏥 GA4 Health Check - Metrics Count Validation');
console.log('===============================================');
console.log('');

// Generate last 3 months in both formats
function generateTimePeriods(): { monthly: string[], daily: string[] } {
  const now = new Date();
  const monthly: string[] = [];
  const daily: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthlyPeriod = date.toISOString().slice(0, 7); // YYYY-MM
    const dailyPeriod = `${monthlyPeriod}-daily`; // YYYY-MM-daily
    
    monthly.push(monthlyPeriod);
    daily.push(dailyPeriod);
  }
  
  return { monthly, daily };
}

interface MetricCount {
  clientId: string;
  clientName: string;
  timePeriod: string;
  count: number;
}

async function main() {
  try {
    // Get all active clients
    console.log('📊 Fetching active clients...');
    const allClients = await db.select({
      id: clients.id,
      name: clients.name,
      active: clients.active
    }).from(clients).where(eq(clients.active, true));
    
    console.log(`Found ${allClients.length} active clients`);
    console.log('');
    
    if (allClients.length === 0) {
      console.log('⚠️  WARNING: No active clients found');
      exit(1);
    }
    
    // Generate time periods to check
    const { monthly, daily } = generateTimePeriods();
    const allTimePeriods = [...monthly, ...daily];
    
    console.log('🗓️  Checking time periods:');
    console.log(`  Monthly: ${monthly.join(', ')}`);
    console.log(`  Daily: ${daily.join(', ')}`);
    console.log('');
    
    let hasWarnings = false;
    const results: MetricCount[] = [];
    
    // Check metrics count for each client and time period
    console.log('🔍 Checking metrics counts...');
    console.log('');
    
    for (const client of allClients) {
      console.log(`📈 Client: ${client.name} (${client.id})`);
      
      for (const timePeriod of allTimePeriods) {
        try {
          const result = await db.select({
            count: sql<number>`count(*)::int`
          }).from(metrics)
           .where(and(
             eq(metrics.clientId, client.id),
             eq(metrics.timePeriod, timePeriod)
           ));
          
          const count = result[0]?.count || 0;
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            timePeriod,
            count
          });
          
          if (count === 0) {
            console.log(`  ⚠️  WARNING: ${timePeriod} - ${count} metrics`);
            hasWarnings = true;
          } else {
            console.log(`  ✅ ${timePeriod} - ${count} metrics`);
          }
        } catch (error) {
          console.log(`  ❌ ERROR: ${timePeriod} - ${error}`);
          hasWarnings = true;
        }
      }
      console.log('');
    }
    
    // Summary report
    console.log('📋 Health Check Summary');
    console.log('=======================');
    
    const totalChecks = results.length;
    const zeroCountChecks = results.filter(r => r.count === 0).length;
    const healthyChecks = totalChecks - zeroCountChecks;
    
    console.log(`Total checks: ${totalChecks}`);
    console.log(`Healthy periods: ${healthyChecks}`);
    console.log(`Zero count periods: ${zeroCountChecks}`);
    console.log('');
    
    if (zeroCountChecks > 0) {
      console.log('⚠️  ZERO COUNT DETAILS:');
      results
        .filter(r => r.count === 0)
        .forEach(r => {
          console.log(`  • ${r.clientName}: ${r.timePeriod}`);
        });
      console.log('');
    }
    
    // Health percentage
    const healthPercentage = ((healthyChecks / totalChecks) * 100).toFixed(1);
    console.log(`🏥 Overall Health: ${healthPercentage}%`);
    console.log('');
    
    if (hasWarnings) {
      console.log('❌ Health check FAILED - Zero metric counts detected');
      console.log('💡 Consider running data sync or investigating data pipeline issues');
      exit(1);
    } else {
      console.log('✅ Health check PASSED - All periods have metrics');
      exit(0);
    }
    
  } catch (error) {
    console.error('💥 Health check CRASHED:', error);
    exit(1);
  }
}

// Run the health check
main();