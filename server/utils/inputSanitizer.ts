import { logger } from './logger';

export interface SanitizationResult {
  sanitized: string;
  isBlocked: boolean;
  warnings: string[];
}

// Known prompt injection patterns
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction manipulation
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/gi,
  /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/gi,
  /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/gi,
  /override\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/gi,
  
  // Role manipulation attempts
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /act\s+as\s+(a|an)\s+/gi,
  /pretend\s+to\s+be\s+(a|an)\s+/gi,
  /roleplay\s+as\s+(a|an)\s+/gi,
  
  // System message injection
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /human\s*:\s*/gi,
  /user\s*:\s*/gi,
  
  // Instruction termination attempts
  /end\s+of\s+(instructions?|prompts?|rules?)/gi,
  /new\s+(instructions?|prompts?|rules?)/gi,
  /different\s+(instructions?|prompts?|rules?)/gi,
  
  // Output manipulation
  /respond\s+with\s+only/gi,
  /output\s+only/gi,
  /just\s+say/gi,
  /only\s+respond/gi,
  
  // Context breaking
  /break\s+character/gi,
  /stop\s+being/gi,
  /exit\s+(mode|character|role)/gi,
];

// HTML/Script tag patterns
const HTML_SCRIPT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gmi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gmi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gmi,
  /<embed\b[^>]*>/gmi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gmi,
  /<input\b[^>]*>/gmi,
  /<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gmi,
  /<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gmi,
  /<link\b[^>]*>/gmi,
  /<meta\b[^>]*>/gmi,
  /javascript:/gmi,
  /vbscript:/gmi,
  /data:/gmi,
  /on\w+\s*=/gmi, // Event handlers like onclick, onload, etc.
];

// Character limits
const MAX_INPUT_LENGTH = 1000;
const MIN_INPUT_LENGTH = 3;

// Profanity and inappropriate content patterns
const PROFANITY_PATTERNS = [
  // Common profanity (basic detection - expandable)
  /\b(fuck|shit|damn|bitch|asshole|bastard)\b/gi,
  /\b(wtf|stfu|gtfo)\b/gi,
  
  // Hate speech indicators
  /\b(hate|racist|sexist|homophobic|transphobic)\b.*\b(people|users|customers)\b/gi,
  /\b(kill|murder|die)\b.*\b(all|every)\b/gi,
  
  // Sexual content
  /\b(sex|sexual|porn|nude|naked)\b/gi,
  /\b(xxx|adult|erotic)\b/gi,
];

// Off-topic content patterns
const OFF_TOPIC_PATTERNS = [
  // Personal rants
  /\b(i hate|i love|my life|my problems|personal drama)\b/gi,
  
  // Jokes and entertainment
  /\b(joke|funny|lol|haha|meme)\b/gi,
  /knock\s+knock/gi,
  
  // Unrelated questions
  /what\s+is\s+the\s+(weather|time|date)/gi,
  /how\s+do\s+i\s+(cook|drive|sleep)/gi,
  
  // Random topics
  /\b(sports|politics|celebrities|movies|music)\b.*\b(opinion|thoughts|feelings)\b/gi,
];

// Business/analytics relevance keywords
const BUSINESS_RELEVANCE_KEYWORDS = [
  'website', 'traffic', 'users', 'customers', 'visitors', 'conversion', 'bounce', 'session',
  'marketing', 'campaign', 'advertising', 'SEO', 'analytics', 'metrics', 'performance',
  'business', 'company', 'product', 'service', 'sales', 'revenue', 'growth',
  'mobile', 'desktop', 'browser', 'page', 'content', 'UX', 'UI', 'design',
  'technical', 'server', 'downtime', 'loading', 'speed', 'optimization',
  'competitor', 'industry', 'market', 'benchmark', 'comparison', 'target'
];

/**
 * Sanitizes user input for AI prompt injection and XSS attacks
 * @param input - Raw user input string
 * @returns SanitizationResult with sanitized text and security flags
 */
