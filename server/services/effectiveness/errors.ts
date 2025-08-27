/**
 * Effectiveness Insights Error Classes
 * 
 * Custom error classes specific to effectiveness insights generation.
 * Extends the base error handling system with domain-specific errors.
 */

import { ERROR_CODES } from '../../utils/errorHandling';

/**
 * Base class for all effectiveness-related errors
 */
export abstract class EffectivenessError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  public readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Access-related errors
 */
export class AccessDeniedError extends EffectivenessError {
  readonly code = ERROR_CODES.ACCESS_DENIED;
  readonly statusCode = 403;

  constructor(message: string = 'Access denied', context?: Record<string, any>) {
    super(message, context);
  }
}

export class AuthenticationRequiredError extends EffectivenessError {
  readonly code = ERROR_CODES.AUTH_REQUIRED;
  readonly statusCode = 401;

  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Data-related errors
 */
export class DataNotFoundError extends EffectivenessError {
  readonly code = ERROR_CODES.DATA_NOT_FOUND;
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string, context?: Record<string, any>) {
    const message = identifier 
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, { resource, identifier, ...context });
  }
}

export class InvalidDataError extends EffectivenessError {
  readonly code = ERROR_CODES.INVALID_DATA;
  readonly statusCode = 400;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class DataIntegrityError extends EffectivenessError {
  readonly code = ERROR_CODES.DATABASE_ERROR;
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends EffectivenessError {
  readonly code = ERROR_CODES.VALIDATION_ERROR;
  readonly statusCode = 400;
  public readonly errors: string[];

  constructor(message: string, errors: string[] = [], context?: Record<string, any>) {
    super(message, { errors, ...context });
    this.errors = errors;
  }

  static fromValidationResult(result: { errors: Array<{ message: string }> }, context?: Record<string, any>) {
    const errors = result.errors.map(e => e.message);
    return new ValidationError('Validation failed', errors, context);
  }
}

export class SchemaValidationError extends ValidationError {
  readonly code = ERROR_CODES.SCHEMA_VALIDATION_FAILED;

  constructor(message: string = 'Schema validation failed', errors: string[] = [], context?: Record<string, any>) {
    super(message, errors, context);
  }
}

/**
 * AI/External Service errors
 */
export class AIServiceError extends EffectivenessError {
  readonly code = 'AI_SERVICE_ERROR' as const;
  readonly statusCode = 503 as const;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(
    message: string, 
    provider: string = 'openai',
    retryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, { provider, retryable, ...context });
    this.provider = provider;
    this.retryable = retryable;
  }
}

export class AIRateLimitError extends EffectivenessError {
  readonly code = ERROR_CODES.RATE_LIMIT_EXCEEDED;
  readonly statusCode = 429;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(message: string = 'AI service rate limit exceeded', context?: Record<string, any>) {
    super(message, { retryAfter: 60, ...context });
    this.provider = 'openai';
    this.retryable = true;
  }
}

export class AITimeoutError extends EffectivenessError {
  readonly code = 'AI_TIMEOUT_ERROR';
  readonly statusCode = 504;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(timeoutMs: number, context?: Record<string, any>) {
    super(`AI service timeout after ${timeoutMs}ms`, { timeoutMs, ...context });
    this.provider = 'openai';
    this.retryable = true;
  }
}

export class AIQuotaExceededError extends EffectivenessError {
  readonly code = 'AI_QUOTA_EXCEEDED';
  readonly statusCode = 429;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(message: string = 'AI service quota exceeded', context?: Record<string, any>) {
    super(message, context);
    this.provider = 'openai';
    this.retryable = false;
  }
}

export class AIResponseError extends EffectivenessError {
  readonly code = 'AI_RESPONSE_ERROR';
  readonly statusCode = 502;
  public readonly provider: string;
  public readonly retryable: boolean;
  public readonly responseData?: any;

  constructor(
    message: string,
    responseData?: any,
    context?: Record<string, any>
  ) {
    super(message, { responseData, ...context });
    this.provider = 'openai';
    this.retryable = true;
    this.responseData = responseData;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends EffectivenessError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: Record<string, any>) {
    super(message, { configKey, ...context });
    this.configKey = configKey;
  }
}

export class MissingConfigurationError extends EffectivenessError {
  readonly code = 'MISSING_CONFIGURATION';
  readonly statusCode = 500;
  public readonly configKey: string;

