#!/usr/bin/env tsx
/**
 * Focused test on full-page screenshots for competitors
 */

import { screenshotService } from './server/services/effectiveness/screenshot';

async function testFullPageScreenshots() {
  console.log('🔍 Testing Full-Page Screenshots for Competitors\n');
  
  const testSites = [
    { name: 'Clear Digital (Client)', url: 'https://www.cleardigital.com' },
    { name: 'Clay (Competitor)', url: 'https://clay.global' },
    { name: 'Baunfire (Competitor)', url: 'https://baunfire.com' }
  ];
  
  for (const site of testSites) {
    console.log(`📸 Testing full-page screenshot for ${site.name}`);
    console.log(`   URL: ${site.url}`);
    
    try {
      const startTime = Date.now();
      
      // Test the specific full-page method directly
      const result = await screenshotService.captureFullPageWithAPI(
        site.url, 
        'uploads/screenshots'
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${site.name}: ${(duration/1000).toFixed(1)}s`);
      console.log(`   Full-page path: ${result.fullPageScreenshotPath || 'NONE'}`);
      console.log(`   Full-page URL: ${result.fullPageScreenshotUrl || 'NONE'}`);
      if (result.fullPageError) {
        console.log(`   Error: ${result.fullPageError}`);
      }
      
      // Check if file actually exists
      if (result.fullPageScreenshotPath) {
        try {
          const fs = await import('fs/promises');
          const stats = await fs.stat(result.fullPageScreenshotPath);
          console.log(`   File size: ${(stats.size / 1024).toFixed(1)}KB`);
          console.log(`   File exists: ✅`);
        } catch (fileError) {
          console.log(`   File exists: ❌ ${fileError.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${site.name}: FAILED`);
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n')[1]}`);
      }
    }
    
    console.log(''); // Empty line
  }
  
  // Now test the complete capture method with full-page enabled
  console.log('🔄 Testing Complete Capture with Full-Page Enabled\n');
  
  for (const site of testSites) {
    console.log(`📸 Testing complete capture for ${site.name}`);
    
    try {
      const startTime = Date.now();
      
      const result = await screenshotService.captureWebsiteScreenshot({
        url: site.url,
        captureFullPage: true  // This is key!
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${site.name}: ${(duration/1000).toFixed(1)}s`);
      console.log(`   Above-fold: ${result.screenshotUrl ? '✅' : '❌'}`);
      console.log(`   Full-page: ${result.fullPageScreenshotUrl ? '✅' : '❌'}`);
      console.log(`   Method: ${result.screenshotMethod}`);
      
      if (result.fullPageError) {
        console.log(`   Full-page error: ${result.fullPageError}`);
      }
      
    } catch (error) {
      console.log(`❌ ${site.name}: FAILED - ${error.message}`);
    }
    
    console.log('');
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testFullPageScreenshots().then(() => {
    console.log('🏁 Full-page screenshot test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}