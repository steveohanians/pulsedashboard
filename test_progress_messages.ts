#!/usr/bin/env tsx
/**
 * Test progress messages during effectiveness analysis
 * Monitor the actual message flow users see
 */

import { storage } from './server/storage';

// Mock progress callback to capture messages
const progressMessages: string[] = [];
let currentMessage = '';

function mockProgressCallback(status: string, message: string, data?: any, details?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const logEntry = `[${timestamp}] ${status}: ${message}`;
  
  progressMessages.push(logEntry);
  currentMessage = message;
  console.log(`📢 ${logEntry}`);
  
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function testProgressMessages() {
  console.log('🔍 Testing progress message flow during effectiveness analysis\n');
  
  try {
    // Get demo client
    const clients = await storage.getClients();
    const client = clients.find(c => c.id === 'demo-client-id');
    
    if (!client) {
      console.log('❌ Demo client not found');
      return;
    }
    
    const websiteUrl = client.websiteUrl || 'https://cleardigital.com';
    console.log(`📊 Testing with client: ${client.name} (${websiteUrl})`);
    console.log('📝 Monitoring all progress messages...\n');
    
    // Import the enhanced scorer with progress callback
    const { EnhancedWebsiteEffectivenessScorer } = await import('./server/services/effectiveness/enhancedScorer');
    const enhancedScorer = new EnhancedWebsiteEffectivenessScorer();
    
    // Run a simplified scoring test to observe progress messages
    const startTime = Date.now();
    
    try {
      const result = await enhancedScorer.scoreWebsiteProgressive(
        websiteUrl,
        mockProgressCallback
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n✅ Analysis completed in ${duration}s`);
      console.log(`📈 Final score: ${result.overallScore}/10`);
      console.log(`🎯 Status: ${result.status}`);
      
      console.log(`\n📋 Progress Message Summary (${progressMessages.length} messages):`);
      progressMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg}`);
      });
      
      // Analyze message helpfulness
      console.log(`\n🔍 Message Analysis:`);
      console.log(`   - Total messages: ${progressMessages.length}`);
      console.log(`   - First message: "${progressMessages[0]?.split(': ')[1] || 'NONE'}"`);
      console.log(`   - Last message: "${progressMessages[progressMessages.length - 1]?.split(': ')[1] || 'NONE'}"`);
      console.log(`   - Messages contain helpful info: ${progressMessages.some(m => m.includes('screenshot') || m.includes('analyzing') || m.includes('complete'))}`);
      
    } catch (error) {
      console.log(`❌ Scoring failed: ${error.message}`);
      console.log(`📝 Messages before failure: ${progressMessages.length}`);
    }
    
  } catch (error) {
    console.log(`❌ Test setup failed: ${error.message}`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  testProgressMessages().then(() => {
    console.log('\n🏁 Progress message test completed');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}