#!/usr/bin/env node

// Bulletproof 15-Month Sample Data Generation Script
// This script creates comprehensive sample data with proper trend patterns

const { execSync } = require('child_process');

// Helper function to execute SQL directly
function executeSQL(query) {
  try {
    const result = execSync(`psql ${process.env.DATABASE_URL} -c "${query.replace(/"/g, '\\"')}"`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result;
  } catch (error) {
    console.error('SQL Error:', error.message);
    return null;
  }
}

// Generate periods for 15 months (April 2024 to July 2025)
function generatePeriods() {
  const periods = [];
  const now = new Date();
  
  // Start from 15 months ago
  for (let i = 14; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    periods.push(period);
  }
  
  return periods;
}

// Generate metric value with trends
function generateMetricValue(metricName, sourceType, monthIndex, totalMonths, competitorSeed = 0.5) {
  const baseValues = {
    'Bounce Rate': 35,
    'Session Duration': 187,
    'Pages per Session': 2.4,
    'Sessions per User': 1.8
  };
  
  const base = baseValues[metricName] || 100;
  const trendProgress = monthIndex / (totalMonths - 1);
  
  let trendMultiplier = 1;
  let baseMultiplier = 1;
  let variance = 0.1;
  
  switch (sourceType) {
    case 'Client':
      if (metricName === 'Bounce Rate') {
        trendMultiplier = 1 - (trendProgress * 0.15); // Improving bounce rate
        baseMultiplier = 1;
        variance = 0.03;
      } else {
        trendMultiplier = 1 + (trendProgress * 0.12); // Improving other metrics
        baseMultiplier = 1;
        variance = 0.03;
      }
      break;
      
    case 'Competitor':
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 0.8 + (competitorSeed * 0.4);
        trendMultiplier = 1 - (trendProgress * 0.08);
      } else {
        baseMultiplier = 0.85 + (competitorSeed * 0.3);
        trendMultiplier = 1 + (trendProgress * 0.08);
      }
      variance = 0.12;
      break;
      
    case 'Industry_Avg':
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 1.15;
        trendMultiplier = 1 - (trendProgress * 0.05);
      } else {
        baseMultiplier = 0.92;
        trendMultiplier = 1 + (trendProgress * 0.06);
      }
      variance = 0.08;
      break;
      
    case 'CD_Avg':
      if (metricName === 'Bounce Rate') {
        baseMultiplier = 0.85;
        trendMultiplier = 1 - (trendProgress * 0.10);
      } else {
        baseMultiplier = 1.08;
        trendMultiplier = 1 + (trendProgress * 0.10);
      }
      variance = 0.06;
      break;
  }
  
  const seasonalVariation = Math.sin((monthIndex / 3) * Math.PI * 2) * 0.05;
  const adjustedBase = base * baseMultiplier * trendMultiplier * (1 + seasonalVariation);
  const randomVariation = (Math.random() - 0.5) * 2 * variance;
  const finalValue = adjustedBase * (1 + randomVariation);
  
  if (metricName === 'Bounce Rate') {
    return Math.max(15, Math.min(85, finalValue)).toFixed(1);
  } else if (metricName === 'Pages per Session' || metricName === 'Sessions per User') {
    return Math.max(1.2, finalValue).toFixed(2);
  } else if (metricName === 'Session Duration') {
    return Math.max(45, Math.round(finalValue)).toString();
  }
  
  return Math.max(0, Math.round(finalValue)).toString();
}

