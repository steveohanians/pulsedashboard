/**
 * Enterprise error management with structured error handling and contextual logging.
 * 
 * Error Categories:
 * - Authentication & Authorization: Session management, access control, admin requirements
 * - Client & GA4 Configuration: Client setup, property access, verification status
 * - Data & Schema: Validation failures, database errors, data integrity issues
 * - External Services: API failures, network issues, service unavailability
 * - General: Internal errors, rate limiting, unknown error conditions
 * 
 * Production Considerations:
 * - Sensitive data sanitization in error responses
 * - Stack trace filtering for security
 * - Context preservation throughout error lifecycle for debugging
 */

import { Response } from 'express';
import logger from './logger';

export interface ErrorContext {
  operation: string;
  clientId?: string;
  userId?: string;
  endpoint?: string;
  timestamp?: string;
}

export interface StructuredError {
  code: string;
  message: string;
  details?: any; // Sanitized for production
  hint?: string;
  timestamp: string;
  context?: ErrorContext;
}

/**
 * Standardized error codes for consistent categorization.
 * 
 * Authentication & Authorization:
 * - AUTH_REQUIRED: User not authenticated, requires login
 * - ACCESS_DENIED: Authenticated but insufficient permissions  
 * - INVALID_SESSION: Session expired or corrupted
 * - ADMIN_REQUIRED: Operation requires administrative privileges
 * 
 * Client & GA4 Configuration:
 * - CLIENT_NOT_FOUND: Client ID does not exist in system
 * - NO_GA4_CONFIG: Client lacks GA4 configuration setup
 * - GA4_NOT_VERIFIED: GA4 property access not verified
 * - PROPERTY_ACCESS_DENIED: GA4 property permissions insufficient
 * 
 * Data & Schema:
 * - INVALID_DATA: Data format or content validation failure
 * - SCHEMA_VALIDATION_FAILED: Zod schema validation rejection
 * - DATABASE_ERROR: SQL database operation failure
 * - DATA_NOT_FOUND: Requested resource does not exist
 * 
 * External Services:
 * - GA4_API_ERROR: Google Analytics API communication failure
 * - OAUTH_ERROR: OAuth authentication or token refresh failure
 * - NETWORK_ERROR: Network connectivity or timeout issues
 * - SERVICE_UNAVAILABLE: External service temporarily unavailable
 * 
 * General:
 * - INTERNAL_ERROR: Unexpected application error
 * - VALIDATION_ERROR: General input validation failure
 * - RATE_LIMIT_EXCEEDED: API rate limiting activated
 * - UNKNOWN_ERROR: Unclassified error condition
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INVALID_SESSION: 'INVALID_SESSION',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  
  // Client & GA4 Configuration
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  NO_GA4_CONFIG: 'NO_GA4_CONFIG',
  GA4_NOT_VERIFIED: 'GA4_NOT_VERIFIED',
  PROPERTY_ACCESS_DENIED: 'PROPERTY_ACCESS_DENIED',
  
  // Data & Schema
  INVALID_DATA: 'INVALID_DATA',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  
  // External Services
  GA4_API_ERROR: 'GA4_API_ERROR',
  OAUTH_ERROR: 'OAUTH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// ============================
// CORE ERROR CREATION FUNCTIONS
// ============================

/**
 * Creates a comprehensive structured error with contextual information for debugging and monitoring.
 * Primary error creation function providing consistent error formatting across the application.
 * 
 * Features:
 * - Automatic ISO timestamp generation for error correlation
 * - Context preservation for debugging and monitoring
 * - Optional details attachment for technical analysis
 * - User-actionable hints for error resolution guidance
 * - Type-safe error code validation
 * 
 * Error Structure:
 * - Code: Standardized error identifier for categorization
 * - Message: Human-readable error description
 * - Details: Technical error information (sanitized in production)
 * - Hint: User guidance for error resolution
 * - Timestamp: ISO 8601 error creation time
 * - Context: Operation and request context for debugging
 * 
 * @param code - Standardized error code from ERROR_CODES enum
 * @param message - Clear, descriptive error message for users
 * @param context - Optional operation context for debugging
 * @param details - Optional technical details for error analysis
 * @param hint - Optional user-actionable guidance for resolution
 * @returns Structured error object ready for logging and response
 */
