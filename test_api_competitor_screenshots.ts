/**
 * Quick test to check if API returns competitor screenshots correctly
 */

const express = require('express');
const { router } = require('./server/routes');
const { storage } = require('./server/storage');

async function testApiCompetitorScreenshots() {
  // Create a minimal Express app
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  
  // Start server
  const server = app.listen(3001, async () => {
    console.log('\n=== Testing API Competitor Screenshots ===\n');
    
    try {
      // Create a test session for auth
      await storage.createSession({
        id: 'test-session',
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 3600000)
      });
      
      // Make API request
      const response = await fetch('http://localhost:3001/api/effectiveness/latest/demo-client-id', {
        headers: {
          'Cookie': 'sessionId=test-session'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('Client Run:');
        console.log(`  ID: ${data.run?.id}`);
        console.log(`  Screenshot: ${data.run?.screenshotUrl ? '✓ Present' : '✗ Missing'}`);
        console.log(`  Full Page: ${data.run?.fullPageScreenshotUrl ? '✓ Present' : '✗ Missing'}`);
        
        if (data.competitorEffectivenessData) {
          console.log(`\nCompetitor Data (${data.competitorEffectivenessData.length} competitors):`);
          
          data.competitorEffectivenessData.forEach((comp: any) => {
            console.log(`\n${comp.competitor.label}:`);
            console.log(`  Run ID: ${comp.run.id}`);
            console.log(`  Status: ${comp.run.status}`);
            console.log(`  Overall Score: ${comp.run.overallScore}`);
            console.log(`  Screenshot URL: ${comp.run.screenshotUrl ? '✓ ' + comp.run.screenshotUrl : '✗ Missing'}`);
            console.log(`  Full Page URL: ${comp.run.fullPageScreenshotUrl ? '✓ ' + comp.run.fullPageScreenshotUrl : '✗ Missing'}`);
            console.log(`  Criterion Scores: ${comp.run.criterionScores?.length || 0} criteria`);
            
            // Log first few properties to see what's actually being returned
            console.log('  All run properties:', Object.keys(comp.run));
          });
        } else {
          console.log('\n❌ No competitor data in API response');
        }
        
        // Log the raw JSON for one competitor to debug
        if (data.competitorEffectivenessData?.[0]) {
          console.log('\n--- Raw first competitor data ---');
          console.log(JSON.stringify(data.competitorEffectivenessData[0], null, 2));
        }
        
      } else {
        console.log(`❌ API request failed with status ${response.status}`);
        const text = await response.text();
        console.log('Response:', text);
      }
      
    } catch (error) {
      console.error('Error during test:', error);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testApiCompetitorScreenshots();