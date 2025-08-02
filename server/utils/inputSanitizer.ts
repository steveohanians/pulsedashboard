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
  
  // Step 4: Remove HTML/Script tags
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
  
  // Step 5: Escape template literal patterns
  sanitized = sanitized
    .replace(/\$\{/g, '\\${')  // Escape template literals
    .replace(/`/g, '\\`');     // Escape backticks
  
  // Step 6: Escape curly braces for prompt template safety
  sanitized = sanitized
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
  
  // Step 7: Remove excessive whitespace and normalize
  sanitized = sanitized
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
    .trim();
  
  // Step 8: Final safety check - block if empty after sanitization
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