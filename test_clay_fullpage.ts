#!/usr/bin/env tsx
/**
 * Test Clay full-page screenshot with new Playwright fallback
 */

import { screenshotService } from './server/services/effectiveness/screenshot';

async function testClayFullPage() {
  console.log('🎯 Testing Clay Full-Page Screenshot with Playwright Fallback\n');
  
  try {
    console.log('📸 Testing https://clay.global');
    const startTime = Date.now();
    
    const result = await screenshotService.captureFullPageWithAPI(
      'https://clay.global', 
      'uploads/screenshots'
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Duration: ${(duration/1000).toFixed(1)}s`);
    console.log(`📁 Full-page path: ${result.fullPageScreenshotPath || 'NONE'}`);
    console.log(`🌐 Full-page URL: ${result.fullPageScreenshotUrl || 'NONE'}`);
    
    if (result.fullPageError) {
      console.log(`❌ Error: ${result.fullPageError}`);
    }
    
    // Check if file actually exists
    if (result.fullPageScreenshotPath) {
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(result.fullPageScreenshotPath);
        console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`✅ File exists and verified`);
        
        // Check if it's a reasonable size for a full-page screenshot
        if (stats.size > 50000) { // 50KB minimum
          console.log(`✅ File size looks reasonable for full-page screenshot`);
        } else {
          console.log(`⚠️  File size seems small for full-page screenshot`);
        }
        
      } catch (fileError) {
        console.log(`❌ File verification failed: ${fileError.message}`);
      }
    }
    
    if (result.fullPageScreenshotPath && !result.fullPageError) {
      console.log(`\n🎉 SUCCESS! Clay full-page screenshot captured successfully`);
      console.log(`   This means AI vision analysis should now work for Clay!`);
    } else {
      console.log(`\n❌ FAILED! Clay full-page screenshot still not working`);
    }
    
  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testClayFullPage().then(() => {
    console.log('\n🏁 Clay full-page test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}