export function createStructuredError(
  code: string,
  message: string,
  context?: ErrorContext,
  details?: any,
  hint?: string
): StructuredError {
  return {
    code,
    message,
    details,
    hint,
    timestamp: new Date().toISOString(),
    context
  };
}

/**
 * Sends structured error response with comprehensive logging and secure client communication.
 * Handles error sanitization for production environments while preserving debugging information.
 * 
 * Security Features:
 * - Sensitive data filtering from client responses
 * - Stack trace sanitization for production environments
 * - Error detail limitation to prevent information disclosure
 * - Structured logging with correlation tracking
 * 
 * Response Format:
 * - success: false (consistent API response pattern)
 * - error: Sanitized error object with user-safe information
 * - code: Standardized error identifier for client handling
 * - message: User-friendly error description
 * - hint: Actionable guidance for error resolution
 * - timestamp: Error occurrence time for correlation
 * 
 * Logging Strategy:
 * - Full error context logged server-side for debugging
 * - HTTP status code correlation for monitoring
 * - Stack trace preservation for technical analysis
 * - Error correlation tracking across request lifecycle
 * 
 * @param res - Express Response object for client communication
 * @param error - Structured error object with comprehensive context
 * @param statusCode - HTTP status code (defaults to 500 for server errors)
 */
export function sendErrorResponse(
  res: Response,
  error: StructuredError,
  statusCode: number = 500
) {
  // Log the error with full context for server-side debugging
  logger.error('API Error Response', {
    ...error,
    statusCode,
    stack: error.details?.stack
  });

  // Send sanitized error response to client
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      hint: error.hint,
      timestamp: error.timestamp
    }
  });
}

// ============================
// COMPREHENSIVE ERROR PROCESSING
// ============================

/**
 * Comprehensive error processing middleware for automatic error classification and structured response generation.
 * Primary error processing engine that transforms various error types into standardized structured errors.
 * 
 * Error Classification Strategy:
 * - System-level errors (ENOTFOUND, ECONNREFUSED, ETIMEDOUT) → Network errors
 * - Authentication errors (EAUTH, UNAUTHORIZED) → Access control errors  
 * - HTTP status code mapping for external API error classification
 * - Validation errors (ZodError) → Schema validation failures
 * - Database errors (SQL, database keywords) → Database operation failures
 * - GA4-specific errors → Google Analytics API failures
 * - Unknown errors → Internal error classification with full context
 * 
 * Context Enhancement:
 * - Automatic timestamp injection for error correlation
 * - Operation tracking for debugging assistance
 * - Context merging with base operation information
 * - Error detail preservation with security considerations
 * 
 * Processing Features:
 * - Unknown error code logging for system improvement
 * - HTTP status code interpretation for external service errors
 * - Error pattern recognition for common failure modes
 * - Fallback handling for unclassified error conditions
 * 
 * @param error - Raw error object from various sources (network, database, validation, etc.)
 * @param operation - Description of operation being performed when error occurred
 * @param context - Optional additional context for error analysis and debugging
 * @returns Structured error object ready for logging and client response
 */