  constructor(configKey: string, context?: Record<string, any>) {
    super(`Missing required configuration: ${configKey}`, { configKey, ...context });
    this.configKey = configKey;
  }
}

/**
 * Business Logic errors
 */
export class BusinessLogicError extends EffectivenessError {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly statusCode = 422;
  public readonly rule: string;

  constructor(message: string, rule: string, context?: Record<string, any>) {
    super(message, { rule, ...context });
    this.rule = rule;
  }
}

export class InsightsGenerationError extends EffectivenessError {
  readonly code = 'INSIGHTS_GENERATION_FAILED';
  readonly statusCode = 500;
  public readonly attempt: number;
  public readonly lastError?: Error;

  constructor(
    message: string,
    attempt: number = 1,
    lastError?: Error,
    context?: Record<string, any>
  ) {
    super(message, { attempt, lastError: lastError?.message, ...context });
    this.attempt = attempt;
    this.lastError = lastError;
  }
}

/**
 * Resource limit errors
 */
export class ResourceLimitError extends EffectivenessError {
  readonly code = 'RESOURCE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  public readonly resource: string;
  public readonly limit: number;
  public readonly current: number;

  constructor(
    resource: string,
    limit: number,
    current: number,
    context?: Record<string, any>
  ) {
    super(
      `${resource} limit exceeded: ${current}/${limit}`,
      { resource, limit, current, ...context }
    );
    this.resource = resource;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Error factory functions for common scenarios
 */
export const ErrorFactory = {
  /**
   * Creates appropriate error for missing resources
   */
  notFound(resource: string, identifier?: string, context?: Record<string, any>) {
    return new DataNotFoundError(resource, identifier, context);
  },

  /**
   * Creates validation error from validation results
   */
  validation(errors: string[], context?: Record<string, any>) {
    return new ValidationError('Validation failed', errors, context);
  },

  /**
   * Creates AI service error based on the original error
   */
  aiService(originalError: any, context?: Record<string, any>): EffectivenessError {
    const message = originalError.message || 'AI service error';
    
    // Check for specific error types
    if (originalError.code === 'rate_limit' || 
        originalError.status === 429 ||
        message.toLowerCase().includes('rate limit')) {
      return new AIRateLimitError(message, context);
    }
    
    if (originalError.code === 'timeout' || 
        message.toLowerCase().includes('timeout')) {
      return new AITimeoutError(30000, context);
    }
    
    if (originalError.status === 402 || 
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('insufficient')) {
      return new AIQuotaExceededError(message, context);
    }
    
    // Default AI service error
    return new AIServiceError(message, 'openai', true, context);
  },

  /**
   * Creates access denied error with context
   */
  accessDenied(userId?: string, resource?: string, context?: Record<string, any>) {
    const message = resource 
      ? `Access denied to ${resource}`
      : 'Access denied';
    
    return new AccessDeniedError(message, { userId, resource, ...context });
  },

  /**
   * Creates configuration error
   */
  missingConfig(configKey: string, context?: Record<string, any>) {
    return new MissingConfigurationError(configKey, context);
  }
};

/**
 * Error classification utility
 */
export class ErrorClassifier {
  /**
   * Determines if an error is retryable
   */
  static isRetryable(error: Error): boolean {
    // Check for specific error types with retryable property
    if ('retryable' in error) {
      return (error as any).retryable;
    }
    
    if (error instanceof EffectivenessError) {
      // Generally, 5xx errors are retryable, 4xx are not
      return error.statusCode >= 500;
    }
    
    // Check error message for retryable conditions
    const message = error.message.toLowerCase();
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('temporary') ||
           message.includes('unavailable');
  }

  /**
   * Determines the severity of an error
   */
  static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof EffectivenessError) {
      if (error.statusCode >= 500) {
        return 'critical';
      } else if (error.statusCode >= 400) {
        return 'medium';
      }
      return 'low';
    }
    
    return 'high'; // Default for unknown errors
  }

  /**
   * Extracts user-facing message from error
   */
  static getUserMessage(error: Error): string {
    if (error instanceof EffectivenessError) {
      // For some errors, we want to hide technical details
      if (error instanceof AIServiceError) {
        return 'AI service is temporarily unavailable. Please try again later.';
      }
      
      return error.message;
    }
    
    // Generic message for unknown errors
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Determines appropriate HTTP status code
   */
  static getStatusCode(error: Error): number {
    if (error instanceof EffectivenessError) {
      return error.statusCode;
    }
    
    return 500; // Default to internal server error
  }
}