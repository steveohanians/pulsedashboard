/**
 * AI Schema Compatibility Tester
 * 
 * Verifies that switching OPENAI_MODEL from "gpt-4o" to "gpt-5" 
 * keeps the AI insights JSON shape compatible with dashboard expectations.
 */

import { z } from 'zod';
import { storage } from '../server/storage';
import { generateMetricInsights } from '../server/services/openai';

// Expected OpenAI Response Schema (based on OpenAI service response pattern)
const OpenAIResponseSchema = z.object({
  context: z.string(),
  insight: z.string(), 
  recommendation: z.string(),
  status: z.enum(['success', 'needs_improvement', 'warning'])
});

// Database/UI Compatible Schema (based on aiInsights table + UI consumption)
const DatabaseUISchema = z.object({
  contextText: z.string(),
  insightText: z.string(),
  recommendationText: z.string(),
  status: z.enum(['success', 'needs_improvement', 'warning'])
});

type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;
type DatabaseUIResponse = z.infer<typeof DatabaseUISchema>;

// Test cases covering different metric types
const TEST_CASES = [
  {
    name: 'Single Metric Numeric (Session Duration)',
    metricName: 'Session Duration',
    clientValue: 180.5,
    cdAverage: 210.3,
    industryAverage: 195.7,
    competitorValues: [220.1, 185.9, 201.4],
    competitorNames: ['Competitor A', 'Competitor B', 'Competitor C'],
    expectedDataType: 'numeric'
  },
  {
    name: 'Device Distribution Array',
    metricName: 'Device Distribution', 
    clientValue: [
      { device: 'Desktop', percentage: 65.2, sessions: 1250 },
      { device: 'Mobile', percentage: 34.8, sessions: 667 }
    ],
    cdAverage: [
      { device: 'Desktop', percentage: 70.1 },
      { device: 'Mobile', percentage: 29.9 }
    ],
    industryAverage: 68.5,
    competitorValues: [
      [{ device: 'Desktop', percentage: 72.3 }, { device: 'Mobile', percentage: 27.7 }],
      [{ device: 'Desktop', percentage: 68.9 }, { device: 'Mobile', percentage: 31.1 }]
    ],
    competitorNames: ['Competitor A', 'Competitor B'],
    expectedDataType: 'distribution'
  },
  {
    name: 'Traffic Channel Breakdown',
    metricName: 'Traffic Channels',
    clientValue: [
      { channel: 'Organic Search', percentage: 45.2 },
      { channel: 'Direct', percentage: 28.7 },
      { channel: 'Social Media', percentage: 15.1 },
      { channel: 'Paid Search', percentage: 11.0 }
    ],
    cdAverage: [
      { channel: 'Organic Search', percentage: 42.1 },
      { channel: 'Direct', percentage: 31.2 },
      { channel: 'Social Media', percentage: 16.5 },
      { channel: 'Paid Search', percentage: 10.2 }
    ],
    industryAverage: 43.8,
    competitorValues: [
      [{ channel: 'Organic Search', percentage: 48.3 }, { channel: 'Direct', percentage: 25.1 }],
      [{ channel: 'Organic Search', percentage: 41.7 }, { channel: 'Direct', percentage: 33.2 }]
    ],
    competitorNames: ['Competitor A', 'Competitor B'],
    expectedDataType: 'channels'
  },
  {
    name: 'Competitor Comparison Numeric (Bounce Rate)',
    metricName: 'Bounce Rate',
    clientValue: 42.3,
    cdAverage: 38.7,
    industryAverage: 41.2,
    competitorValues: [35.8, 44.1, 39.6, 41.9, 37.2],
    competitorNames: ['Competitor A', 'Competitor B', 'Competitor C', 'Competitor D', 'Competitor E'],
    expectedDataType: 'numeric'
  },
  {
    name: 'Pages Per Session Performance',
    metricName: 'Pages per Session',
    clientValue: 2.8,
    cdAverage: 3.2,
    industryAverage: 3.0,
    competitorValues: [3.1, 2.9, 3.4],
    competitorNames: ['Competitor A', 'Competitor B', 'Competitor C'],
    expectedDataType: 'numeric'
  }
];

interface TestResult {
  testCase: string;
  passed: boolean;
  errors: string[];
  response?: any;
  coercionSuggestion?: string;
}

/**
 * Coercion function to transform OpenAI response to Database/UI format
 * Only generates this when there are mismatches
 */
function generateCoercionFunction(failures: TestResult[]): string {
  if (failures.length === 0) return '';

  return `
/**
 * Coercion function to ensure OpenAI responses match expected schema
 * Generated based on detected compatibility issues
 */
function coerceInsightToSchema(input: unknown): DatabaseUIResponse {
  const rawResponse = input as any;
  
  return {
    contextText: rawResponse.context || rawResponse.contextText || rawResponse.context_analysis || '',
    insightText: rawResponse.insight || rawResponse.insightText || rawResponse.competitive_intelligence || '',
    recommendationText: rawResponse.recommendation || rawResponse.recommendationText || rawResponse.action_plan || '',
    status: normalizeStatus(rawResponse.status)
  };
}

function normalizeStatus(status: any): 'success' | 'needs_improvement' | 'warning' {
  if (typeof status !== 'string') return 'needs_improvement';
  
  const normalized = status.toLowerCase().trim();
  if (normalized.includes('success') || normalized.includes('good') || normalized.includes('strong')) {
    return 'success';
  }
  if (normalized.includes('warning') || normalized.includes('critical') || normalized.includes('poor')) {
    return 'warning';
  }
  return 'needs_improvement';
}`;
}

