// Consolidated response formatting patterns
// This eliminates duplicate response formatting across server routes

import { Response } from 'express';
import { ApiResponse, HttpStatus } from './apiPatterns';
import { StandardError, ServerErrorHandler } from './errorHandling';

/**
 * Standardized response sender
 * Consolidates response patterns from all server routes
 */
export class ResponseSender {
  /**
   * Send successful response
   */
  static success<T>(res: Response, data: T, message?: string, status: number = HttpStatus.OK): void {
    res.status(status).json({
      success: true,
      data,
      message
    });
  }

  /**
   * Send created response (201)
   */
  static created<T>(res: Response, data: T, message: string = 'Resource created successfully'): void {
    this.success(res, data, message, HttpStatus.CREATED);
  }

  /**
   * Send updated response
   */
  static updated<T>(res: Response, data: T, message: string = 'Resource updated successfully'): void {
    this.success(res, data, message);
  }

  /**
   * Send deleted response
   */
  static deleted(res: Response, message: string = 'Resource deleted successfully'): void {
    res.status(HttpStatus.OK).json({
      success: true,
      message
    });
  }

  /**
   * Send error response
   */
  static error(res: Response, message: string, status: number = HttpStatus.BAD_REQUEST): void {
    res.status(status).json({
      success: false,
      error: message
    });
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: string[]): void {
    res.status(HttpStatus.VALIDATION_ERROR).json({
      success: false,
      error: `Validation failed: ${errors.join(', ')}`,
      validationErrors: errors
    });
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(res: Response, message: string = 'Unauthorized access'): void {
    this.error(res, message, HttpStatus.UNAUTHORIZED);
  }

  /**
   * Send forbidden response
   */
  static forbidden(res: Response, message: string = 'Forbidden - insufficient permissions'): void {
    this.error(res, message, HttpStatus.FORBIDDEN);
  }

  /**
   * Send not found response
   */
  static notFound(res: Response, resource: string = 'Resource'): void {
    this.error(res, `${resource} not found`, HttpStatus.NOT_FOUND);
  }

  /**
   * Send conflict response
   */
  static conflict(res: Response, message: string): void {
    this.error(res, message, HttpStatus.CONFLICT);
  }

  /**
   * Send internal server error response
   */
  static internalError(res: Response, message: string = 'Internal server error'): void {
    this.error(res, message, HttpStatus.INTERNAL_ERROR);
  }

  /**
   * Send standardized error response
   */
  static standardError(res: Response, error: StandardError): void {
    const apiResponse = ServerErrorHandler.convertToApiResponse(error);
    const status = this.getStatusFromError(error);
    res.status(status).json(apiResponse);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response, 
    data: T[], 
    page: number, 
    limit: number, 
    total: number
  ): void {
    const totalPages = Math.ceil(total / limit);
    
    res.status(HttpStatus.OK).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  }

  /**
   * Send no content response (204)
   */
  static noContent(res: Response): void {
    res.status(HttpStatus.NO_CONTENT).send();
  }

  /**
   * Helper to determine HTTP status from error category
   */
  private static getStatusFromError(error: StandardError): number {
    switch (error.category) {
      case 'validation':
        return HttpStatus.VALIDATION_ERROR;
      case 'authentication':
        return HttpStatus.UNAUTHORIZED;
      case 'authorization':
        return HttpStatus.FORBIDDEN;
      case 'business_logic':
        return HttpStatus.BAD_REQUEST;
      case 'database':
      case 'system':
        return HttpStatus.INTERNAL_ERROR;
      default:
        return HttpStatus.INTERNAL_ERROR;
    }
  }
}

/**
 * Response middleware for consistent formatting
 * Adds helper methods to Express Response object
 */
export function enhanceResponse(res: Response): void {
  // Add helper methods to response object
  res.successResponse = function<T>(data: T, message?: string, status?: number) {
    return ResponseSender.success(this, data, message, status);
  };

  res.errorResponse = function(message: string, status?: number) {
    return ResponseSender.error(this, message, status);
  };

  res.validationError = function(errors: string[]) {
    return ResponseSender.validationError(this, errors);
  };

  res.notFoundResponse = function(resource?: string) {
    return ResponseSender.notFound(this, resource);
  };

  res.unauthorizedResponse = function(message?: string) {
    return ResponseSender.unauthorized(this, message);
  };

  res.forbiddenResponse = function(message?: string) {
    return ResponseSender.forbidden(this, message);
  };

  res.conflictResponse = function(message: string) {
    return ResponseSender.conflict(this, message);
  };

  res.internalErrorResponse = function(message?: string) {
    return ResponseSender.internalError(this, message);
  };
}

// Type augmentation for Express Response
declare global {
  namespace Express {
    interface Response {
      successResponse<T>(data: T, message?: string, status?: number): void;
      errorResponse(message: string, status?: number): void;
      validationError(errors: string[]): void;
      notFoundResponse(resource?: string): void;
      unauthorizedResponse(message?: string): void;
      forbiddenResponse(message?: string): void;
      conflictResponse(message: string): void;
      internalErrorResponse(message?: string): void;
    }
  }
}