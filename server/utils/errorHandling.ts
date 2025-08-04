/**
 * Error Handling Utilities - Comprehensive error management system
 * Addresses authentication failures, schema confusion, and API errors
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
  details?: any;
  hint?: string;
  timestamp: string;
  context?: ErrorContext;
}

/**
 * Error codes for consistent error handling
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

/**
 * Create a structured error with context
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
 * Enhanced error response handler with proper logging
 */
export function sendErrorResponse(
  res: Response,
  error: StructuredError,
  statusCode: number = 500
) {
  // Log the error with full context
  logger.error('API Error Response', {
    ...error,
    statusCode,
    stack: error.details?.stack
  });

  // Send clean error response to client
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

/**
 * Comprehensive error handler middleware
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

/**
 * Quick error response helpers
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

/**
 * Async error wrapper for route handlers
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

export default {
  createStructuredError,
  sendErrorResponse,
  errorHandler,
  ErrorResponses,
  asyncErrorHandler,
  ERROR_CODES
};