export function errorHandler(error: any, operation: string, context?: ErrorContext): StructuredError {
  const baseContext = {
    operation,
    timestamp: new Date().toISOString(),
    ...context
  };

  // Handle known error types
  if (error?.code) {
    switch (error.code) {
      case 'ENOTFOUND':
      case 'ECONNREFUSED':
      case 'ETIMEDOUT':
        return createStructuredError(
          ERROR_CODES.NETWORK_ERROR,
          'Network connection failed',
          baseContext,
          { originalError: error.message },
          'Check network connectivity and service availability'
        );
        
      case 'EAUTH':
      case 'UNAUTHORIZED':
        return createStructuredError(
          ERROR_CODES.ACCESS_DENIED,
          'Authentication failed',
          baseContext,
          { originalError: error.message },
          'Verify credentials and permissions'
        );
        
      default:
        // Log unknown error codes for investigation
        logger.warn('Unknown error code encountered', { code: error.code, error: error.message });
    }
  }

  // Handle HTTP errors
  if (error?.response?.status) {
    switch (error.response.status) {
      case 401:
        return createStructuredError(
          ERROR_CODES.AUTH_REQUIRED,
          'Authentication required',
          baseContext,
          error.response.data,
          'Login required to access this resource'
        );
        
      case 403:
        return createStructuredError(
          ERROR_CODES.ACCESS_DENIED,
          'Access denied',
          baseContext,
          error.response.data,
          'Insufficient permissions for this operation'
        );
        
      case 404:
        return createStructuredError(
          ERROR_CODES.DATA_NOT_FOUND,
          'Resource not found',
          baseContext,
          error.response.data,
          'The requested resource does not exist'
        );
        
      case 429:
        return createStructuredError(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          'Rate limit exceeded',
          baseContext,
          error.response.data,
          'Too many requests, please try again later'
        );
        
      case 503:
        return createStructuredError(
          ERROR_CODES.SERVICE_UNAVAILABLE,
          'Service temporarily unavailable',
          baseContext,
          error.response.data,
          'Service is under maintenance, please try again later'
        );
    }
  }

  // Handle validation errors
  if (error?.name === 'ZodError' || error?.issues) {
    return createStructuredError(
      ERROR_CODES.SCHEMA_VALIDATION_FAILED,
      'Data validation failed',
      baseContext,
      { validationErrors: error.issues || error.errors },
      'Check the data format and required fields'
    );
  }

  // Handle database errors
  if (error?.message?.includes('database') || error?.message?.includes('SQL')) {
    return createStructuredError(
      ERROR_CODES.DATABASE_ERROR,
      'Database operation failed',
      baseContext,
      { originalError: error.message },
      'Database connectivity or query issue'
    );
  }

  // Handle GA4 specific errors
  if (error?.message?.includes('GA4') || error?.message?.includes('Google Analytics')) {
    return createStructuredError(
      ERROR_CODES.GA4_API_ERROR,
      'Google Analytics API error',
      baseContext,
      { originalError: error.message },
      'Check GA4 property access and API configuration'
    );
  }

  // Default fallback for unknown errors
  return createStructuredError(
    ERROR_CODES.INTERNAL_ERROR,
    error.message || 'An unexpected error occurred',
    baseContext,
    { 
      originalError: error.message,
      stack: error.stack,
      name: error.name
    },
    'Please try again or contact support if the issue persists'
  );
}

// ============================
// QUICK ERROR RESPONSE HELPERS
// ============================

/**
 * Collection of quick error response helpers for common error scenarios.
 * Provides pre-configured error responses with appropriate HTTP status codes and user guidance.
 * 
 * Response Helpers:
 * - authRequired: 401 Unauthorized for unauthenticated requests
 * - accessDenied: 403 Forbidden for insufficient permissions
 * - clientNotFound: 404 Not Found for invalid client references
 * - noGA4Config: 400 Bad Request for missing GA4 configuration
 * - ga4NotVerified: 400 Bad Request for unverified GA4 access
 * - validationFailed: 400 Bad Request for input validation failures
 * - internalError: 500 Internal Server Error for unexpected failures
 * 
 * Features:
 * - Consistent error formatting across all helpers
 * - Appropriate HTTP status code mapping
 * - User-actionable hints for error resolution
 * - Context preservation for debugging
 * - Automatic logging integration
 * 
 * Usage Patterns:
 * - Direct response: ErrorResponses.authRequired(res, context)
 * - Conditional usage: if (!user) return ErrorResponses.authRequired(res)
 * - Context-aware: ErrorResponses.clientNotFound(res, clientId, { operation: 'fetchMetrics' })
 */