export function sanitizeUserInput(input: string): SanitizationResult {
  const warnings: string[] = [];
  let sanitized = input;
  let isBlocked = false;

  // Step 1: Basic cleanup
  sanitized = sanitized.trim();
  
  // Step 2: Length validation
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_INPUT_LENGTH);
    warnings.push(`Input truncated to ${MAX_INPUT_LENGTH} characters`);
    logger.warn('Input truncated for length', { 
      originalLength: input.length, 
      truncatedLength: sanitized.length 
    });
  }
  
  // Step 3: Check for prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      isBlocked = true;
      warnings.push('Potential prompt injection detected');
      logger.warn('Prompt injection attempt blocked', { 
        pattern: pattern.toString(),
        input: sanitized.substring(0, 100) + '...' 
      });
      break;
    }
  }

  // Step 4: Check for profanity and inappropriate content
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(sanitized)) {
      isBlocked = true;
      warnings.push('Inappropriate content detected');
      logger.warn('Profanity/inappropriate content blocked', { 
        input: sanitized.substring(0, 100) + '...' 
      });
      break;
    }
  }

  // Step 5: Check for off-topic content
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(sanitized)) {
      isBlocked = true;
      warnings.push('Content appears off-topic for business analytics');
      logger.warn('Off-topic content blocked', { 
        input: sanitized.substring(0, 100) + '...' 
      });
      break;
    }
  }

  // Step 6: Check for business relevance (if not blocked yet)
  if (!isBlocked) {
    const relevanceScore = checkBusinessRelevance(sanitized);
    if (relevanceScore < 0.3) {
      warnings.push('Content may not be relevant to business analytics - consider adding more specific business context');
      logger.info('Low business relevance detected', { 
        relevanceScore,
        input: sanitized.substring(0, 100) + '...' 
      });
    }
  }

  // Step 7: Check for vague or repetitive content (if not blocked yet)
  if (!isBlocked) {
    const qualityIssues = checkContentQuality(sanitized);
    if (qualityIssues.length > 0) {
      warnings.push(...qualityIssues);
      logger.info('Content quality issues detected', { 
        issues: qualityIssues,
        input: sanitized.substring(0, 100) + '...' 
      });
    }
  }
  
  // Step 8: Remove HTML/Script tags
  let hadHtmlContent = false;
  for (const pattern of HTML_SCRIPT_PATTERNS) {
    if (pattern.test(sanitized)) {
      hadHtmlContent = true;
      sanitized = sanitized.replace(pattern, '');
    }
  }
  
  if (hadHtmlContent) {
    warnings.push('HTML/script content removed');
    logger.warn('HTML/script tags removed from input', { 
      beforeLength: input.length,
      afterLength: sanitized.length 
    });
  }
  
  // Step 9: Escape template literal patterns
  sanitized = sanitized
    .replace(/\$\{/g, '\\${')  // Escape template literals
    .replace(/`/g, '\\`');     // Escape backticks
  
  // Step 10: Escape curly braces for prompt template safety
  sanitized = sanitized
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
  
  // Step 11: Remove excessive whitespace and normalize
  sanitized = sanitized
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
    .trim();
  
  // Step 12: Final safety check - block if empty after sanitization
  if (!sanitized || sanitized.length < 3) {
    isBlocked = true;
    warnings.push('Input too short or empty after sanitization');
  }
  
  // Log sanitization results
  if (warnings.length > 0 || isBlocked) {
    logger.info('Input sanitization completed', {
      isBlocked,
      warnings,
      originalLength: input.length,
      sanitizedLength: sanitized.length,
      hasWarnings: warnings.length > 0
    });
  }
  
  return {
    sanitized,
    isBlocked,
    warnings
  };
}

/**
 * Validates context input before storing in database
 * @param context - User provided context string
 * @returns Object with validation result and sanitized context
 */
export function validateContextInput(context: string): { isValid: boolean; sanitizedContext: string; error?: string } {
  const result = sanitizeUserInput(context);
  
  if (result.isBlocked) {
    return {
      isValid: false,
      sanitizedContext: '',
      error: `Input blocked: ${result.warnings.join(', ')}`
    };
  }
  
  return {
    isValid: true,
    sanitizedContext: result.sanitized,
    error: result.warnings.length > 0 ? `Warnings: ${result.warnings.join(', ')}` : undefined
  };
}

/**
 * Checks business relevance of input content
 * @param input - Sanitized input text
 * @returns Relevance score between 0 and 1
 */
function checkBusinessRelevance(input: string): number {
  const lowerInput = input.toLowerCase();
  let matchCount = 0;
  let totalWords = lowerInput.split(/\s+/).length;
  
  // Count matches with business keywords
  for (const keyword of BUSINESS_RELEVANCE_KEYWORDS) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  
  // Calculate relevance score
  const relevanceScore = Math.min(matchCount / Math.max(totalWords * 0.1, 1), 1);
  return relevanceScore;
}

/**
 * Checks content quality for vague or repetitive content
 * @param input - Sanitized input text
 * @returns Array of quality issue warnings
 */
function checkContentQuality(input: string): string[] {
  const issues: string[] = [];
  const words = input.toLowerCase().split(/\s+/);
  const sentences = input.split(/[.!?]+/).filter(s => s.trim());
  
  // Check for vague content
  const vagueWords = ['thing', 'stuff', 'something', 'somehow', 'maybe', 'probably', 'might'];
  const vagueCount = words.filter(word => vagueWords.includes(word)).length;
  if (vagueCount > words.length * 0.1) {
    issues.push('Content appears vague - consider being more specific');
  }
  
  // Check for repetitive content
  const uniqueWords = new Set(words);
  if (uniqueWords.size < words.length * 0.5 && words.length > 10) {
    issues.push('Content appears repetitive - consider varying your language');
  }
  
  // Check for very short sentences (might indicate poor quality)
  const shortSentences = sentences.filter(s => s.trim().split(/\s+/).length < 3);
  if (shortSentences.length > sentences.length * 0.5 && sentences.length > 2) {
    issues.push('Content contains many short fragments - consider using complete sentences');
  }
  
  // Check for excessive capitalization
  const capsWords = words.filter(word => word === word.toUpperCase() && word.length > 2);
  if (capsWords.length > words.length * 0.2) {
    issues.push('Excessive capitalization detected - consider using normal case');
  }
  
  return issues;
}