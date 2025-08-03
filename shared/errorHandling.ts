// Consolidated error handling patterns across client and server
// This eliminates duplicate error processing logic found in multiple files

import { ApiError, ApiResponse, HttpStatus } from './apiPatterns';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for consistent handling
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system'
}

/**
 * Standardized error interface
 */
export interface StandardError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Error logging utilities
 * Consolidates logging patterns from server routes
 */
export class ErrorLogger {
  static log(error: StandardError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = this.formatLogMessage(error);
    
    console[logLevel](logMessage);
    
    // In production, this would integrate with logging service
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error('🚨 CRITICAL ERROR - Immediate attention required', error);
    }
  }

  private static getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'error';
    }
  }

  private static formatLogMessage(error: StandardError): string {
    return `[${error.category.toUpperCase()}] ${error.message} (ID: ${error.id})`;
  }
}

/**
 * Error factory for creating standardized errors
 * Consolidates error creation patterns
 */
export class ErrorFactory {
  static validation(message: string, context?: Record<string, unknown>): StandardError {
    return this.create(message, ErrorCategory.VALIDATION, ErrorSeverity.MEDIUM, context);
  }

  static authentication(message: string = 'Authentication failed'): StandardError {
    return this.create(message, ErrorCategory.AUTHENTICATION, ErrorSeverity.HIGH);
  }

  static authorization(message: string = 'Insufficient permissions'): StandardError {
    return this.create(message, ErrorCategory.AUTHORIZATION, ErrorSeverity.HIGH);
  }

  static network(message: string = 'Network connection failed'): StandardError {
    return this.create(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM);
  }

  static database(message: string, context?: Record<string, unknown>): StandardError {
    return this.create(message, ErrorCategory.DATABASE, ErrorSeverity.HIGH, context);
  }

  static externalApi(service: string, message: string): StandardError {
    return this.create(
      `${service} API error: ${message}`,
      ErrorCategory.EXTERNAL_API,
      ErrorSeverity.MEDIUM,
      { service }
    );
  }

  static businessLogic(message: string, context?: Record<string, unknown>): StandardError {
    return this.create(message, ErrorCategory.BUSINESS_LOGIC, ErrorSeverity.MEDIUM, context);
  }

  static system(message: string, context?: Record<string, unknown>): StandardError {
    return this.create(message, ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL, context);
  }

  private static create(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: Record<string, unknown>
  ): StandardError {
    return {
      id: this.generateId(),
      message,
      category,
      severity,
      timestamp: new Date(),
      context,
      stack: new Error().stack
    };
  }

  private static generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Error recovery strategies
 * Consolidates retry and fallback patterns
 */
export class ErrorRecovery {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }
    
    throw ErrorFactory.system(
      `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
      { maxRetries, originalError: lastError.message }
    );
  }

  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      console.warn('Primary operation failed, using fallback:', error);
      return await fallback();
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Client-side error boundary utilities
 * Consolidates React error handling patterns
 */
export class ClientErrorHandler {
  static handleApiError(error: unknown): ApiError {
    if (error.name === 'AbortError') {
      return { message: 'Request was cancelled', code: 'CANCELLED' };
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { message: 'Network connection failed', code: 'NETWORK_ERROR' };
    }
    
    if (error.status) {
      return this.handleHttpError(error.status, error.message);
    }
    
    return { message: error.message || 'An unexpected error occurred', code: 'UNKNOWN' };
  }

  private static handleHttpError(status: number, message?: string): ApiError {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return { message: 'Please log in to continue', status, code: 'UNAUTHORIZED' };
      case HttpStatus.FORBIDDEN:
        return { message: 'You do not have permission to perform this action', status, code: 'FORBIDDEN' };
      case HttpStatus.NOT_FOUND:
        return { message: 'The requested resource was not found', status, code: 'NOT_FOUND' };
      case HttpStatus.VALIDATION_ERROR:
        return { message: message || 'Invalid input provided', status, code: 'VALIDATION' };
      case HttpStatus.INTERNAL_ERROR:
        return { message: 'Server error - please try again later', status, code: 'SERVER_ERROR' };
      default:
        return { message: message || 'An error occurred', status, code: 'HTTP_ERROR' };
    }
  }
}

/**
 * Server-side error middleware utilities
 * Consolidates Express error handling patterns
 */
export class ServerErrorHandler {
  static handleDatabaseError(error: unknown): StandardError {
    if (error.code === '23505') { // PostgreSQL unique violation
      return ErrorFactory.validation('Resource already exists', { sqlCode: error.code });
    }
    
    if (error.code === '23503') { // PostgreSQL foreign key violation
      return ErrorFactory.validation('Referenced resource does not exist', { sqlCode: error.code });
    }
    
    return ErrorFactory.database(error.message, { code: error.code });
  }

  static handleZodError(error: { errors?: Array<{ path: string[]; message: string }>; message: string }): StandardError {
    const messages = error.errors?.map((e: { path: string[]; message: string }) => `${e.path.join('.')}: ${e.message}`) || [error.message];
    return ErrorFactory.validation(messages.join(', '), { zodErrors: error.errors });
  }

  static convertToApiResponse(error: StandardError): ApiResponse {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return { success: false, error: error.message };
      case ErrorCategory.AUTHENTICATION:
        return { success: false, error: 'Authentication required' };
      case ErrorCategory.AUTHORIZATION:
        return { success: false, error: 'Insufficient permissions' };
      default:
        return { success: false, error: 'An error occurred while processing your request' };
    }
  }
}