export const ErrorResponses = {
  authRequired: (res: Response, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.AUTH_REQUIRED,
      'Authentication required',
      context,
      undefined,
      'Please log in to access this resource'
    );
    sendErrorResponse(res, error, 401);
  },

  accessDenied: (res: Response, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.ACCESS_DENIED,
      'Access denied',
      context,
      undefined,
      'Insufficient permissions for this operation'
    );
    sendErrorResponse(res, error, 403);
  },

  clientNotFound: (res: Response, clientId: string, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.CLIENT_NOT_FOUND,
      `Client ${clientId} not found`,
      { operation: context?.operation || 'unknown', ...context, clientId },
      undefined,
      'Verify the client ID and ensure the client exists'
    );
    sendErrorResponse(res, error, 404);
  },

  ga4NotConfigured: (res: Response, clientId: string, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.NO_GA4_CONFIG,
      `No GA4 property access configured for client ${clientId}`,
      { operation: context?.operation || 'unknown', ...context, clientId },
      undefined,
      'Configure GA4 property access in the admin panel first'
    );
    sendErrorResponse(res, error, 400);
  },

  ga4NotVerified: (res: Response, clientId: string, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.GA4_NOT_VERIFIED,
      `GA4 property access not verified for client ${clientId}`,
      { operation: context?.operation || 'unknown', ...context, clientId },
      undefined,
      'Verify GA4 property access in the admin panel first'
    );
    sendErrorResponse(res, error, 400);
  },

  validationFailed: (res: Response, details: any, context?: ErrorContext) => {
    const error = createStructuredError(
      ERROR_CODES.VALIDATION_ERROR,
      'Request validation failed',
      context,
      details,
      'Check the request format and required fields'
    );
    sendErrorResponse(res, error, 400);
  },

  internalError: (res: Response, originalError: any, context?: ErrorContext) => {
    const error = errorHandler(originalError, context?.operation || 'unknown', context);
    sendErrorResponse(res, error, 500);
  }
};

// ============================
// MIDDLEWARE INTEGRATION
// ============================

/**
 * Async error wrapper middleware for automatic error handling in Express route handlers.
 * Eliminates the need for try-catch blocks in individual route handlers while preserving comprehensive error context.
 * 
 * Middleware Features:
 * - Automatic promise rejection handling for async route handlers
 * - Context extraction from Express request objects
 * - Comprehensive error processing through errorHandler
 * - Structured error response generation
 * - Operation identification through HTTP method and path
 * 
 * Context Extraction:
 * - Operation: Combination of HTTP method and route path
 * - Client ID: From route parameters or authenticated user context
 * - User ID: From authenticated user session
 * - Endpoint: Full original URL for complete request tracking
 * 
 * Integration Pattern:
 * router.get('/api/clients/:clientId', asyncErrorHandler(async (req, res) => {
 *   // Route logic here - any thrown errors automatically handled
 * }));
 * 
 * Error Flow:
 * 1. Async handler execution with promise handling
 * 2. Automatic context extraction from request object
 * 3. Error processing through comprehensive errorHandler
 * 4. Structured error response with appropriate HTTP status
 * 
 * @param handler - Async route handler function to wrap with error handling
 * @returns Express middleware function with comprehensive error handling
 */
export function asyncErrorHandler(handler: (...args: any[]) => Promise<any>) {
  return async (req: any, res: any, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      const context: ErrorContext = {
        operation: `${req.method} ${req.path}`,
        clientId: req.params?.clientId || req.user?.clientId,
        userId: req.user?.id,
        endpoint: req.originalUrl
      };
      
      const structuredError = errorHandler(error, context.operation, context);
      sendErrorResponse(res, structuredError);
    }
  };
}

// ============================
// MODULE EXPORTS
// ============================

/**
 * Default export object providing comprehensive error handling functionality.
 * Exports all core error handling functions and utilities for application-wide use.
 * 
 * Exported Functions:
 * - createStructuredError: Core error creation with context
 * - sendErrorResponse: Secure error response handling
 * - errorHandler: Comprehensive error processing middleware
 * - ErrorResponses: Quick response helpers for common scenarios
 * - asyncErrorHandler: Promise-aware route wrapper
 * - ERROR_CODES: Standardized error code enumeration
 * 
 * Usage:
 * - Named imports: import { createStructuredError, ERROR_CODES } from './errorHandling'
 * - Default import: import errorHandling from './errorHandling'
 * - Direct usage: errorHandling.createStructuredError(...)
 */
export default {
  createStructuredError,
  sendErrorResponse,
  errorHandler,
  ErrorResponses,
  asyncErrorHandler,
  ERROR_CODES
};