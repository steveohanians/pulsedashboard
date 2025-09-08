/**
 * Test script to verify competitor screenshots are properly returned from API
 * and transformed by the client service
 */

import { db } from './server/db';
import { effectivenessRuns, competitors } from '@shared/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';

async function testCompetitorScreenshots() {
  const clientId = 'demo-client-id';
  
  console.log('\n=== Testing Competitor Screenshots ===\n');
  
  try {
    // 1. Check what competitors exist for this client
    const competitorList = await db
      .select()
      .from(competitors)
      .where(eq(competitors.clientId, clientId));
    
    console.log(`Found ${competitorList.length} competitors for client ${clientId}:`);
    competitorList.forEach(comp => {
      console.log(`  - ${comp.label} (${comp.domain})`);
    });
    
    // 2. Check latest run for each competitor
    console.log('\n--- Checking competitor runs for screenshots ---\n');
    
    for (const competitor of competitorList) {
      const latestRun = await db
        .select({
          id: effectivenessRuns.id,
          competitorId: effectivenessRuns.competitorId,
          status: effectivenessRuns.status,
          screenshotUrl: effectivenessRuns.screenshotUrl,
          fullPageScreenshotUrl: effectivenessRuns.fullPageScreenshotUrl,
          screenshotError: effectivenessRuns.screenshotError,
          createdAt: effectivenessRuns.createdAt
        })
        .from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          eq(effectivenessRuns.competitorId, competitor.id),
          eq(effectivenessRuns.status, 'completed')
        ))
        .orderBy(desc(effectivenessRuns.createdAt))
        .limit(1);
      
      if (latestRun.length > 0) {
        const run = latestRun[0];
        console.log(`\n${competitor.label}:`);
        console.log(`  Run ID: ${run.id}`);
        console.log(`  Status: ${run.status}`);
        console.log(`  Screenshot URL: ${run.screenshotUrl ? '✓ ' + run.screenshotUrl.substring(0, 50) + '...' : '✗ Missing'}`);
        console.log(`  Full Page URL: ${run.fullPageScreenshotUrl ? '✓ ' + run.fullPageScreenshotUrl.substring(0, 50) + '...' : '✗ Missing'}`);
        if (run.screenshotError) {
          console.log(`  Screenshot Error: ${run.screenshotError}`);
        }
      } else {
        console.log(`\n${competitor.label}: No completed runs found`);
      }
    }
    
    // 3. Test the API endpoint directly
    console.log('\n--- Testing API endpoint ---\n');
    const response = await fetch(`http://localhost:3000/api/effectiveness/latest/${clientId}`, {
      headers: {
        'Cookie': 'sessionId=test-session'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.competitorEffectivenessData) {
        console.log(`API returned ${data.competitorEffectivenessData.length} competitors:`);
        
        data.competitorEffectivenessData.forEach((comp: any) => {
          console.log(`\n${comp.competitor.label}:`);
          console.log(`  Run ID: ${comp.run.id}`);
          console.log(`  Screenshot URL: ${comp.run.screenshotUrl ? '✓ Present' : '✗ Missing'}`);
          console.log(`  Full Page URL: ${comp.run.fullPageScreenshotUrl ? '✓ Present' : '✗ Missing'}`);
        });
      } else {
        console.log('No competitor data in API response');
      }
    } else {
      console.log(`API request failed with status ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

testCompetitorScreenshots();