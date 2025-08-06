#!/usr/bin/env node

/**
 * Test SEMrush API with a known working period to understand the difference
 */

const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY;

if (!SEMRUSH_API_KEY) {
  console.error('❌ SEMRUSH_API_KEY not found');
  process.exit(1);
}

async function testWorkingPeriod() {
  console.log('🔍 Testing SEMrush API with known working periods');
  console.log('='.repeat(50));
  
  const baseUrl = 'https://api.semrush.com/analytics/v1';
  const testDomain = 'liquidagency.com';
  
  // Test both June 2025 (problematic) and April 2025 (has mobile data in DB)
  const periods = ['2025-06', '2025-04'];
  
  for (const period of periods) {
    console.log(`\n📅 Testing period: ${period}`);
    console.log('-'.repeat(30));
    
    const [year, month] = period.split('-');
    const displayDate = `${year}-${month}-01`;
    
    console.log(`  📝 Converted date: ${displayDate}`);
    
    for (const deviceType of ['desktop', 'mobile']) {
      try {
        const params = new URLSearchParams({
          key: SEMRUSH_API_KEY,
          targets: testDomain,
          export_columns: 'target,visits',
          display_date: displayDate,
          device_type: deviceType
        });
        
        const url = `${baseUrl}/summary?${params}`;
        console.log(`  🌐 ${deviceType}: ${url.substring(0, 100)}...`);
        
        const response = await fetch(url);
        console.log(`  📊 ${deviceType}: HTTP ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`  📝 ${deviceType} response:`, text.substring(0, 150));
          
          if (!text.includes('ERROR')) {
            const lines = text.trim().split('\n');
            if (lines.length >= 2) {
              const data = lines[1].split(';');
              const visits = parseInt(data[1]) || 0;
              console.log(`  ✅ ${deviceType}: ${visits} visits`);
            }
          } else {
            console.log(`  ⚠️ ${deviceType}: API returned ERROR - ${text.trim()}`);
          }
        }
        
      } catch (error) {
        console.log(`  💥 ${deviceType}: Error - ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Current date:', new Date().toISOString());
  console.log('🎯 Analysis: If June 2025 fails but April 2025 works, it suggests:');
  console.log('   1. June 2025 data not available in SEMrush yet');
  console.log('   2. Future date handling issue');
  console.log('   3. API endpoint or authentication change');
}

testWorkingPeriod().catch(console.error);