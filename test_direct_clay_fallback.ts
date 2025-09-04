#!/usr/bin/env tsx
/**
 * Test Clay Playwright fallback directly without throttler
 */

import { screenshotService } from './server/services/effectiveness/screenshot';

async function testDirectClayFallback() {
  console.log('🧪 Testing Clay direct Playwright fallback (bypassing throttler)\n');
  
  try {
    console.log('📸 Calling captureFullPageWithAPI directly for https://clay.global');
    console.log('   This will test if Playwright fallback works when API times out...');
    
    const startTime = Date.now();
    
    // Call the method directly without throttling
    const result = await screenshotService.captureFullPageWithAPI(
      'https://clay.global', 
      'uploads/screenshots'
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Duration: ${(duration/1000).toFixed(1)}s`);
    console.log(`📁 Full-page path: ${result.fullPageScreenshotPath || 'NONE'}`);
    console.log(`🌐 Full-page URL: ${result.fullPageScreenshotUrl || 'NONE'}`);
    console.log(`❌ Error: ${result.fullPageError || 'NONE'}`);
    
    // Check if file actually exists
    if (result.fullPageScreenshotPath) {
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(result.fullPageScreenshotPath);
        console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`✅ File exists and verified`);
        
        if (stats.size > 100000) { // 100KB minimum
          console.log(`✅ File size looks good for full-page screenshot`);
          console.log(`\n🎉 SUCCESS! Playwright fallback worked for Clay!`);
        } else {
          console.log(`⚠️  File size seems small for full-page screenshot`);
        }
        
      } catch (fileError) {
        console.log(`❌ File verification failed: ${fileError.message}`);
      }
    }
    
    if (!result.fullPageScreenshotPath && result.fullPageError) {
      console.log(`\n❌ FAILED! Fallback did not work`);
      console.log(`   Error: ${result.fullPageError}`);
    }
    
  } catch (error) {
    console.log(`❌ Direct test failed: ${error.message}`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testDirectClayFallback().then(() => {
    console.log('\n🏁 Direct Clay fallback test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}