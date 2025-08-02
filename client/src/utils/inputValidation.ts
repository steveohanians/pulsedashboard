/**
 * Client-side input validation for user context
 * This provides immediate feedback to users before sending to the server
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  error?: string;
}

// Basic prompt injection patterns for client-side detection
const BASIC_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /act\s+as\s+(a|an)\s+/gi,
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
];

// Basic HTML/Script patterns
const BASIC_HTML_PATTERNS = [
  /<script/gi,
  /<iframe/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

const MAX_LENGTH = 1000;

/**
 * Validates user input on the client side
 * Provides immediate feedback before server submission
 */
export function validateUserInput(input: string): ValidationResult {
  const warnings: string[] = [];
  let isValid = true;

  // Length check
  if (input.length > MAX_LENGTH) {
    warnings.push(`Input exceeds ${MAX_LENGTH} characters (${input.length} characters)`);
  }

  // Empty or too short check
  if (!input.trim() || input.trim().length < 3) {
    return {
      isValid: false,
      warnings: [],
      error: "Please provide meaningful context (at least 3 characters)"
    };
  }

  // Basic prompt injection detection
  for (const pattern of BASIC_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warnings: [],
        error: "Input contains patterns that could interfere with AI analysis"
      };
    }
  }

  // Basic HTML/Script detection
  for (const pattern of BASIC_HTML_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push("HTML or script content detected and will be removed");
      break;
    }
  }

  // Excessive special characters
  const specialCharCount = (input.match(/[{}$`\\]/g) || []).length;
  if (specialCharCount > 10) {
    warnings.push("Input contains many special characters which may be modified");
  }

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
    .substring(0, MAX_LENGTH)
    .replace(/\s+/g, ' ')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}');
}