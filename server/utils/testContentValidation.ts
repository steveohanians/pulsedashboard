/**
 * Comprehensive test suite for content validation system
 * Tests profanity filtering, topic relevance, and quality checks
 */
import { sanitizeUserInput, validateContextInput } from './inputSanitizer';
import logger from './logger';

interface ContentTestCase {
  name: string;
  input: string;
  shouldBlock: boolean;
  expectedWarnings?: string[];
  category: 'profanity' | 'off-topic' | 'quality' | 'valid';
}

const contentTestCases: ContentTestCase[] = [
  // Profanity tests
  {
    name: "Basic profanity",
    input: "This shit website is broken",
    shouldBlock: true,
    category: 'profanity'
  },
  {
    name: "Hate speech",
    input: "I hate all users on this platform",
    shouldBlock: true,
    category: 'profanity'
  },
  {
    name: "Sexual content",
    input: "Our adult content site needs better analytics",
    shouldBlock: true,
    category: 'profanity'
  },

  // Off-topic tests
  {
    name: "Personal rant",
    input: "I hate my life and my personal problems are affecting work",
    shouldBlock: true,
    category: 'off-topic'
  },
  {
    name: "Joke content",
    input: "Here's a funny joke about our bounce rate lol",
    shouldBlock: true,
    category: 'off-topic'
  },
  {
    name: "Weather question",
    input: "What is the weather like for our website traffic?",
    shouldBlock: true,
    category: 'off-topic'
  },
  {
    name: "Sports opinion",
    input: "I think sports are better than our business metrics in my opinion",
    shouldBlock: true,
    category: 'off-topic'
  },

  // Quality tests
  {
    name: "Vague content",
    input: "Something happened with the thing and stuff went wrong somehow maybe",
    shouldBlock: false,
    expectedWarnings: ["Content appears vague"],
    category: 'quality'
  },
  {
    name: "Repetitive content",
    input: "The website the website has issues the website problems the website errors",
    shouldBlock: false,
    expectedWarnings: ["Content appears repetitive"],
    category: 'quality'
  },
  {
    name: "Excessive caps",
    input: "OUR WEBSITE HAS MAJOR TRAFFIC PROBLEMS AND NEEDS IMMEDIATE ATTENTION",
    shouldBlock: false,
    expectedWarnings: ["Excessive capitalization"],
    category: 'quality'
  },
  {
    name: "Low business relevance",
    input: "Yesterday I went to the store and bought groceries for dinner",
    shouldBlock: false,
    expectedWarnings: ["not be relevant to business analytics"],
    category: 'quality'
  },

  // Valid content tests
  {
    name: "Valid marketing context",
    input: "We launched a new mobile marketing campaign last month targeting younger users. Our bounce rate increased by 5%, possibly due to mobile UX issues.",
    shouldBlock: false,
    category: 'valid'
  },
  {
    name: "Valid technical context",
    input: "Our website experienced server downtime for 3 hours last week during peak traffic hours. This significantly affected our session duration metrics.",
    shouldBlock: false,
    category: 'valid'
  },
  {
    name: "Valid competitive context",
    input: "Our main competitor launched a similar product feature. We should analyze if this impacted our traffic and conversion rates.",
    shouldBlock: false,
    category: 'valid'
  }
];

/**
 * Run comprehensive content validation tests
 */
export async function runContentValidationTests(): Promise<{ passed: number; failed: number; total: number }> {
  logger.info('🧪 Starting comprehensive content validation tests...');
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const testCase of contentTestCases) {
    try {
      const result = sanitizeUserInput(testCase.input);
      const validation = validateContextInput(testCase.input);
      
      // Check if blocking behavior matches expectation
      const blockingCorrect = testCase.shouldBlock === result.isBlocked;
      const validationCorrect = testCase.shouldBlock === !validation.isValid;
      
      // Check warnings if specified
      let warningsCorrect = true;
      if (testCase.expectedWarnings) {
        warningsCorrect = testCase.expectedWarnings.every(expectedWarning =>
          result.warnings.some(actualWarning => 
            actualWarning.toLowerCase().includes(expectedWarning.toLowerCase())
          )
        );
      }
      
      const testPassed = blockingCorrect && validationCorrect && warningsCorrect;
      
      if (testPassed) {
        passed++;
        logger.info(`✅ PASS: [${testCase.category.toUpperCase()}] ${testCase.name}`, {
          blocked: result.isBlocked,
          warnings: result.warnings.slice(0, 2), // Limit log size
          sanitizedLength: result.sanitized.length
        });
      } else {
        failed++;
        logger.error(`❌ FAIL: [${testCase.category.toUpperCase()}] ${testCase.name}`, {
          expected: { shouldBlock: testCase.shouldBlock, warnings: testCase.expectedWarnings },
          actual: { blocked: result.isBlocked, warnings: result.warnings },
          input: testCase.input.substring(0, 50) + '...'
        });
      }
      
      results.push({
        name: testCase.name,
        category: testCase.category,
        passed: testPassed,
        details: {
          blocked: result.isBlocked,
          warnings: result.warnings,
          sanitized: result.sanitized.substring(0, 80) + (result.sanitized.length > 80 ? '...' : '')
        }
      });
      
    } catch (error) {
      failed++;
      logger.error(`💥 ERROR: ${testCase.name}`, { error: (error as Error).message });
    }
  }
  
  const total = contentTestCases.length;
  
  // Summary by category
  const categories = ['profanity', 'off-topic', 'quality', 'valid'];
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    logger.info(`📊 ${category.toUpperCase()} tests: ${categoryPassed}/${categoryResults.length} passed`);
  }
  
  logger.info(`🎯 Content validation test results: ${passed}/${total} passed, ${failed} failed`);
  
  return { passed, failed, total };
}

/**
 * Test specific content scenarios with detailed logging
 */
export function testSpecificContentScenarios(): void {
  const scenarios = [
    "We recently updated our website design and noticed an increase in bounce rate",
    "fuck this stupid analytics platform",
    "What's the weather like for our user engagement?",
    "something went wrong with the thing and stuff happened maybe",
    "Our competitor launched a new feature that might affect our metrics"
  ];
  
  logger.info('🔍 Testing specific content scenarios...');
  
  for (const scenario of scenarios) {
    const result = sanitizeUserInput(scenario);
    logger.info('Content validation result', {
      input: scenario.substring(0, 50) + '...',
      blocked: result.isBlocked,
      warnings: result.warnings,
      sanitized: result.sanitized.substring(0, 50) + '...'
    });
  }
}

// Export for manual testing
if (require.main === module) {
  runContentValidationTests().then(results => {
    testSpecificContentScenarios();
    logger.info('Content Validation Results:', results);
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(logger.error);
}