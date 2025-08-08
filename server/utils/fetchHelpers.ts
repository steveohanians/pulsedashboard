/**
 * Fetch Helpers - Comprehensive utilities for authenticated API requests and data validation.
 * Provides robust middleware, error handling, and data fetching capabilities for secure API operations.
 * 
 * Core Features:
 * - Client validation and GA4 configuration middleware
 * - Safe data fetching with comprehensive error handling
 * - Schema validation and type checking utilities
 * - Standardized error response formatting
 * - Authentication helpers for secure API requests
 * 
 * Integration Capabilities:
 * - Database schema validation with Drizzle ORM
 * - GA4 property access verification
 * - Structured error responses with operation context
 * - Comprehensive logging for debugging and monitoring
 * 
 * @module FetchHelpers
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { clients, ga4PropertyAccess, metrics } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import logger from './logger';

// ============================
// TYPE DEFINITIONS
// ============================

/**
 * Enhanced Express Request interface with authentication and client context.
 * Extends base Request to include user session, client data, and GA4 property access information.
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user session data */
  user?: any;
  /** Validated client configuration data */
  client?: any;
  /** GA4 property access configuration and verification status */
  propertyAccess?: any;
}

// ============================
// SCHEMA CONSTANTS
// ============================

/**
 * Centralized database schema constants for consistent data validation and type checking.
 * Provides authoritative reference for source types, metric names, and column definitions.
 */
export const SCHEMA_CONSTANTS = {
  /** Valid data source types for metrics and benchmarking */
  SOURCE_TYPES: ['Client', 'CD_Avg', 'Industry', 'Competitor', 'Industry_Avg', 'Competitor_Avg'] as const,
  
  /** Supported metric names for analytics and benchmarking */
  METRIC_NAMES: [
    'Bounce Rate',
    'Session Duration', 
    'Pages per Session',
    'Sessions per User',
    'Traffic Channels',
    'Device Distribution'
  ] as const,
  
  /** Database column name mappings for consistent schema access */
  COLUMNS: {
    METRICS: {
      ID: 'id',
      CLIENT_ID: 'client_id',
      COMPETITOR_ID: 'competitor_id',
      METRIC_NAME: 'metric_name',
      VALUE: 'value',
      SOURCE_TYPE: 'source_type',
      TIME_PERIOD: 'time_period',
      CHANNEL: 'channel',
      CREATED_AT: 'created_at'
    }
  }
} as const;

// ============================
// VALIDATION MIDDLEWARE
// ============================

/**
 * Comprehensive client validation middleware for secure API operations.
 * Validates client existence, GA4 property configuration, and access verification status.
 * 
 * Features:
 * - Client existence validation with database lookup
 * - GA4 property access configuration verification
 * - Access permission and verification status checking
 * - Structured error responses with actionable hints
 * - Request context enhancement for downstream handlers
 * 
 * @param req - Enhanced request object with authentication context
 * @param res - Express response object for error handling
 * @param next - Express next function for middleware chain continuation
 */
export const validateClientSetup = async (req: AuthenticatedRequest, res: Response, next: Function) => {
  const { clientId } = req.params;
  
  if (!clientId) {
    return res.status(400).json({ 
      error: 'Client ID is required',
      code: 'MISSING_CLIENT_ID'
    });
  }

  try {
    // Verify client exists
    const [client] = await db.select().from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      logger.warn(`Client not found: ${clientId}`);
      return res.status(404).json({ 
        error: `Client ${clientId} not found`,
        code: 'CLIENT_NOT_FOUND'
      });
    }

    // Check GA4 property access
    const [propertyAccess] = await db.select().from(ga4PropertyAccess)
      .where(eq(ga4PropertyAccess.clientId, clientId))
      .limit(1);

    if (!propertyAccess) {
      logger.warn(`No GA4 property access for client: ${clientId}`);
      return res.status(400).json({ 
        error: `No GA4 property access configured for client ${clientId}`,
        code: 'NO_GA4_CONFIG',
        hint: 'Configure GA4 property access in the admin panel first'
      });
    }

    if (!propertyAccess.accessVerified) {
      logger.warn(`GA4 property access not verified for client: ${clientId}`);
      return res.status(400).json({ 
        error: `GA4 property access not verified for client ${clientId}`,
        code: 'GA4_NOT_VERIFIED',
        hint: 'Verify GA4 property access in the admin panel first'
      });
    }

    // Attach to request for downstream use
    req.client = client;
    req.propertyAccess = propertyAccess;
    
    logger.info(`Client validation successful: ${clientId} -> Property: ${propertyAccess.propertyId}`);
    next();
  } catch (error) {
    logger.error('Client validation failed:', error);
    res.status(500).json({ 
      error: 'Failed to validate client configuration',
      code: 'VALIDATION_ERROR'
    });
  }
};

// ============================
// DATA FETCHING UTILITIES
// ============================

