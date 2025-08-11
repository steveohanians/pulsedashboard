/**
 * Standardized Error Types and Codes
 * 
 * This module defines the standardized error codes and types used across
 * the application for consistent error handling and UI feedback.
 */

export const ERROR_CODES = {
  // Schema and Contract Errors
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  
  // Authentication and Authorization Errors  
  GA4_AUTH: 'GA4_AUTH',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Rate Limiting and Quota Errors
  GA4_QUOTA: 'GA4_QUOTA',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Data State Errors
  NO_DATA: 'NO_DATA',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  
  // General Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Standard HTTP status codes for each error type
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [ERROR_CODES.SCHEMA_MISMATCH]: 422,
  [ERROR_CODES.GA4_AUTH]: 401,
  [ERROR_CODES.UNAUTHENTICATED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.GA4_QUOTA]: 429,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.NO_DATA]: 200, // Special case: successful request with no data
  [ERROR_CODES.CLIENT_NOT_FOUND]: 404,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.NETWORK_ERROR]: 503
};

/**
 * Standardized error response interface
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    hint?: string;
    retryable?: boolean;
    retryAfter?: number; // seconds
  };
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Success response with no data indicator
 */
export interface NoDataResponse {
  success: true;
  data: any[];
  meta: {
    noData: true;
    reason?: string;
    lastDataDate?: string;
  };
  timestamp: string;
}

/**
 * Typed error class for standardized error handling
 */
export class PulseError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = ERROR_STATUS_CODES[code],
    public hint?: string,
    public retryable: boolean = false,
    public retryAfter?: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PulseError';
  }

  toResponse(): StandardErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        hint: this.hint,
        retryable: this.retryable,
        retryAfter: this.retryAfter
      },
      timestamp: new Date().toISOString(),
      context: this.context
    };
  }
}

/**
 * Error factory functions for common error scenarios
 */
export const ErrorFactory = {
  schemaMismatch: (details?: string): PulseError => 
    new PulseError(
      ERROR_CODES.SCHEMA_MISMATCH,
      `Data contract has changed${details ? `: ${details}` : ''}`,
      422,
      'Data structure has been updated. Please retry or contact admin if issues persist.',
      true
    ),

  ga4Auth: (reason?: string): PulseError =>
    new PulseError(
      ERROR_CODES.GA4_AUTH,
      `GA4 authentication failed${reason ? `: ${reason}` : ''}`,
      401,
      'GA4 access needs to be reconnected. Please check authentication settings.',
      false
    ),

  ga4Quota: (retryAfter?: number): PulseError =>
    new PulseError(
      ERROR_CODES.GA4_QUOTA,
      'GA4 API quota exceeded',
      429,
      'GA4 quota limit reached. Please try again later.',
      true,
      retryAfter || 3600 // Default 1 hour
    ),

  noData: (reason?: string): NoDataResponse => ({
    success: true,
    data: [],
    meta: {
      noData: true,
      reason: reason || 'No data available for the selected period',
      lastDataDate: undefined
    },
    timestamp: new Date().toISOString()
  }),

  clientNotFound: (clientId: string): PulseError =>
    new PulseError(
      ERROR_CODES.CLIENT_NOT_FOUND,
      `Client not found: ${clientId}`,
      404,
      'Verify the client ID and ensure the client exists',
      false,
      undefined,
      { clientId }
    )
};

/**
 * Type guard to check if response is a no-data response
 */
export function isNoDataResponse(response: any): response is NoDataResponse {
  return response.success === true && response.meta?.noData === true;
}

/**
 * Type guard to check if response is an error response
 */
export function isErrorResponse(response: any): response is StandardErrorResponse {
  return response.success === false && response.error?.code;
}