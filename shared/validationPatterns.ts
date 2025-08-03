// Consolidated validation patterns to eliminate duplication between client/server
// This ensures consistent validation logic across frontend and backend

/**
 * Prompt injection patterns - shared between client and server validation
 * Consolidates patterns from client/src/utils/inputValidation.ts and server/utils/inputSanitizer.ts
 */
export const PROMPT_INJECTION_PATTERNS = [
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

/**
 * HTML/Script patterns - shared validation for security
 * Consolidates patterns from both client and server validation
 */
export const HTML_SCRIPT_PATTERNS = [
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

/**
 * Profanity patterns - shared content filtering
 * Consolidates patterns from both client and server validation
 */
export const PROFANITY_PATTERNS = [
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

/**
 * Off-topic patterns - content relevance filtering
 * Consolidates patterns from both client and server validation
 */
export const OFF_TOPIC_PATTERNS = [
  /\b(joke|funny|lol|haha|meme)\b/gi,
  /what\s+is\s+the\s+(weather|time|date)/gi,
  /\b(i hate|i love|my life|my problems)\b/gi,
  /tell\s+me\s+about\s+(yourself|your|how|what)/gi,
  /\b(random|unrelated|off.topic)\b/gi,
];

/**
 * Content quality patterns - ensures meaningful input
 */
export const QUALITY_PATTERNS = {
  tooShort: /^.{1,2}$/,
  repeatedChars: /(.)\1{4,}/g,
  excessive_caps: /[A-Z]{10,}/g,
  excessive_punctuation: /[!?]{3,}|[.]{4,}/g,
};

/**
 * Character limits - consistent across client/server
 */
export const VALIDATION_LIMITS = {
  MAX_INPUT_LENGTH: 2000,
  MIN_INPUT_LENGTH: 3,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
  MAX_URL_LENGTH: 500,
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PROMPT_LENGTH: 5000,
  MAX_COMPANY_NAME: 100,
  MIN_COMPANY_NAME: 2,
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedInput?: string;
}

/**
 * Shared validation function for consistency
 */
export function validateInputContent(input: string): ValidationResult {
  const errors: string[] = [];
  
  // Length validation
  if (input.length < VALIDATION_LIMITS.MIN_INPUT_LENGTH) {
    errors.push('Input is too short');
  }
  if (input.length > VALIDATION_LIMITS.MAX_INPUT_LENGTH) {
    errors.push('Input is too long');
  }
  
  // Prompt injection detection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potential prompt injection');
      break;
    }
  }
  
  // HTML/Script detection
  for (const pattern of HTML_SCRIPT_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially dangerous HTML/scripts');
      break;
    }
  }
  
  // Profanity detection
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains inappropriate content');
      break;
    }
  }
  
  // Off-topic detection
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input appears to be off-topic');
      break;
    }
  }
  
  // Quality checks
  if (QUALITY_PATTERNS.tooShort.test(input)) {
    errors.push('Input is too short to be meaningful');
  }
  if (QUALITY_PATTERNS.repeatedChars.test(input)) {
    errors.push('Input contains excessive repeated characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedInput: input.trim()
  };
}