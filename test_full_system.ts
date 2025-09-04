#!/usr/bin/env tsx
/**
 * Full system test with actual client and competitors
 */

import { storage } from './server/storage';
import logger from './server/utils/logging/logger';
import { promises as fs } from 'fs';
import path from 'path';

async function testFullSystem() {
  console.log('🚀 Full System Test with Client and Competitors\n');
  
  try {
    // Get demo client data
    const clients = await storage.getClients();
    const demoClient = clients.find(c => c.id === 'demo-client-id') || clients[0];
    
    if (!demoClient) {
      console.error('❌ No demo client found');
      return;
    }
    
    console.log(`📋 Using client: ${demoClient.name} (${demoClient.id})`);
    console.log(`🌐 Client website: ${demoClient.website}`);
    
    // Get competitors
    const competitors = await storage.getCompetitorsByClient(demoClient.id);
    console.log(`🏆 Found ${competitors.length} competitors:`);
    competitors.forEach((comp, i) => {
      console.log(`  ${i + 1}. ${comp.name} - ${comp.website}`);
    });
    
    console.log('\n🎯 Starting effectiveness analysis...');
    
    // Make API call to start analysis (using refresh endpoint)
    const analysisResponse = await fetch(`http://localhost:3001/api/effectiveness/refresh/${demoClient.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        force: true
      })
    });
    
    if (!analysisResponse.ok) {
      const error = await analysisResponse.text();
      throw new Error(`Analysis API failed: ${analysisResponse.status} - ${error}`);
    }
    
    const result = await analysisResponse.json();
    console.log('\n📊 Analysis Results:');
    console.log(`✅ Run ID: ${result.runId}`);
    console.log(`✅ Status: ${result.status}`);
    
    // Wait for completion and monitor progress
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    let run;
    
    while (attempts < maxAttempts) {
      run = await storage.getEffectivenessRun(result.runId);
      console.log(`📈 Status: ${run.status} | Progress: ${run.progress || 'Starting...'}`);
      
      if (run.status === 'completed' || run.status === 'failed') {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }
    
    if (run?.status !== 'completed') {
      throw new Error(`Analysis did not complete. Final status: ${run?.status}`);
    }
    
    console.log('\n🎉 Analysis completed! Verifying results...\n');
    
    // Get all criterion scores for this run
    const allScores = await storage.getCriterionScores(result.runId);
    
    // Group scores by entity
    const clientScores = allScores.filter(s => !s.competitorId);
    const competitorScoresMap = new Map();
    
    allScores.filter(s => s.competitorId).forEach(score => {
      if (!competitorScoresMap.has(score.competitorId)) {
        competitorScoresMap.set(score.competitorId, []);
      }
      competitorScoresMap.get(score.competitorId).push(score);
    });
    
    // Verify client scoring
    console.log(`🏢 CLIENT: ${demoClient.name}`);
    console.log(`   Criteria scored: ${clientScores.length}/8`);
    console.log(`   Overall score: ${run.overallScore}`);
    
    const expectedCriteria = ['ux', 'trust', 'accessibility', 'seo', 'positioning', 'brand_story', 'ctas', 'speed'];
    const clientCriteria = clientScores.map(s => s.criterion);
    const missingClient = expectedCriteria.filter(c => !clientCriteria.includes(c));
    
    if (missingClient.length > 0) {
      console.log(`   ❌ Missing criteria: ${missingClient.join(', ')}`);
    } else {
      console.log(`   ✅ All 8 criteria scored`);
    }
    
    // Verify competitor scoring
    console.log(`\n🏆 COMPETITORS:`);
    for (const competitor of competitors) {
      const scores = competitorScoresMap.get(competitor.id) || [];
      console.log(`   ${competitor.name}: ${scores.length}/8 criteria`);
      
      const compCriteria = scores.map(s => s.criterion);
      const missingComp = expectedCriteria.filter(c => !compCriteria.includes(c));
      
      if (missingComp.length > 0) {
        console.log(`     ❌ Missing: ${missingComp.join(', ')}`);
      } else {
        console.log(`     ✅ All 8 criteria scored`);
      }
    }
    
    // Check screenshot files
    console.log(`\n📸 SCREENSHOTS VERIFICATION:`);
    const uploadDir = path.join(process.cwd(), 'uploads', 'screenshots');
    
    try {
      const files = await fs.readdir(uploadDir);
      const recentFiles = [];
      
      // Get files from last 10 minutes
      const cutoffTime = Date.now() - (10 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() > cutoffTime) {
          recentFiles.push({ file, size: stats.size, modified: stats.mtime });
        }
      }
      
      console.log(`   Recent screenshot files (last 10 min): ${recentFiles.length}`);
      console.log(`   Expected: ${(competitors.length + 1) * 2} (2 per entity: above-fold + full-page)`);
      
      // Group by type
      const aboveFold = recentFiles.filter(f => f.file.startsWith('screenshot_'));
      const fullPage = recentFiles.filter(f => f.file.startsWith('fullpage_'));
      
      console.log(`   Above-fold screenshots: ${aboveFold.length}`);
      console.log(`   Full-page screenshots: ${fullPage.length}`);
      
      if (recentFiles.length >= (competitors.length + 1) * 2) {
        console.log(`   ✅ Screenshot count verification passed`);
      } else {
        console.log(`   ⚠️  Screenshot count lower than expected`);
      }
      
      // Show file details
      recentFiles.forEach(f => {
        console.log(`     ${f.file} (${(f.size / 1024).toFixed(1)}KB) - ${f.modified.toISOString()}`);
      });
      
    } catch (error) {
      console.log(`   ❌ Could not verify screenshots: ${error.message}`);
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`✅ Total entities tested: ${competitors.length + 1} (1 client + ${competitors.length} competitors)`);
    console.log(`✅ Total criteria scored: ${allScores.length}/${(competitors.length + 1) * 8}`);
    console.log(`✅ Analysis duration: ${run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime() : 'N/A'}ms`);
    console.log(`✅ Run status: ${run.status}`);
    
  } catch (error) {
    console.error('❌ Full system test failed:', error);
    
    // Additional debugging info
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure the server is running on port 3001');
    }
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testFullSystem().then(() => {
    console.log('\n🏁 Full system test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}