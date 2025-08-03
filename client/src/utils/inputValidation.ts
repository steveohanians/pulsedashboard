/**
 * Client-side input validation for user context - consolidated patterns
 * Uses shared validation patterns to ensure consistency with server-side validation
 * This provides immediate feedback to users before sending to the server
 */

import { 
  PROMPT_INJECTION_PATTERNS, 
  HTML_SCRIPT_PATTERNS, 
  PROFANITY_PATTERNS, 
  OFF_TOPIC_PATTERNS,
  VALIDATION_LIMITS
} from '@shared/validationPatterns';

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  error?: string;
}

/**
 * Validates user input on the client side
 * Provides immediate feedback before server submission
 */
export function validateUserInput(input: string): ValidationResult {
  const warnings: string[] = [];
  let isValid = true;

  // Length check using consolidated limits
  if (input.length > VALIDATION_LIMITS.MAX_INPUT_LENGTH) {
    warnings.push(`Input exceeds ${VALIDATION_LIMITS.MAX_INPUT_LENGTH} characters (${input.length} characters)`);
  }

  // Empty or too short check
  if (!input.trim() || input.trim().length < VALIDATION_LIMITS.MIN_INPUT_LENGTH) {
    return {
      isValid: false,
      warnings: [],
      error: "Please provide meaningful context (at least 3 characters)"
    };
  }

  // Prompt injection detection using consolidated patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warnings: [],
        error: "Input contains patterns that could interfere with AI analysis"
      };
    }
  }

  // HTML/Script detection using consolidated patterns
  for (const pattern of HTML_SCRIPT_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push("HTML or script content detected and will be removed");
      break;
    }
  }

  // Profanity detection using consolidated patterns
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warnings: [],
        error: "Content contains inappropriate language"
      };
    }
  }

  // Off-topic detection using consolidated patterns
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warnings: [],
        error: "Content appears off-topic for business analytics"
      };
    }
  }

  // Excessive special characters
  const specialCharCount = (input.match(/[{}$`\\]/g) || []).length;
  if (specialCharCount > 10) {
    warnings.push("Input contains many special characters which may be modified");
  }

  // Removed validation warnings per user request - keeping only character count

  return {
    isValid,
    warnings,
  };
}

/**
 * Sanitizes input for display purposes only
 * Server-side sanitization is the authoritative version
 */
export function previewSanitizedInput(input: string): string {
  return input
    .trim()
    .substring(0, VALIDATION_LIMITS.MAX_INPUT_LENGTH)
    .replace(/\s+/g, ' ')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
}