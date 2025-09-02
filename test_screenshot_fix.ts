/**
 * Test Screenshot Path Resolution Fix
 */

import { convertScreenshotToBase64 } from './server/services/effectiveness/visionHelper';
import { promises as fs } from 'fs';
import path from 'path';

async function testScreenshotPathResolution() {
  console.log('🧪 Testing Screenshot Path Resolution Fix\n');

  // Find a real screenshot file to test with
  const screenshotDir = path.join(process.cwd(), 'uploads', 'screenshots');
  
  try {
    const files = await fs.readdir(screenshotDir);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    
    if (pngFiles.length === 0) {
      console.log('❌ No PNG files found in uploads/screenshots/');
      return;
    }

    const testFile = pngFiles[0];
    console.log(`📁 Testing with file: ${testFile}\n`);

    // Test different path formats
    const testCases = [
      {
        name: 'URL Path (most common)',
        path: `/screenshots/${testFile}`,
        expected: true
      },
      {
        name: 'Relative Path',
        path: `screenshots/${testFile}`,
        expected: true
      },
      {
        name: 'Full Uploads Path',
        path: `uploads/screenshots/${testFile}`,
        expected: true
      },
      {
        name: 'Bare Filename',
        path: testFile,
        expected: true
      },
      {
        name: 'Absolute Path',
        path: path.join(screenshotDir, testFile),
        expected: true
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`🔍 Testing ${testCase.name}: ${testCase.path}`);
        
        const base64Result = await convertScreenshotToBase64(testCase.path);
        
        if (base64Result && base64Result.length > 100) {
          console.log(`  ✅ SUCCESS - Base64 length: ${Math.round(base64Result.length / 1024)}KB`);
          
          // Verify it's valid base64
          const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(base64Result);
          console.log(`  📝 Valid Base64 format: ${isValidBase64 ? 'YES' : 'NO'}`);
          
          // Test OpenAI format
          const dataUrl = `data:image/png;base64,${base64Result}`;
          console.log(`  🖼️  OpenAI format ready: ${dataUrl.length > 100 ? 'YES' : 'NO'}`);
        } else {
          console.log(`  ❌ FAILED - Invalid result`);
        }
      } catch (error) {
        console.log(`  ❌ FAILED - ${error.message}`);
      }
      console.log('');
    }

    // Test error cases
    console.log('🚫 Testing Error Cases:\n');
    
    const errorCases = [
      '/screenshots/nonexistent.png',
      'uploads/screenshots/missing.png',
      'totally-invalid-path.png'
    ];

    for (const errorPath of errorCases) {
      try {
        console.log(`🔍 Testing error case: ${errorPath}`);
        await convertScreenshotToBase64(errorPath);
        console.log(`  ❌ UNEXPECTED SUCCESS - Should have failed`);
      } catch (error) {
        console.log(`  ✅ CORRECTLY FAILED - ${error.message}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }
}

testScreenshotPathResolution()
  .then(() => {
    console.log('🎉 Screenshot path resolution tests completed!');
  })
  .catch(console.error);