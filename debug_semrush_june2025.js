#!/usr/bin/env node

/**
 * Debug script to investigate SEMrush mobile data missing for June 2025
 * This will test the actual SEMrush API calls for June 2025 period
 */

const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY;

if (!SEMRUSH_API_KEY) {
  console.error('❌ SEMRUSH_API_KEY not found in environment variables');
  process.exit(1);
}

// Test domains from our competitors
const testDomains = [
  'liquidagency.com',
  'powershifter.com', 
  'https://baunfire.com'
];

const period = '2025-06'; // June 2025 - the problematic period

async function debugSemrushDeviceData() {
  console.log('🔍 DEBUG: SEMrush June 2025 Mobile Data Investigation');
  console.log('=' .repeat(60));
  
  const baseUrl = 'https://api.semrush.com/analytics/v1';
  
  for (const domain of testDomains) {
    console.log(`\n📊 Testing domain: ${domain}`);
    console.log('-'.repeat(40));
    
    // Convert period to SEMrush date format
    const [year, month] = period.split('-');
    const displayDate = `${year}-${month}-01`;
    
    const deviceTypes = ['desktop', 'mobile'];
    const deviceResults = [];
    
    for (const deviceType of deviceTypes) {
      try {
        const params = new URLSearchParams({
          key: SEMRUSH_API_KEY,
          targets: domain,
          export_columns: 'target,visits',
          display_date: displayDate,
          device_type: deviceType
        });
        
        const url = `${baseUrl}/summary?${params}`;
        console.log(`  🌐 Fetching ${deviceType} data...`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.log(`  ❌ ${deviceType}: HTTP ${response.status} ${response.statusText}`);
          continue;
        }
        
        const text = await response.text();
        console.log(`  📝 ${deviceType} response (first 200 chars):`, text.substring(0, 200));
        
        if (text.includes('ERROR')) {
          console.log(`  ⚠️  ${deviceType}: SEMrush API error - ${text.trim()}`);
          continue;
        }
        
        const lines = text.trim().split('\n');
        if (lines.length >= 2) {
          const data = lines[1].split(';');
          const visits = parseInt(data[1]) || 0;
          
          console.log(`  ✅ ${deviceType}: ${visits} sessions`);
          
          if (visits > 0) {
            deviceResults.push({
              device: deviceType === 'desktop' ? 'Desktop' : 'Mobile',
              sessions: visits,
              percentage: 0
            });
          } else {
            console.log(`  🚫 ${deviceType}: 0 sessions (filtered out by logic)`);
          }
        } else {
          console.log(`  ⚠️  ${deviceType}: Invalid response format - expected at least 2 lines, got ${lines.length}`);
        }
        
      } catch (error) {
        console.log(`  💥 ${deviceType}: Fetch failed -`, error.message);
      }
    }
    
    // Calculate final percentages (same logic as semrushService.ts)
    const totalSessions = deviceResults.reduce((sum, device) => sum + device.sessions, 0);
    
    if (totalSessions > 0) {
      deviceResults.forEach(device => {
        device.percentage = (device.sessions / totalSessions) * 100;
      });
      
      console.log(`\n  📊 FINAL RESULTS for ${domain}:`);
      console.log(`     Total sessions: ${totalSessions}`);
      deviceResults.forEach(device => {
        console.log(`     ${device.device}: ${device.sessions} sessions (${device.percentage.toFixed(1)}%)`);
      });
      
      console.log(`\n  💾 WHAT GETS STORED:`);
      deviceResults.forEach(device => {
        if (device.percentage > 0) {
          console.log(`     ✅ ${device.device}: ${device.percentage.toFixed(1)}% - STORED`);
        } else {
          console.log(`     ❌ ${device.device}: ${device.percentage.toFixed(1)}% - FILTERED OUT`);
        }
      });
    } else {
      console.log(`\n  ⚠️  No valid session data found for ${domain} in ${period}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 CONCLUSION:');
  console.log('If you see only Desktop data with 100%, it means:');
  console.log('1. SEMrush returned sessions > 0 for desktop');  
  console.log('2. SEMrush returned sessions = 0 for mobile (or mobile call failed)');
  console.log('3. Our logic filtered out mobile because percentage = 0');
  console.log('4. Desktop got 100% because it was the only device with sessions');
}

// Run the debug
debugSemrushDeviceData().catch(console.error);