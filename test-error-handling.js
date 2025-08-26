/**
 * Edge case testing for Website Effectiveness Scoring error handling
 */

const testCases = [
  {
    name: 'Invalid URL format',
    url: 'not-a-valid-url',
    expectedError: 'Invalid URL format'
  },
  {
    name: 'Local development URL (should be blocked in production)',
    url: 'http://localhost:3000',
    expectedError: process.env.NODE_ENV === 'production' ? 'Invalid URL format' : null
  },
  {
    name: 'Non-existent domain',
    url: 'https://this-domain-definitely-does-not-exist-12345.com',
    expectedError: 'Unable to access website'
  },
  {
    name: 'Valid URL that should work',
    url: 'https://example.com',
    expectedError: null
  }
];

async function testErrorHandling() {
  const { WebsiteEffectivenessScorer } = await import('./server/services/effectiveness/scorer.js');
  
  console.log('Testing Website Effectiveness Scoring error handling...\n');
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const scorer = new WebsiteEffectivenessScorer();
      const result = await scorer.scoreWebsite(testCase.url);
      
      if (testCase.expectedError) {
        console.log(`❌ Expected error but got success. Score: ${result.overallScore}`);
      } else {
        console.log(`✅ Success. Score: ${result.overallScore}, Criteria: ${result.criterionResults.length}`);
      }
      
    } catch (error) {
      if (testCase.expectedError) {
        if (error.message.includes(testCase.expectedError)) {
          console.log(`✅ Expected error caught: ${error.message}`);
        } else {
          console.log(`❌ Wrong error. Expected: "${testCase.expectedError}", Got: "${error.message}"`);
        }
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
      }
    }
    
    console.log('');
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testErrorHandling().catch(console.error);
}

export { testErrorHandling };