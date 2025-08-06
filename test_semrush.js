// Test SEMrush integration for focuslabs.agency
import { semrushService } from './server/services/semrush/semrushService.js';

async function testSemrush() {
  try {
    console.log('Testing SEMrush for focuslabs.agency...');
    
    // Test domain extraction
    const domain = 'https://focuslabs.agency';
    console.log('Testing with domain:', domain);
    
    // Extract domain (same as CompetitorIntegration does)
    const extractedDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('Extracted domain:', extractedDomain);
    
    // Test SEMrush API call
    const result = await semrushService.fetchHistoricalData(extractedDomain);
    
    console.log('✅ SEMrush fetch result:');
    console.log('- Periods found:', result.size);
    console.log('- Sample data:');
    
    if (result.size > 0) {
      const firstEntry = result.entries().next().value;
      console.log('  Period:', firstEntry[0]);
      console.log('  Data keys:', Object.keys(firstEntry[1]));
      console.log('  Sample metrics:', firstEntry[1]);
    } else {
      console.log('  No data returned');
    }
    
  } catch (error) {
    console.error('❌ SEMrush test failed:', error.message);
    console.error('Error details:', error);
  }
}

testSemrush();