/**
 * Robust data fetching wrapper with comprehensive error handling and performance monitoring.
 * Provides safe execution environment for database operations and external API calls.
 * 
 * Features:
 * - Operation timing and performance monitoring
 * - Structured error handling with context preservation
 * - Comprehensive logging for debugging and audit trails
 * - Standardized response format for consistent API behavior
 * - Automatic duration calculation and timestamp generation
 * 
 * @param operation - Descriptive name of the operation for logging and monitoring
 * @param clientId - Client identifier for context and audit logging
 * @param action - Async function to execute safely with error handling
 * @returns Promise resolving to structured response with success status and data/error details
 */
export const safeDataFetch = async (operation: string, clientId: string, action: () => Promise<any>) => {
  const startTime = Date.now();
  
  try {
    logger.info(`Starting ${operation} for client: ${clientId}`);
    
    const result = await action();
    
    const duration = Date.now() - startTime;
    logger.info(`Completed ${operation} for client: ${clientId} in ${duration}ms`);
    
    return {
      success: true,
      data: result,
      duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed ${operation} for client: ${clientId} after ${duration}ms:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      timestamp: new Date().toISOString(),
      code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR'
    };
  }
};

/**
 * Retrieves the most recent metrics data for a specific client with optimized database querying.
 * Implements proper schema handling, ordering, and result limiting for performance optimization.
 * 
 * Features:
 * - Optimized database queries with proper indexing utilization
 * - Comprehensive field selection with explicit column mapping
 * - Multi-level sorting by creation time and time period
 * - Configurable result limiting for performance control
 * - Detailed logging for monitoring and debugging
 * 
 * @param clientId - Unique client identifier for metrics filtering
 * @param limit - Maximum number of records to retrieve (default: 10)
 * @returns Promise resolving to array of latest metrics with full field details
 */
export const getLatestMetrics = async (clientId: string, limit = 10) => {
  try {
    const latestMetrics = await db.select({
      id: metrics.id,
      clientId: metrics.clientId,
      competitorId: metrics.competitorId,
      metricName: metrics.metricName,
      value: metrics.value,
      sourceType: metrics.sourceType,
      timePeriod: metrics.timePeriod,
      channel: metrics.channel,
      createdAt: metrics.createdAt
    })
    .from(metrics)
    .where(eq(metrics.clientId, clientId))
    .orderBy(desc(metrics.createdAt), desc(metrics.timePeriod))
    .limit(limit);

    logger.info(`Retrieved ${latestMetrics.length} latest metrics for client: ${clientId}`);
    return latestMetrics;
  } catch (error) {
    logger.error(`Failed to get latest metrics for client: ${clientId}:`, error);
    throw error;
  }
};

// ============================
// ERROR HANDLING UTILITIES
// ============================

/**
 * Standardized error response formatter for consistent API error handling.
 * Transforms various error types into structured, client-friendly response format.
 * 
 * Features:
 * - Consistent error response structure across all API endpoints
 * - Error type detection and appropriate message extraction
 * - Operation context preservation for debugging
 * - Timestamp and error code standardization
 * - Optional hint inclusion for user guidance
 * 
 * @param error - Error object of various types (Error, custom errors, or unknown)
 * @param operation - Context string describing the failed operation
 * @returns Structured error response object with consistent format
 */
export const formatErrorResponse = (error: any, operation: string) => {
  const isKnownError = error instanceof Error;
  
  return {
    success: false,
    error: isKnownError ? error.message : 'Unknown error occurred',
    code: isKnownError && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR',
    operation,
    timestamp: new Date().toISOString(),
    hint: isKnownError && 'hint' in error ? (error as any).hint : undefined
  };
};

// ============================
// AUTHENTICATION UTILITIES
// ============================

/**
 * Creates standardized request configuration for authenticated API calls.
 * Provides consistent header setup for session-based authentication across the application.
 * 
 * Features:
 * - Standard Content-Type header configuration
 * - Session cookie integration for authentication
 * - Reusable request configuration object
 * - Consistent authentication pattern enforcement
 * 
 * @param sessionCookie - Session cookie string for authentication
 * @returns Request configuration object with authentication headers
 */
export const createAuthenticatedRequest = (sessionCookie: string) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  };
};

// ============================
// SCHEMA VALIDATION UTILITIES
// ============================

/**
 * Comprehensive metric data validation against database schema requirements.
 * Ensures data integrity and prevents invalid data insertion into the database.
 * 
 * Features:
 * - Required field validation with detailed error messages
 * - Source type validation against schema constants
 * - Comprehensive error reporting for missing or invalid fields
 * - Type-safe validation using schema constants
 * 
 * @param data - Metric data object to validate against schema requirements
 * @returns Boolean true if validation passes, throws Error if validation fails
 * @throws Error with detailed message about validation failures
 */
export const validateMetricData = (data: any) => {
  const requiredFields = ['metricName', 'value', 'sourceType', 'timePeriod'];
  const missingFields = requiredFields.filter(field => !(field in data));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (!SCHEMA_CONSTANTS.SOURCE_TYPES.includes(data.sourceType)) {
    throw new Error(`Invalid source type: ${data.sourceType}. Must be one of: ${SCHEMA_CONSTANTS.SOURCE_TYPES.join(', ')}`);
  }
  
  return true;
};