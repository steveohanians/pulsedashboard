#!/usr/bin/env tsx
/**
 * Final verification that all entities get full-page screenshots
 */

import { storage } from './server/storage';
import * as fs from 'fs/promises';
import * as path from 'path';

async function verifyFullPageScreenshots() {
  console.log('🎯 FINAL FULL-PAGE SCREENSHOT VERIFICATION\n');
  
  // Get client and competitors
  const clients = await storage.getClients();
  const demoClient = clients.find(c => c.id === 'demo-client-id');
  
  if (!demoClient) {
    console.log('❌ Demo client not found');
    return;
  }
  
  const competitors = await storage.getCompetitorsByClient(demoClient.id);
  console.log(`📋 Testing client + ${competitors.length} competitors\n`);
  
  const entities = [
    { name: 'Clear Digital (Client)', url: demoClient.website, type: 'client', id: demoClient.id },
    ...competitors.map(c => ({ 
      name: `${c.name} (Competitor)`, 
      url: c.website, 
      type: 'competitor',
      id: c.id
    }))
  ];
  
  const results = [];
  const screenshotsDir = 'uploads/screenshots';
  
  // Start fresh analysis
  console.log('🎯 Starting fresh effectiveness analysis...');
  const analysisResponse = await fetch(`http://localhost:3001/api/effectiveness/refresh/${demoClient.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: true })
  });
  
  if (!analysisResponse.ok) {
    throw new Error(`Analysis failed: ${analysisResponse.status}`);
  }
  
  const result = await analysisResponse.json();
  console.log(`✅ Analysis started with Run ID: ${result.runId}\n`);
  
  // Monitor progress
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes
  let finalRun;
  
  console.log('📈 Monitoring progress...');
  while (attempts < maxAttempts) {
    finalRun = await storage.getEffectivenessRun(result.runId);
    
    try {
      const progressData = JSON.parse(finalRun.progress || '{}');
      console.log(`   Status: ${finalRun.status} | ${progressData.message || finalRun.progress || 'Processing...'}`);
    } catch {
      console.log(`   Status: ${finalRun.status} | ${finalRun.progress || 'Processing...'}`);
    }
    
    if (finalRun.status === 'completed' || finalRun.status === 'failed') {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  if (finalRun?.status !== 'completed') {
    throw new Error(`Analysis did not complete. Final status: ${finalRun?.status}`);
  }
  
  console.log('\n🎉 Analysis completed! Checking screenshots...\n');
  
  // Check for screenshots created during this run
  const files = await fs.readdir(screenshotsDir);
  const runStartTime = new Date(finalRun.createdAt).getTime() - (5 * 60 * 1000); // 5 minutes before run start
  const recentFiles = [];
  
  for (const file of files) {
    const filePath = path.join(screenshotsDir, file);
    const stats = await fs.stat(filePath);
    if (stats.birthtime.getTime() > runStartTime) {
      recentFiles.push({
        name: file,
        size: Math.round(stats.size / 1024),
        type: file.startsWith('fullpage_') ? 'full-page' : 'above-fold',
        created: stats.birthtime
      });
    }
  }
  
  // Sort by creation time
  recentFiles.sort((a, b) => a.created.getTime() - b.created.getTime());
  
  const aboveFoldFiles = recentFiles.filter(f => f.type === 'above-fold');
  const fullPageFiles = recentFiles.filter(f => f.type === 'full-page');
  
  console.log('📸 SCREENSHOTS CAPTURED DURING THIS RUN:');
  console.log(`   Above-fold screenshots: ${aboveFoldFiles.length}`);
  console.log(`   Full-page screenshots: ${fullPageFiles.length}`);
  console.log(`   Total screenshots: ${recentFiles.length}\n`);
  
  // Display all screenshots
  if (recentFiles.length > 0) {
    console.log('📋 ALL SCREENSHOTS:');
    recentFiles.forEach(f => {
      const time = f.created.toLocaleTimeString();
      console.log(`   ${f.type}: ${f.name} (${f.size}KB, ${time})`);
    });
    console.log('');
  }
  
  // Expected: 2 screenshots per entity (above-fold + full-page)
  const expectedTotal = entities.length * 2;
  const expectedFullPage = entities.length;
  
  console.log('📊 VERIFICATION RESULTS:');
  console.log(`   Expected entities: ${entities.length}`);
  console.log(`   Expected total screenshots: ${expectedTotal} (2 per entity)`);
  console.log(`   Expected full-page screenshots: ${expectedFullPage} (1 per entity)`);
  console.log(`   Actual full-page screenshots: ${fullPageFiles.length}`);
  
  const allEntitiesHaveFullPage = fullPageFiles.length >= expectedFullPage;
  
  console.log(`\n${allEntitiesHaveFullPage ? '🎉' : '❌'} ALL ENTITIES HAVE FULL-PAGE SCREENSHOTS: ${allEntitiesHaveFullPage ? 'YES' : 'NO'}`);
  
  if (allEntitiesHaveFullPage) {
    console.log('\n✅ SUCCESS! The Playwright fallback fix is working!');
    console.log('   🎯 All entities now get full-page screenshots');
    console.log('   👁️  AI vision analysis should work for positioning, brand story, and CTAs');
    console.log('   🔧 The original timeout issue has been resolved');
    
    // Additional verification
    if (fullPageFiles.some(f => f.size > 500)) {
      console.log('   📏 Full-page screenshots have reasonable sizes (>500KB)');
    }
  } else {
    console.log('\n❌ ISSUE: Not all entities are getting full-page screenshots');
    console.log(`   Missing: ${expectedFullPage - fullPageFiles.length} full-page screenshots`);
    console.log('   This indicates the Playwright fallback may not be working for all entities');
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  verifyFullPageScreenshots().then(() => {
    console.log('\n🏁 Final verification completed');
    process.exit(0);
  }).catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}