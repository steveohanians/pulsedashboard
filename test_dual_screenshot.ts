import { screenshotService } from './server/services/effectiveness/screenshot';

async function testDualScreenshots() {
  console.log('🧪 Testing Dual Screenshot Functionality');
  console.log('=====================================');
  
  try {
    // Test capturing both screenshots
    console.log('\n📸 Testing dual screenshot capture...');
    
    const result = await screenshotService.captureWebsiteScreenshot({
      url: 'https://www.cleardigital.com',
      viewport: { width: 1440, height: 900 },
      outputDir: 'uploads/screenshots',
      captureFullPage: true
    });
    
    console.log('\n✅ Screenshot Service Results:');
    console.log('Above-fold screenshot:', result.screenshotUrl);
    console.log('Full-page screenshot:', result.fullPageScreenshotUrl);
    console.log('Screenshot method:', result.screenshotMethod);
    console.log('Above-fold error:', result.error || 'None');
    console.log('Full-page error:', result.fullPageError || 'None');
    
    // Check if files actually exist
    if (result.screenshotUrl) {
      const fs = await import('fs/promises');
      const aboveFoldPath = `uploads/screenshots/${result.screenshotUrl.split('/').pop()}`;
      try {
        const stats = await fs.stat(aboveFoldPath);
        console.log('Above-fold file size:', Math.round(stats.size / 1024), 'KB');
      } catch {
        console.log('❌ Above-fold file not found at:', aboveFoldPath);
      }
    }
    
    if (result.fullPageScreenshotUrl) {
      const fs = await import('fs/promises');
      const fullPagePath = `uploads/screenshots/${result.fullPageScreenshotUrl.split('/').pop()}`;
      try {
        const stats = await fs.stat(fullPagePath);
        console.log('Full-page file size:', Math.round(stats.size / 1024), 'KB');
      } catch {
        console.log('❌ Full-page file not found at:', fullPagePath);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('🚀 Starting dual screenshot test...');
testDualScreenshots();