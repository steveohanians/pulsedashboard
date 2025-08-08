// Client-side input validation using shared patterns for consistency

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

export function validateUserInput(input: string): ValidationResult {
  const warnings: string[] = [];
  let isValid = true;

  // Length and empty input checks
  if (input.length > VALIDATION_LIMITS.MAX_INPUT_LENGTH) {
    warnings.push(`Input exceeds ${VALIDATION_LIMITS.MAX_INPUT_LENGTH} characters (${input.length} characters)`);
  }

  if (!input.trim() || input.trim().length < VALIDATION_LIMITS.MIN_INPUT_LENGTH) {
    return { isValid: false, warnings: [], error: "Please provide meaningful context (at least 3 characters)" };
  }

  // Pattern validation checks
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { isValid: false, warnings: [], error: "Input contains patterns that could interfere with AI analysis" };
    }
  }

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(input)) {
      return { isValid: false, warnings: [], error: "Content contains inappropriate language" };
    }
  }

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(input)) {
      return { isValid: false, warnings: [], error: "Content appears off-topic for business analytics" };
    }
  }

  for (const pattern of HTML_SCRIPT_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push("HTML or script content detected and will be removed");
      break;
    }
  }

  // Special character check
  const specialCharCount = (input.match(/[{}$`\\]/g) || []).length;
  if (specialCharCount > 10) {
    warnings.push("Input contains many special characters which may be modified");
  }

  return { isValid, warnings };
}

// Sanitizes input for display only - server-side is authoritative
export function previewSanitizedInput(input: string): string {
  return input
    .trim()
    .substring(0, VALIDATION_LIMITS.MAX_INPUT_LENGTH)
    .replace(/\s+/g, ' ')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
}