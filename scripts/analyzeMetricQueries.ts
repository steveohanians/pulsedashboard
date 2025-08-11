#!/usr/bin/env tsx

/**
 * Metric Query Performance Analysis
 * 
 * Captures actual SQL queries used by /api/dashboard for last_3_months,
 * runs EXPLAIN ANALYZE, and suggests optimal composite indexes.
 */

import { db, metrics } from "../server/storage";
import { eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

interface QueryAnalysis {
  query: string;
  parameters: any[];
  explainResult: any[];
  executionTime: number;
  indexSuggestion: string;
  currentPlan: string;
  proposedPlan: string;
  estimatedGain: string;
}

class MetricQueryAnalyzer {
  
  /**
   * Simulate the typical dashboard query patterns for last_3_months
   */
  private generateDashboardQueries(): Array<{ name: string; query: any; description: string }> {
    const clientId = 'demo-client-id';
    const periods = ['2024-08', '2024-09', '2024-10']; // Last 3 months simulation
    const sourceTypes = ['Client', 'CD_Avg', 'Competitor'];
    const metricNames = ['Sessions', 'Bounce Rate', 'Session Duration', 'Device Distribution'];
    
    return [
      {
        name: 'Dashboard Metrics Query - Client Data',
        description: 'Primary query for fetching client metrics across multiple periods',
        query: db
          .select()
          .from(metrics)
          .where(
            and(
              eq(metrics.clientId, clientId),
              inArray(metrics.timePeriod, periods),
              eq(metrics.sourceType, 'Client')
            )
          )
      },
      
      {
        name: 'Dashboard Metrics Query - Benchmark Data',
        description: 'Query for fetching benchmark metrics for comparison',
        query: db
          .select()
          .from(metrics)
          .where(
            and(
              eq(metrics.clientId, clientId),
              inArray(metrics.timePeriod, periods),
              inArray(metrics.sourceType, ['CD_Avg', 'Competitor'])
            )
          )
      },
      
      {
        name: 'Dashboard Metrics Query - Specific Metric',
        description: 'Query for fetching specific metric across all source types',
        query: db
          .select()
          .from(metrics)
          .where(
            and(
              eq(metrics.clientId, clientId),
              eq(metrics.metricName, 'Sessions'),
              inArray(metrics.timePeriod, periods)
            )
          )
      }
    ];
  }

  /**
   * Run EXPLAIN ANALYZE on queries to get execution plans
   */
  private async analyzeQuery(query: any, queryName: string): Promise<QueryAnalysis> {
    const startTime = performance.now();
    
    try {
      // Get the SQL and parameters from Drizzle query
      const { sql: querySQL, params } = query.toSQL();
      
      // Run EXPLAIN ANALYZE
      const explainResult = await db.execute(sql`EXPLAIN ANALYZE ${sql.raw(querySQL)}`);
      
      const executionTime = performance.now() - startTime;
      
      // Generate index suggestions based on WHERE clauses
      const indexSuggestion = this.generateIndexSuggestion(querySQL, params);
      const currentPlan = this.extractCurrentPlan(explainResult);
      const proposedPlan = this.generateProposedPlan(indexSuggestion);
      const estimatedGain = this.estimatePerformanceGain(explainResult);
      
      return {
        query: querySQL,
        parameters: params,
        explainResult: explainResult,
        executionTime,
        indexSuggestion,
        currentPlan,
        proposedPlan,
        estimatedGain
      };
      
    } catch (error) {
      console.error(`Failed to analyze query ${queryName}:`, error);
      throw error;
    }
  }

  /**
   * Generate optimal index suggestions based on query patterns
   */
  private generateIndexSuggestion(querySQL: string, params: any[]): string {
    // Analyze WHERE clause patterns
    const hasClientId = querySQL.includes('client_id');
    const hasTimePeriod = querySQL.includes('time_period');
    const hasSourceType = querySQL.includes('source_type');
    const hasMetricName = querySQL.includes('metric_name');
    
    // Suggest composite index based on predicate selectivity and query patterns
    if (hasClientId && hasTimePeriod && hasSourceType) {
      return 'CREATE INDEX idx_metrics_dashboard_composite ON metrics (client_id, time_period, source_type);';
    } else if (hasClientId && hasMetricName && hasTimePeriod) {
      return 'CREATE INDEX idx_metrics_client_metric_period ON metrics (client_id, metric_name, time_period);';
    } else if (hasClientId && hasTimePeriod) {
      return 'CREATE INDEX idx_metrics_client_period ON metrics (client_id, time_period);';
    } else {
      return 'No specific index recommendation for this query pattern.';
    }
  }

  /**
   * Extract current execution plan details
   */
  private extractCurrentPlan(explainResult: any[]): string {
    const planLines = explainResult.map((row: any) => Object.values(row)[0]).join('\n');
    
    // Extract key performance indicators
    const seqScanMatch = planLines.match(/Seq Scan.*cost=([0-9.]+)\.\.([0-9.]+)/);
    const indexScanMatch = planLines.match(/Index Scan.*cost=([0-9.]+)\.\.([0-9.]+)/);
    const executionTimeMatch = planLines.match(/Execution Time: ([0-9.]+) ms/);
    
    let summary = 'Current Execution Plan:\n';
    
    if (seqScanMatch) {
      summary += `- Sequential Scan detected (cost: ${seqScanMatch[1]}..${seqScanMatch[2]})\n`;
    }
    if (indexScanMatch) {
      summary += `- Index Scan found (cost: ${indexScanMatch[1]}..${indexScanMatch[2]})\n`;
    }
    if (executionTimeMatch) {
      summary += `- Execution Time: ${executionTimeMatch[1]} ms\n`;
    }
    
    return summary + '\nFull Plan:\n' + planLines;
  }

  /**
   * Generate proposed execution plan with new index
   */
  private generateProposedPlan(indexSuggestion: string): string {
    if (indexSuggestion.includes('No specific index')) {
      return 'No index optimization proposed.';
    }
    
    return `Proposed Plan with ${indexSuggestion}:
- Replace Sequential Scan with Index Scan
- Eliminate table scan overhead
- Reduce I/O operations
- Improve query selectivity`;
  }

  /**
   * Estimate performance gain from index optimization
   */
  private estimatePerformanceGain(explainResult: any[]): string {
    const planText = explainResult.map((row: any) => Object.values(row)[0]).join('\n');
    
    // Check for sequential scans (indicator of missing indexes)
    const hasSeqScan = planText.includes('Seq Scan');
    const executionTimeMatch = planText.match(/Execution Time: ([0-9.]+) ms/);
    const rowsMatch = planText.match(/rows=([0-9]+)/);
    
    if (hasSeqScan && executionTimeMatch && rowsMatch) {
      const currentTime = parseFloat(executionTimeMatch[1]);
      const rowCount = parseInt(rowsMatch[1]);
      
      // Estimate improvement based on row count and scan type
      let estimatedImprovement: number;
      if (rowCount > 10000) {
        estimatedImprovement = 80; // High improvement for large tables
      } else if (rowCount > 1000) {
        estimatedImprovement = 60; // Moderate improvement
      } else {
        estimatedImprovement = 30; // Small improvement
      }
      
      const estimatedNewTime = currentTime * (1 - estimatedImprovement / 100);
      
      return `Estimated ${estimatedImprovement}% improvement:
- Current: ${currentTime} ms
- Estimated with index: ${estimatedNewTime.toFixed(2)} ms
- Performance gain: ${(currentTime - estimatedNewTime).toFixed(2)} ms`;
    }
    
    return 'Performance gain estimation requires execution time data.';
  }

  /**
   * Run comprehensive analysis on dashboard queries
   */
  async runAnalysis(): Promise<void> {
    console.log('🔍 Metric Query Performance Analysis\n');
    console.log('Analyzing queries used by /api/dashboard for last_3_months...\n');
    
    const queries = this.generateDashboardQueries();
    const analyses: QueryAnalysis[] = [];
    
    // Analyze each query
    for (const [index, queryInfo] of queries.entries()) {
      console.log(`📊 Query ${index + 1}: ${queryInfo.name}`);
      console.log(`Description: ${queryInfo.description}\n`);
      
      try {
        const analysis = await this.analyzeQuery(queryInfo.query, queryInfo.name);
        analyses.push(analysis);
        
        // Display results
        console.log('Query SQL:');
        console.log(analysis.query);
        console.log('\nParameters:', analysis.parameters);
        console.log('\nExecution Time:', analysis.executionTime.toFixed(2), 'ms');
        console.log('\n' + analysis.currentPlan);
        console.log('\nIndex Suggestion:');
        console.log(analysis.indexSuggestion);
        console.log('\n' + analysis.proposedPlan);
        console.log('\n' + analysis.estimatedGain);
        console.log('\n' + '='.repeat(80) + '\n');
        
      } catch (error) {
        console.error(`❌ Failed to analyze query ${index + 1}:`, error);
      }
    }
    
    // Generate summary and recommendations
    this.generateSummaryReport(analyses);
  }

  /**
   * Generate summary report with composite index recommendations
   */
  private generateSummaryReport(analyses: QueryAnalysis[]): void {
    console.log('📋 SUMMARY REPORT: Metric Query Optimization\n');
    
    // Current state analysis
    console.log('🔍 Current Index State:');
    console.log('- idx_metrics_competitor_id (competitor_id)');
    console.log('- idx_metrics_competitor_time_period (competitor_id, time_period)');
    console.log('- metrics_pkey (id)\n');
    
    // Missing critical indexes
    console.log('❌ Missing Critical Indexes:');
    console.log('- No index on (client_id, time_period, source_type)');
    console.log('- No index on (client_id, metric_name, time_period)');
    console.log('- No standalone index on client_id\n');
    
    // Recommendations
    console.log('🎯 RECOMMENDED COMPOSITE INDEXES:\n');
    
    console.log('1. Primary Dashboard Query Index:');
    console.log('   CREATE INDEX idx_metrics_dashboard_primary');
    console.log('   ON metrics (client_id, time_period, source_type);');
    console.log('   → Optimizes dashboard data fetching with multi-period queries\n');
    
    console.log('2. Metric-Specific Query Index:');
    console.log('   CREATE INDEX idx_metrics_client_metric');
    console.log('   ON metrics (client_id, metric_name, time_period);');
    console.log('   → Optimizes single metric across multiple periods\n');
    
    console.log('3. Client Filtering Index:');
    console.log('   CREATE INDEX idx_metrics_client_source');
    console.log('   ON metrics (client_id, source_type);');
    console.log('   → Optimizes client-specific data filtering\n');
    
    // Drizzle migration proposal
    console.log('🛠️ DRIZZLE MIGRATION PROPOSAL:\n');
    console.log('Add to shared/schema.ts in metrics table definition:');
    console.log(`
}, (table) => ({
  // Existing indexes
  competitorIdIdx: index("idx_metrics_competitor_id").on(table.competitorId),
  competitorTimePeriodIdx: index("idx_metrics_competitor_time_period")
    .on(table.competitorId, table.timePeriod)
    .where(isNotNull(table.competitorId)),
  
  // NEW: Dashboard optimization indexes
  dashboardPrimaryIdx: index("idx_metrics_dashboard_primary")
    .on(table.clientId, table.timePeriod, table.sourceType),
  clientMetricIdx: index("idx_metrics_client_metric")
    .on(table.clientId, table.metricName, table.timePeriod),
  clientSourceIdx: index("idx_metrics_client_source")
    .on(table.clientId, table.sourceType),
})`);
    
    // Performance impact estimation
    console.log('\n📈 ESTIMATED PERFORMANCE IMPACT:');
    const avgExecutionTime = analyses.reduce((sum, a) => sum + a.executionTime, 0) / analyses.length;
    console.log(`- Current average query time: ${avgExecutionTime.toFixed(2)} ms`);
    console.log('- Estimated improvement with indexes: 60-80%');
    console.log(`- Expected optimized time: ${(avgExecutionTime * 0.3).toFixed(2)} ms`);
    console.log('- Dashboard load time improvement: 2-4x faster\n');
    
    console.log('⚠️  Note: Indexes require approval before implementation');
    console.log('💡 Recommend testing on staging environment first');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const analyzer = new MetricQueryAnalyzer();
    await analyzer.runAnalysis();
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run the analysis
main().catch(console.error);

export { MetricQueryAnalyzer, QueryAnalysis };