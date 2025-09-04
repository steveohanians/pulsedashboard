#!/usr/bin/env tsx
/**
 * Test screenshot timeout fixes for heavy websites
 */

import { screenshotService } from './server/services/effectiveness/screenshot';

async function testTimeoutFixes() {
  console.log('🔧 Testing screenshot timeout fixes\n');
  
  const testSites = [
    { name: 'Clear Digital', url: 'https://www.cleardigital.com' },
    { name: 'Clay', url: 'https://clay.global' },
    { name: 'Baunfire', url: 'https://baunfire.com' }
  ];
  
  for (const site of testSites) {
    console.log(`📸 Testing ${site.name} (${site.url})`);
    
    try {
      const startTime = Date.now();
      const result = await screenshotService.captureWebsiteScreenshot({ url: site.url });
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${site.name}: Success in ${(duration/1000).toFixed(1)}s`);
      console.log(`   Above-fold: ${result.screenshotUrl ? '✅' : '❌'} ${result.screenshotPath || 'None'}`);
      console.log(`   Full-page: ${result.fullPageScreenshotUrl ? '✅' : '❌'} ${result.fullPageScreenshotPath || 'None'}`);
      console.log(`   Method: ${result.screenshotMethod || 'unknown'}`);
      if (result.screenshotError) {
        console.log(`   Error: ${result.screenshotError}`);
      }
      if (result.fullPageError) {
        console.log(`   Full-page error: ${result.fullPageError}`);
      }
      
    } catch (error) {
      console.log(`❌ ${site.name}: Failed - ${error.message}`);
    }
    
    console.log('');
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testTimeoutFixes().then(() => {
    console.log('🏁 Screenshot timeout fix test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}