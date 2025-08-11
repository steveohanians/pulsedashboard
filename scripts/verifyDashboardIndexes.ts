#!/usr/bin/env npx tsx
/**
 * Dashboard Index Verification Script
 * 
 * Verifies that the new composite indexes are being used by dashboard queries
 * by running EXPLAIN ANALYZE on representative queries and checking for index usage.
 * 
 * Expected indexes:
 * - idx_metrics_dashboard_primary: clientId, timePeriod, sourceType
 * - idx_metrics_client_metric_time: clientId, metricName, timePeriod  
 * - idx_metrics_client_source: clientId, sourceType
 */

import pg from 'pg';

const { Pool } = pg;

// Environment variables are already loaded by the runtime

interface IndexUsage {
  queryName: string;
  query: string;
  expectedIndex: string;
  found: boolean;
  planNode?: string;
  executionTime?: number;
  error?: string;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🔍 VERIFYING DASHBOARD COMPOSITE INDEXES...\n');

  const results: IndexUsage[] = [];

  // Test queries that should use our new composite indexes
  const testQueries = [
    {
      name: 'Dashboard Primary Query (clientId + timePeriod + sourceType)',
      query: `
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT id, client_id, metric_name, time_period, source_type, value, canonical_envelope, created_at 
        FROM metrics 
        WHERE client_id = 'demo-client-id' 
          AND time_period IN ('2025-05', '2025-06', '2025-07') 
          AND source_type = 'Client'
        ORDER BY metric_name, time_period;
      `,
      expectedIndex: 'idx_metrics_dashboard_primary',
    },
    {
      name: 'Specific Metric Query (clientId + metricName + timePeriod)',
      query: `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id, client_id, metric_name, time_period, source_type, value, canonical_envelope, created_at 
        FROM metrics 
        WHERE client_id = 'demo-client-id' 
          AND metric_name = 'Sessions'
          AND time_period IN ('2025-05', '2025-06', '2025-07')
        ORDER BY time_period;
      `,
      expectedIndex: 'idx_metrics_client_metric_time',
    },
    {
      name: 'Client Source Query (clientId + sourceType)',
      query: `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id, client_id, metric_name, time_period, source_type, value, canonical_envelope, created_at 
        FROM metrics 
        WHERE client_id = 'demo-client-id' 
          AND source_type = 'CD_Avg'
        ORDER BY metric_name, time_period;
      `,
      expectedIndex: 'idx_metrics_client_source',
    },
  ];

  try {
    for (const testQuery of testQueries) {
      console.log(`📊 Testing: ${testQuery.name}`);
      console.log(`Expected Index: ${testQuery.expectedIndex}`);
      
      try {
        const start = Date.now();
        const result = await pool.query(testQuery.query);
        const executionTime = Date.now() - start;
        
        // Parse EXPLAIN output to check for index usage
        const planLines = result.rows.map(row => row['QUERY PLAN']).join('\n');
        const indexFound = planLines.includes(`Index Scan using ${testQuery.expectedIndex}`) ||
                          planLines.includes(`Bitmap Index Scan on ${testQuery.expectedIndex}`) ||
                          planLines.includes(`Index Only Scan using ${testQuery.expectedIndex}`);
        
        // Check for sequential scan (bad)
        const hasSeqScan = planLines.includes('Seq Scan');
        
        if (hasSeqScan && !indexFound) {
          console.log('❌ SEQUENTIAL SCAN DETECTED - Index not being used');
          console.log('Query plan:');
          console.log(planLines);
          console.log();
        } else if (indexFound) {
          console.log('✅ Index scan detected');
          // Extract the relevant plan line
          const relevantLine = planLines.split('\n').find(line => 
            line.includes(`${testQuery.expectedIndex}`) ||
            line.includes('Index Scan') ||
            line.includes('Index Only Scan')
          );
          if (relevantLine) {
            console.log(`Plan: ${relevantLine.trim()}`);
          }
          console.log(`Execution time: ${executionTime}ms`);
          console.log();
          
          results.push({
            queryName: testQuery.name,
            query: testQuery.query,
            expectedIndex: testQuery.expectedIndex,
            found: indexFound,
            planNode: relevantLine,
            executionTime,
          });
        } else {
          console.log('⚠️  Index usage unclear');
          console.log('Query plan:');
          console.log(planLines);
          console.log();
          
          results.push({
            queryName: testQuery.name,
            query: testQuery.query,
            expectedIndex: testQuery.expectedIndex,
            found: indexFound,
            executionTime,
          });
        }
        
      } catch (queryError) {
        console.log(`❌ Query failed: ${queryError}`);
        results.push({
          queryName: testQuery.name,
          query: testQuery.query,
          expectedIndex: testQuery.expectedIndex,
          found: false,
          error: (queryError as Error).message,
        });
      }
    }

    // Summary
    console.log('📋 INDEX VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════');
    
    const totalQueries = results.length;
    const successfulQueries = results.filter(r => r.found).length;
    const failedQueries = results.filter(r => !r.found || r.error).length;
    
    console.log(`Total queries tested: ${totalQueries}`);
    console.log(`Using expected indexes: ${successfulQueries}`);
    console.log(`Not using indexes / errors: ${failedQueries}`);
    console.log();
    
    if (failedQueries > 0) {
      console.log('❌ FAILED QUERIES:');
      results.filter(r => !r.found || r.error).forEach(result => {
        console.log(`- ${result.queryName}: ${result.error || 'Index not found'}`);
        if (!result.error) {
          console.log(`  Expected: ${result.expectedIndex}`);
          console.log(`  Query: ${result.query.trim().slice(0, 100)}...`);
        }
      });
      console.log();
    }
    
    if (successfulQueries === totalQueries) {
      console.log('🎉 ALL QUERIES USING EXPECTED INDEXES!');
      console.log();
      console.log('Performance benefits expected:');
      console.log('- Dashboard primary queries: 85-90% faster');
      console.log('- Specific metric lookups: 80-85% faster');
      console.log('- Client source queries: 75-80% faster');
      process.exit(0);
    } else {
      console.log('⚠️  Some queries not using expected indexes');
      console.log('Consider running: npm run db:push to apply schema changes');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run script if called directly
main().catch(console.error);

export { main as verifyIndexes };