// Main generation function
function generateBulletproofSampleData() {
  console.log('🚀 Starting bulletproof 15-month sample data generation...');
  
  // Clear existing data
  console.log('🧹 Clearing existing sample data...');
  executeSQL("DELETE FROM metrics WHERE client_id = 'demo-client-id' AND source_type IN ('Client', 'Competitor');");
  executeSQL("DELETE FROM benchmarks WHERE source_type IN ('Industry_Avg', 'CD_Avg');");
  
  // Get competitors
  const competitorsResult = executeSQL("SELECT id, domain FROM competitors WHERE client_id = 'demo-client-id';");
  const competitorIds = ['db818078-1ae6-4cad-945e-e5c70360ba57', '17e9f754-7610-4a11-8162-2cc07f77e204'];
  
  const periods = generatePeriods();
  const metrics = ['Bounce Rate', 'Session Duration', 'Pages per Session', 'Sessions per User'];
  
  console.log(`📅 Generating data for ${periods.length} periods: ${periods[0]} to ${periods[periods.length-1]}`);
  
  let totalMetricsCreated = 0;
  
  // Generate for each period
  periods.forEach((period, periodIndex) => {
    console.log(`⏳ Processing period ${period} (${periodIndex + 1}/${periods.length})`);
    
    // 1. Client metrics (skip for GA4 demo client)
    if (period !== '2025-05' && period !== '2025-06' && period !== '2025-07') {
      metrics.forEach(metricName => {
        const value = generateMetricValue(metricName, 'Client', periodIndex, periods.length);
        const query = `INSERT INTO metrics (id, client_id, metric_name, value, source_type, time_period, created_at) VALUES (gen_random_uuid(), 'demo-client-id', '${metricName}', '${value}', 'Client', '${period}', NOW());`;
        executeSQL(query);
        totalMetricsCreated++;
      });
    }
    
    // 2. Competitor metrics
    competitorIds.forEach((competitorId, compIndex) => {
      const competitorSeed = compIndex / competitorIds.length;
      metrics.forEach(metricName => {
        const value = generateMetricValue(metricName, 'Competitor', periodIndex, periods.length, competitorSeed);
        const query = `INSERT INTO metrics (id, client_id, competitor_id, metric_name, value, source_type, time_period, created_at) VALUES (gen_random_uuid(), 'demo-client-id', '${competitorId}', '${metricName}', '${value}', 'Competitor', '${period}', NOW());`;
        executeSQL(query);
        totalMetricsCreated++;
      });
    });
    
    // 3. Industry Average metrics
    metrics.forEach(metricName => {
      const value = generateMetricValue(metricName, 'Industry_Avg', periodIndex, periods.length);
      const query = `INSERT INTO benchmarks (id, metric_name, value, source_type, time_period, business_size, industry_vertical, created_at) VALUES (gen_random_uuid(), '${metricName}', '${value}', 'Industry_Avg', '${period}', 'All', 'All', NOW());`;
      executeSQL(query);
      totalMetricsCreated++;
    });
    
    // 4. CD Portfolio Average metrics
    metrics.forEach(metricName => {
      const value = generateMetricValue(metricName, 'CD_Avg', periodIndex, periods.length);
      const query = `INSERT INTO benchmarks (id, metric_name, value, source_type, time_period, business_size, industry_vertical, created_at) VALUES (gen_random_uuid(), '${metricName}', '${value}', 'CD_Avg', '${period}', 'All', 'All', NOW());`;
      executeSQL(query);
      totalMetricsCreated++;
    });
  });
  
  console.log(`✅ Bulletproof sample data generation complete!`);
  console.log(`📊 Created ${totalMetricsCreated} metrics across ${periods.length} periods`);
  console.log(`🏢 Entities: Client, 2 Competitors, Industry_Avg, CD_Avg`);
  console.log(`📈 Trends: Client improving, Competitors varied, Benchmarks steady`);
  
  // Verification
  const verification = executeSQL(`
    SELECT 
      source_type,
      COUNT(*) as metric_count,
      COUNT(DISTINCT time_period) as periods_covered
    FROM (
      SELECT source_type, time_period FROM metrics WHERE client_id = 'demo-client-id'
      UNION ALL
      SELECT source_type, time_period FROM benchmarks
    ) all_data
    GROUP BY source_type
    ORDER BY source_type;
  `);
  
  console.log('🔍 Verification Results:');
  console.log(verification);
}

// Run the generation
generateBulletproofSampleData();