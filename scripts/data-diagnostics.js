#!/usr/bin/env node
/**
 * Data Diagnostics Script
 * Analyzes database state and validates data integrity
 */

import { db } from '../server/db.js';
import { clients, metrics, ga4PropertyAccess, ga4ServiceAccounts } from '../shared/schema.js';
import { eq, desc, count, sql } from 'drizzle-orm';

class DataDiagnostics {
  async checkSchema() {
    console.log('🔍 Checking database schema...');
    
    try {
      // Check metrics table structure
      const metricsSchema = await db.execute(sql`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'metrics' 
        ORDER BY ordinal_position
      `);
      
      console.log('📊 Metrics table structure:');
      metricsSchema.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });

      // Check source_type enum values
      const sourceTypes = await db.execute(sql`
        SELECT unnest(enum_range(NULL::source_type)) as source_type
      `);
      
      console.log('🏷️  Available source_type values:');
      sourceTypes.rows.forEach(row => {
        console.log(`  - ${row.source_type}`);
      });

    } catch (error) {
      console.error('❌ Schema check failed:', error);
    }
  }

  async checkClientsData() {
    console.log('\n👥 Checking clients data...');
    
    try {
      const clientsData = await db.select({
        id: clients.id,
        name: clients.name,
        websiteUrl: clients.websiteUrl,
        industryVertical: clients.industryVertical,
        businessSize: clients.businessSize
      }).from(clients);

      console.log(`📈 Found ${clientsData.length} clients:`);
      clientsData.forEach(client => {
        console.log(`  ${client.id}: ${client.name} (${client.industryVertical}, ${client.businessSize})`);
      });

      return clientsData;
    } catch (error) {
      console.error('❌ Clients check failed:', error);
      return [];
    }
  }

  async checkGA4PropertyAccess() {
    console.log('\n🔗 Checking GA4 property access...');
    
    try {
      const propertyAccess = await db.select({
        id: ga4PropertyAccess.id,
        clientId: ga4PropertyAccess.clientId,
        propertyId: ga4PropertyAccess.propertyId,
        propertyName: ga4PropertyAccess.propertyName,
        accessVerified: ga4PropertyAccess.accessVerified,
        syncStatus: ga4PropertyAccess.syncStatus,
        lastVerified: ga4PropertyAccess.lastVerified,
        lastDataSync: ga4PropertyAccess.lastDataSync
      }).from(ga4PropertyAccess);

      console.log(`🔑 Found ${propertyAccess.length} property access records:`);
      propertyAccess.forEach(access => {
        console.log(`  Client: ${access.clientId}`);
        console.log(`    Property ID: ${access.propertyId}`);
        console.log(`    Property Name: ${access.propertyName || 'Not set'}`);
        console.log(`    Verified: ${access.accessVerified ? '✓' : '✗'}`);
        console.log(`    Status: ${access.syncStatus}`);
        console.log(`    Last Verified: ${access.lastVerified || 'Never'}`);
        console.log(`    Last Sync: ${access.lastDataSync || 'Never'}`);
        console.log('');
      });

      return propertyAccess;
    } catch (error) {
      console.error('❌ GA4 property access check failed:', error);
      return [];
    }
  }

  async checkMetricsData(clientId = null) {
    console.log('\n📊 Checking metrics data...');
    
    try {
      let query = db.select({
        clientId: metrics.clientId,
        competitorId: metrics.competitorId,
        metricName: metrics.metricName,
        sourceType: metrics.sourceType,
        timePeriod: metrics.timePeriod,
        value: metrics.value,
        createdAt: metrics.createdAt
      }).from(metrics);

      if (clientId) {
        query = query.where(eq(metrics.clientId, clientId));
      }

      const metricsData = await query
        .orderBy(desc(metrics.createdAt), desc(metrics.timePeriod))
        .limit(20);

      console.log(`📈 Found ${metricsData.length} recent metrics records${clientId ? ` for client ${clientId}` : ''}:`);
      
      // Group by client and source type
      const grouped = {};
      metricsData.forEach(metric => {
        const key = `${metric.clientId}-${metric.sourceType}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(metric);
      });

      Object.entries(grouped).forEach(([key, records]) => {
        const [clientId, sourceType] = key.split('-');
        console.log(`\n  Client: ${clientId} (${sourceType}):`);
        
        const byMetric = {};
        records.forEach(record => {
          if (!byMetric[record.metricName]) {
            byMetric[record.metricName] = [];
          }
          byMetric[record.metricName].push(record);
        });

        Object.entries(byMetric).forEach(([metricName, metricRecords]) => {
          console.log(`    ${metricName}:`);
          metricRecords.slice(0, 3).forEach(record => {
            const value = typeof record.value === 'string' ? 
              record.value.slice(0, 100) + '...' : 
              JSON.stringify(record.value).slice(0, 100);
            console.log(`      ${record.timePeriod}: ${value}`);
          });
        });
      });

      return metricsData;
    } catch (error) {
      console.error('❌ Metrics check failed:', error);
      return [];
    }
  }

  async checkDataFreshness(clientId) {
    console.log(`\n⏰ Checking data freshness for client: ${clientId}...`);
    
    try {
      const freshness = await db.select({
        metricName: metrics.metricName,
        sourceType: metrics.sourceType,
        latestPeriod: sql`MAX(${metrics.timePeriod})`.as('latestPeriod'),
        recordCount: count().as('recordCount'),
        lastUpdated: sql`MAX(${metrics.createdAt})`.as('lastUpdated')
      })
      .from(metrics)
      .where(eq(metrics.clientId, clientId))
      .groupBy(metrics.metricName, metrics.sourceType)
      .orderBy(metrics.metricName, metrics.sourceType);

      console.log('📅 Data freshness summary:');
      freshness.forEach(item => {
        console.log(`  ${item.metricName} (${item.sourceType}):`);
        console.log(`    Latest Period: ${item.latestPeriod}`);
        console.log(`    Records: ${item.recordCount}`);
        console.log(`    Last Updated: ${item.lastUpdated}`);
        console.log('');
      });

      return freshness;
    } catch (error) {
      console.error('❌ Data freshness check failed:', error);
      return [];
    }
  }

  async runFullDiagnostics(clientId = 'demo-client-id') {
    console.log('🚀 Running full data diagnostics...\n');
    
    await this.checkSchema();
    const clients = await this.checkClientsData();
    const propertyAccess = await this.checkGA4PropertyAccess();
    const metrics = await this.checkMetricsData(clientId);
    const freshness = await this.checkDataFreshness(clientId);
    
    console.log('\n✅ Diagnostics complete!');
    
    return {
      clients,
      propertyAccess,
      metrics,
      freshness
    };
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  const clientId = args[1] || 'demo-client-id';

  const diagnostics = new DataDiagnostics();

  try {
    switch (command) {
      case 'schema':
        await diagnostics.checkSchema();
        break;
      case 'clients':
        await diagnostics.checkClientsData();
        break;
      case 'properties':
        await diagnostics.checkGA4PropertyAccess();
        break;
      case 'metrics':
        await diagnostics.checkMetricsData(clientId);
        break;
      case 'freshness':
        await diagnostics.checkDataFreshness(clientId);
        break;
      case 'full':
      default:
        await diagnostics.runFullDiagnostics(clientId);
        break;
    }
  } catch (error) {
    console.error('❌ Diagnostics failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DataDiagnostics };