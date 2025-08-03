// Centralized error handling utilities
// Consolidates repeated error handling patterns found across API routes

import { Request, Response } from 'express';
import logger from './logger';

/**
 * Standard error response interface
 */
interface ErrorResponse {
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}

/**
 * Centralized error handler for API routes
 * Consolidates the try/catch + logger.error + res.status pattern
 */
export function handleApiError(
  error: Error & { status?: number; statusCode?: number }, 
  req: Request, 
  res: Response, 
  context: string = 'API operation'
): void {
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal server error";

  logger.error(`${context} failed`, { 
    status, 
    message, 
    path: req.path,
    method: req.method,
    stack: error.stack
  });
  
  res.status(status).json({ message });
}

/**
 * Async route wrapper that catches errors and handles them consistently
 * Eliminates the need for try/catch in every route handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<unknown>
) {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch(error => 
      handleApiError(error, req, res, `${req.method} ${req.path}`)
    );
  };
}

/**
 * Validation error helper
 * Standardizes validation error responses
 */
export function createValidationError(message: string, details?: Record<string, unknown>): ErrorResponse {
  return {
    message,
    status: 400,
    details
  };
}

/**
 * Not found error helper
 */
export function createNotFoundError(resource: string): ErrorResponse {
  return {
    message: `${resource} not found`,
    status: 404
  };
}

/**
 * Forbidden error helper
 */
export function createForbiddenError(message: string = "Access denied"): ErrorResponse {
  return {
    message,
    status: 403
  };
}

/**
 * Unauthorized error helper
 */
export function createUnauthorizedError(message: string = "Authentication required"): ErrorResponse {
  return {
    message,
    status: 401
  };
}

/**
 * Database operation wrapper with error handling
 * Consolidates database error handling patterns
 */
export async function withDbErrorHandling<T>(
  operation: () => Promise<T>,
  context: string = 'Database operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    logger.error(`${context} failed`, { 
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}