/**
 * Test a single metric insight generation
 */
async function testMetricInsight(testCase: typeof TEST_CASES[0]): Promise<TestResult> {
  try {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    // Generate insight using existing function
    const response = await generateMetricInsights(
      testCase.metricName,
      Array.isArray(testCase.clientValue) ? 0 : testCase.clientValue, // Convert arrays to 0 for generateMetricInsights
      Array.isArray(testCase.cdAverage) ? 0 : testCase.cdAverage,
      typeof testCase.industryAverage === 'number' ? testCase.industryAverage : 0,
      testCase.competitorValues.map(cv => Array.isArray(cv) ? 0 : cv),
      'Technology',
      'Small Business',
      'Test Client'
    );

    console.log(`📥 Response received for ${testCase.name}`);
    
    // Validate against OpenAI schema first
    const openAIValidation = OpenAIResponseSchema.safeParse(response);
    if (!openAIValidation.success) {
      return {
        testCase: testCase.name,
        passed: false,
        errors: [`OpenAI Schema Validation Failed: ${openAIValidation.error.message}`],
        response
      };
    }

    // Transform to Database/UI format (simulating the mapping)
    const transformed = {
      contextText: response.context,
      insightText: response.insight,
      recommendationText: response.recommendation,
      status: response.status
    };

    // Validate against Database/UI schema
    const dbUIValidation = DatabaseUISchema.safeParse(transformed);
    if (!dbUIValidation.success) {
      return {
        testCase: testCase.name,
        passed: false,
        errors: [`Database/UI Schema Validation Failed: ${dbUIValidation.error.message}`],
        response,
        coercionSuggestion: 'Field mapping required'
      };
    }

    return {
      testCase: testCase.name,
      passed: true,
      errors: [],
      response: transformed
    };

  } catch (error) {
    return {
      testCase: testCase.name,
      passed: false,
      errors: [`Execution Error: ${(error as Error).message}`],
      response: null
    };
  }
}

/**
 * Main compatibility test runner
 */
async function runCompatibilityTest(): Promise<void> {
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o';
  
  console.log(`\n🚀 AI Schema Compatibility Test`);
  console.log(`📋 Model: ${modelName}`);
  console.log(`📊 Test Cases: ${TEST_CASES.length}`);
  console.log(`🎯 Target Schema: OpenAI Response → Database/UI Format`);
  console.log('='.repeat(60));

  const results: TestResult[] = [];
  
  // Run all test cases
  for (const testCase of TEST_CASES) {
    const result = await testMetricInsight(testCase);
    results.push(result);
  }

  // Generate summary table
  console.log(`\n📋 COMPATIBILITY RESULTS SUMMARY`);
  console.log('='.repeat(60));
  console.log('| Test Case                          | Status | Notes |');
  console.log('|------------------------------------|--------|-------|');
  
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const notes = result.errors.length > 0 ? result.errors[0].slice(0, 20) + '...' : 'OK';
    const testName = result.testCase.padEnd(34);
    console.log(`| ${testName} | ${status} | ${notes.padEnd(5)} |`);
  });

  console.log('='.repeat(60));
  console.log(`📊 Results: ${passed.length}/${results.length} tests passed`);

  // Detail failed tests
  if (failed.length > 0) {
    console.log(`\n❌ FAILED TESTS DETAILS:`);
    failed.forEach(failure => {
      console.log(`\n🔍 ${failure.testCase}:`);
      failure.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
      if (failure.response) {
        console.log(`   📄 Response Preview:`, JSON.stringify(failure.response, null, 2).slice(0, 200) + '...');
      }
    });

    // Generate coercion function if needed
    const coercionFunction = generateCoercionFunction(failed);
    if (coercionFunction) {
      console.log(`\n🔧 SUGGESTED COERCION FUNCTION:`);
      console.log(coercionFunction);
    }
  }

  // Usage instructions
  console.log(`\n📚 USAGE INSTRUCTIONS:`);
  console.log(`To test with GPT-4o: OPENAI_MODEL=gpt-4o npm run ai:compat`);
  console.log(`To test with GPT-5:  OPENAI_MODEL=gpt-5 npm run ai:compat`);
  console.log(`\n🔄 Recommendation: Run both models and compare results`);
  
  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompatibilityTest().catch(error => {
    console.error('❌ Compatibility test failed:', error);
    process.exit(1);
  });
}

export { runCompatibilityTest, TEST_CASES, OpenAIResponseSchema, DatabaseUISchema };