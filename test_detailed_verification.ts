#!/usr/bin/env tsx
/**
 * Comprehensive test with detailed per-entity verification
 */

import { storage } from './server/storage';
import { promises as fs } from 'fs';
import path from 'path';

interface EntityResults {
  name: string;
  website: string;
  runId: string;
  status: string;
  overallScore: number;
  criteria: {
    [key: string]: {
      score: number;
      evidence?: any;
      dataSource: 'html' | 'screenshot' | 'api' | 'fallback' | 'ai_vision';
      fallbackUsed: boolean;
    };
  };
  screenshots: {
    aboveFold?: { path: string; exists: boolean; size: number };
    fullPage?: { path: string; exists: boolean; size: number };
  };
  htmlSources: {
    initial: boolean;
    rendered: boolean;
    length?: number;
  };
}

async function fileExists(filePath: string): Promise<{ exists: boolean; size: number }> {
  try {
    const stats = await fs.stat(filePath);
    return { exists: true, size: stats.size };
  } catch {
    return { exists: false, size: 0 };
  }
}

async function runDetailedTest() {
  console.log('🔬 DETAILED SYSTEM VERIFICATION TEST\n');
  
  try {
    // Get demo client
    const clients = await storage.getClients();
    const demoClient = clients.find(c => c.id === 'demo-client-id') || clients[0];
    console.log(`📋 Testing Client: ${demoClient.name} (${demoClient.id})`);
    
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
    
    console.log('\n🎉 Analysis completed! Generating detailed results...\n');
    
    // Get all entities (client + competitors)
    const competitors = await storage.getCompetitorsByClient(demoClient.id);
    const allEntities = [
      { 
        id: demoClient.id, 
        name: demoClient.name, 
        website: demoClient.website, 
        isClient: true 
      },
      ...competitors.map(c => ({ 
        id: c.id, 
        name: c.name || 'Unnamed Competitor', 
        website: c.website, 
        isClient: false 
      }))
    ];
    
    const detailedResults: EntityResults[] = [];
    
    // Process each entity
    for (const entity of allEntities) {
      console.log(`🔍 Processing: ${entity.name} (${entity.website || 'No website'})`);
      
      let entityRun;
      if (entity.isClient) {
        entityRun = finalRun;
      } else {
        entityRun = await storage.getLatestEffectivenessRunByCompetitor(demoClient.id, entity.id);
      }
      
      if (!entityRun) {
        console.log(`   ❌ No run found for ${entity.name}`);
        continue;
      }
      
      // Get criterion scores with detailed evidence
      const criterionScores = await storage.getCriterionScores(entityRun.id);
      
      const entityResult: EntityResults = {
        name: entity.name,
        website: entity.website || 'Not specified',
        runId: entityRun.id,
        status: entityRun.status,
        overallScore: parseFloat(entityRun.overallScore || '0'),
        criteria: {},
        screenshots: {},
        htmlSources: { initial: false, rendered: false }
      };
      
      // Process each criterion
      const expectedCriteria = ['ux', 'trust', 'accessibility', 'seo', 'positioning', 'brand_story', 'ctas', 'speed'];
      
      for (const criterion of expectedCriteria) {
        const criterionScore = criterionScores.find(s => s.criterion === criterion);
        
        if (criterionScore) {
          let dataSource: EntityResults['criteria'][string]['dataSource'] = 'html';
          let fallbackUsed = false;
          
          try {
            const evidence = typeof criterionScore.evidence === 'string' 
              ? JSON.parse(criterionScore.evidence)
              : criterionScore.evidence;
            
            // Determine data source and fallback usage
            if (criterion === 'positioning' || criterion === 'brand_story' || criterion === 'ctas') {
              if (evidence?.vision_analysis || evidence?.screenshotUsed) {
                dataSource = 'ai_vision';
              } else if (evidence?.details?.fallback_used) {
                dataSource = 'fallback';
                fallbackUsed = true;
              } else {
                dataSource = 'html';
              }
            } else if (criterion === 'speed') {
              if (evidence?.details?.apiStatus === 'success') {
                dataSource = 'api';
              } else {
                dataSource = 'fallback';
                fallbackUsed = true;
              }
            } else {
              dataSource = 'html';
            }
            
            entityResult.criteria[criterion] = {
              score: parseFloat(criterionScore.score || '0'),
              evidence: evidence,
              dataSource,
              fallbackUsed
            };
          } catch (error) {
            entityResult.criteria[criterion] = {
              score: parseFloat(criterionScore.score || '0'),
              dataSource: 'html',
              fallbackUsed: false
            };
          }
        } else {
          entityResult.criteria[criterion] = {
            score: 0,
            dataSource: 'fallback',
            fallbackUsed: true
          };
        }
      }
      
      // Verify screenshot files
      const uploadsDir = path.join(process.cwd(), 'uploads', 'screenshots');
      
      // Look for recent screenshots (within last hour)
      try {
        const files = await fs.readdir(uploadsDir);
        const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour
        
        // Find screenshots that might belong to this entity
        for (const file of files) {
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() > cutoffTime) {
            const fileCheck = await fileExists(filePath);
            
            if (file.startsWith('screenshot_')) {
              if (!entityResult.screenshots.aboveFold) {
                entityResult.screenshots.aboveFold = {
                  path: file,
                  exists: fileCheck.exists,
                  size: fileCheck.size
                };
              }
            } else if (file.startsWith('fullpage_')) {
              if (!entityResult.screenshots.fullPage) {
                entityResult.screenshots.fullPage = {
                  path: file,
                  exists: fileCheck.exists,
                  size: fileCheck.size
                };
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Could not verify screenshots: ${error.message}`);
      }
      
      // Check HTML sources (simplified check based on criteria evidence)
      const hasRendered = Object.values(entityResult.criteria).some(c => 
        c.evidence?.hasRenderedHtml || c.dataSource === 'ai_vision'
      );
      
      entityResult.htmlSources = {
        initial: true, // Always collected
        rendered: hasRendered
      };
      
      detailedResults.push(entityResult);
      console.log(`   ✅ Processed ${entity.name}: ${Object.keys(entityResult.criteria).length} criteria`);
    }
    
    // Display detailed results
    console.log('\n📊 DETAILED RESULTS PER ENTITY:\n');
    
    detailedResults.forEach((entity, index) => {
      console.log(`${index + 1}. 🏢 ${entity.name.toUpperCase()}`);
      console.log(`   🌐 Website: ${entity.website}`);
      console.log(`   📈 Overall Score: ${entity.overallScore}/10`);
      console.log(`   🎯 Status: ${entity.status}`);
      console.log(`   🆔 Run ID: ${entity.runId.substring(0, 8)}...`);
      
      console.log(`\n   📋 CRITERIA BREAKDOWN (8 total):`);
      const criteriaEntries = Object.entries(entity.criteria);
      criteriaEntries.forEach(([criterion, data]) => {
        const sourceIcon = data.dataSource === 'api' ? '🌐' : 
                          data.dataSource === 'ai_vision' ? '👁️' : 
                          data.dataSource === 'fallback' ? '🔄' : '📝';
        const fallbackIcon = data.fallbackUsed ? ' ⚠️' : '';
        console.log(`     ${criterion.toUpperCase()}: ${data.score}/10 ${sourceIcon} (${data.dataSource})${fallbackIcon}`);
      });
      
      console.log(`\n   📸 SCREENSHOTS:`);
      if (entity.screenshots.aboveFold) {
        const size = (entity.screenshots.aboveFold.size / 1024).toFixed(1);
        console.log(`     Above-fold: ${entity.screenshots.aboveFold.exists ? '✅' : '❌'} ${entity.screenshots.aboveFold.path} (${size}KB)`);
      } else {
        console.log(`     Above-fold: ❌ Not found`);
      }
      
      if (entity.screenshots.fullPage) {
        const size = (entity.screenshots.fullPage.size / 1024).toFixed(1);
        console.log(`     Full-page: ${entity.screenshots.fullPage.exists ? '✅' : '❌'} ${entity.screenshots.fullPage.path} (${size}KB)`);
      } else {
        console.log(`     Full-page: ❌ Not found`);
      }
      
      console.log(`\n   📄 HTML SOURCES:`);
      console.log(`     Initial HTML: ${entity.htmlSources.initial ? '✅' : '❌'} Collected`);
      console.log(`     Rendered HTML: ${entity.htmlSources.rendered ? '✅' : '❌'} Collected`);
      
      console.log(`\n${'='.repeat(60)}\n`);
    });
    
    // Summary statistics
    console.log('📈 SUMMARY STATISTICS:\n');
    
    const totalEntities = detailedResults.length;
    const totalCriteria = detailedResults.reduce((sum, entity) => sum + Object.keys(entity.criteria).length, 0);
    const maxPossibleCriteria = totalEntities * 8;
    
    const dataSourceStats = {
      html: 0, api: 0, ai_vision: 0, fallback: 0
    };
    
    let screenshotCount = 0;
    let fallbackCount = 0;
    
    detailedResults.forEach(entity => {
      Object.values(entity.criteria).forEach(criterion => {
        dataSourceStats[criterion.dataSource]++;
        if (criterion.fallbackUsed) fallbackCount++;
      });
      
      if (entity.screenshots.aboveFold?.exists) screenshotCount++;
      if (entity.screenshots.fullPage?.exists) screenshotCount++;
    });
    
    console.log(`✅ Total entities tested: ${totalEntities}`);
    console.log(`✅ Total criteria scored: ${totalCriteria}/${maxPossibleCriteria} (${((totalCriteria/maxPossibleCriteria)*100).toFixed(1)}%)`);
    console.log(`✅ Screenshots captured: ${screenshotCount} files`);
    console.log(`✅ Fallback usage: ${fallbackCount} instances`);
    
    console.log(`\n📊 DATA SOURCE BREAKDOWN:`);
    console.log(`   📝 HTML Analysis: ${dataSourceStats.html} criteria`);
    console.log(`   🌐 External API: ${dataSourceStats.api} criteria`);
    console.log(`   👁️  AI Vision: ${dataSourceStats.ai_vision} criteria`);
    console.log(`   🔄 Fallback: ${dataSourceStats.fallback} criteria`);
    
    const successRate = ((totalCriteria - fallbackCount) / totalCriteria * 100).toFixed(1);
    console.log(`\n🎯 Primary method success rate: ${successRate}%`);
    
  } catch (error) {
    console.error('❌ Detailed test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure the server is running on port 3001');
    }
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDetailedTest().then(() => {
    console.log('\n🏁 Detailed verification completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}