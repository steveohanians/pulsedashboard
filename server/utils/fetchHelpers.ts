/**
 * Fetch Helpers - Robust utilities for making authenticated API requests
 * Addresses common issues with authentication, schema validation, and error handling
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { clients, ga4PropertyAccess, metrics } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import logger from './logger';

export interface AuthenticatedRequest extends Request {
  user?: any;
  client?: any;
  propertyAccess?: any;
}

/**
 * Schema Constants - Centralized reference for database schema
 */
export const SCHEMA_CONSTANTS = {
  SOURCE_TYPES: ['Client', 'CD_Avg', 'Industry', 'Competitor', 'Industry_Avg', 'Competitor_Avg'] as const,
  METRIC_NAMES: [
    'Bounce Rate',
    'Session Duration', 
    'Pages per Session',
    'Sessions per User',
    'Traffic Channels',
    'Device Distribution'
  ] as const,
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

/**
 * Validation middleware for client existence and GA4 configuration
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

/**
 * Safe data fetcher with proper error handling and schema validation
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
 * Get latest metrics data with proper schema handling
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

/**
 * Standardized error response formatter
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

/**
 * Authentication helper for API requests
 */
export const createAuthenticatedRequest = (sessionCookie: string) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  };
};

/**
 * Schema validation helper
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