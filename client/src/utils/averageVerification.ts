/**
 * Averaging Verification Utility
 * Temporary utility to verify portfolio and benchmark averaging calculations
 */

export function verifyAverages(metrics: any[], companies: any[], type: 'CD_Portfolio' | 'Benchmark') {
  console.log(`\n========== AVERAGING VERIFICATION FOR ${type} ==========`);
  
  // Group metrics by metric name
  const metricGroups: Record<string, any[]> = {};
  
  metrics.forEach(metric => {
    if (!metricGroups[metric.metricName]) {
      metricGroups[metric.metricName] = [];
    }
    metricGroups[metric.metricName].push(metric);
  });
  
  // For each metric type, calculate the average
  Object.keys(metricGroups).forEach(metricName => {
    const metricsForType = metricGroups[metricName];
    
    console.log(`\n📊 Metric: ${metricName}`);
    console.log(`   Companies in ${type}: ${companies.length}`);
    
    // Find all individual company values
    const companyValues: Record<string, number> = {};
    
    companies.forEach(company => {
      const companyMetrics = metricsForType.filter(m => {
        if (type === 'CD_Portfolio') {
          return m.sourceType === 'CD_Portfolio' && m.cdPortfolioCompanyId === company.id;
        } else {
          return m.sourceType === 'Benchmark' && m.benchmarkCompanyId === company.id;
        }
      });
      
      if (companyMetrics.length > 0) {
        // Average if multiple values for same company
        const sum = companyMetrics.reduce((acc, m) => acc + parseFloat(m.value), 0);
        const avg = sum / companyMetrics.length;
        companyValues[company.name || company.domain] = avg;
        console.log(`   - ${company.name || company.domain}: ${avg.toFixed(2)}`);
      } else {
        console.log(`   - ${company.name || company.domain}: NO DATA`);
      }
    });
    
    // Calculate the average
    const validValues = Object.values(companyValues);
    if (validValues.length > 0) {
      const totalSum = validValues.reduce((acc, val) => acc + val, 0);
      const average = totalSum / validValues.length;
      
      console.log(`   📈 CALCULATED AVERAGE: ${average.toFixed(2)}`);
      console.log(`   📈 Based on ${validValues.length} companies with data`);
      
      // Find what the system currently shows
      const systemAvg = metricsForType.find(m => 
        m.sourceType === (type === 'CD_Portfolio' ? 'CD_Avg' : 'Industry_Avg')
      );
      
      if (systemAvg) {
        console.log(`   📈 SYSTEM SHOWS: ${parseFloat(systemAvg.value).toFixed(2)}`);
        const difference = Math.abs(average - parseFloat(systemAvg.value));
        if (difference > 0.01) {
          console.log(`   ❌ MISMATCH: Difference of ${difference.toFixed(2)}`);
        } else {
          console.log(`   ✅ MATCH: Averages are correct`);
        }
      } else {
        console.log(`   ⚠️ SYSTEM AVERAGE NOT FOUND`);
      }
    } else {
      console.log(`   ❌ No valid data to calculate average`);
    }
  });
  
  console.log(`\n========== END VERIFICATION ==========\n`);
}

/**
 * Standardized averaging function for both CD Portfolio and Benchmark
 */
export function calculateStandardAverage(
  metrics: any[],
  companies: any[],
  metricName: string,
  type: 'CD_Portfolio' | 'Benchmark'
): number | null {
  
  const companyValues: number[] = [];
  
  companies.forEach(company => {
    const companyMetrics = metrics.filter(m => {
      if (type === 'CD_Portfolio') {
        return m.metricName === metricName && 
               m.sourceType === 'CD_Portfolio' && 
               m.cdPortfolioCompanyId === company.id;
      } else {
        return m.metricName === metricName && 
               m.sourceType === 'Benchmark' && 
               m.benchmarkCompanyId === company.id;
      }
    });
    
    if (companyMetrics.length > 0) {
      // Average multiple values for same company
      const sum = companyMetrics.reduce((acc, m) => acc + parseFloat(m.value), 0);
      const avg = sum / companyMetrics.length;
      companyValues.push(avg);
    }
  });
  
  // Calculate average only if we have data
  if (companyValues.length > 0) {
    const totalSum = companyValues.reduce((acc, val) => acc + val, 0);
    return totalSum / companyValues.length;
  }
  
  return null;
}