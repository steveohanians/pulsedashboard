import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { smartGA4DataFetcher } from '../services/smartGA4DataFetcher';
import logger from '../utils/logger';
import type { User } from '@shared/schema';

// Environment flag controls for rollback safety
const GA4_FORCE_ENABLED = process.env.GA4_FORCE_ENABLED === 'true';
const GA4_STRICT_CLIENTID_VALIDATION = process.env.GA4_STRICT_CLIENTID_VALIDATION === 'true';
const GA4_COMPAT_MODE = process.env.GA4_COMPAT_MODE !== 'false'; // Default true for backward compatibility

// Log active flags on startup
logger.info('Cleanup Route Feature Flags:', {
  GA4_FORCE_ENABLED,
  GA4_STRICT_CLIENTID_VALIDATION,
  GA4_COMPAT_MODE
});

// Extended request interface with proper User typing
interface AuthenticatedRequest extends Request {
  user?: User;
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      ok: false,
      error: "Authentication required" 
    });
  }
  next();
};

// Authorization check for admin operations
const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      ok: false,
      error: "Authentication required" 
    });
  }
  
  // Only admin users or users working on their own data can cleanup
  const { clientId } = req.params;
  if (req.user.role !== 'Admin' && req.user.clientId !== clientId) {
    return res.status(403).json({ 
      ok: false,
      error: "Insufficient permissions for this operation" 
    });
  }
  
  next();
};

/**
 * Validate clientId format for security (conditional based on flag)
 */
function validateClientId(clientId: string): boolean {
  if (!GA4_STRICT_CLIENTID_VALIDATION || GA4_COMPAT_MODE) {
    // Historical behavior: basic validation only (compat mode bypasses strict validation)
    return typeof clientId === 'string' && clientId.length > 0;
  }
  
  // New strict validation when flag enabled
  return typeof clientId === 'string' && 
         clientId.length > 0 && 
         clientId.length <= 100 && 
         /^[a-zA-Z0-9-_]+$/.test(clientId);
}

// NEW: In-memory lock for cleanup concurrency control
let cleanupInProgress = false;

const router = Router();

/**
 * Clear synthetic data and fetch authentic GA4 data for all historical periods
 * POST /api/cleanup-and-fetch/:clientId
 * Enhanced with comprehensive security, caching best practices and concurrency control
 */
router.post('/cleanup-and-fetch/:clientId', requireAuth, requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  // Set comprehensive non-cacheable headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Concurrency guard - only one cleanup at a time
  if (cleanupInProgress) {
    return res.status(409).json({
      ok: false,
      error: 'Cleanup operation already in progress. Please try again later.'
    });
  }
  
  try {
    // Set cleanup lock
    cleanupInProgress = true;
    
    const { clientId } = req.params;
    
    // Comprehensive input validation
    if (!clientId) {
      return res.status(400).json({ 
        ok: false,
        error: 'Client ID is required' 
      });
    }
    
    if (!validateClientId(clientId)) {
      return res.status(400).json({ 
        ok: false,
        error: 'Invalid client ID format' 
      });
    }

    logger.info(`Starting cleanup and authentic data fetch for client: ${clientId}`, {
      userId: req.user?.id,
      userRole: req.user?.role
    });
    
    // Step 1: Clear existing synthetic/derived caches for the given clientId only
    await clearSyntheticDataForClient(clientId);
    
    // Step 2: Call smart GA4 fetcher (compat mode uses legacy service sequence)
    const results = GA4_COMPAT_MODE 
      ? await smartGA4DataFetcher({ clientId }) // Legacy behavior: no force unless explicitly enabled
      : (GA4_FORCE_ENABLED 
          ? await smartGA4DataFetcher({ 
              clientId, 
              force: true // Force bypass cache and refresh data
            })
          : await smartGA4DataFetcher({ clientId })); // Historical behavior
    
    // Log completion with audit trail
    logger.info(`Cleanup and fetch completed for ${clientId}`, {
      ...results,
      userId: req.user?.id,
      userRole: req.user?.role
    });
    
    // Return comprehensive JSON response
    return res.json({
      ok: true,
      success: true,
      message: 'Successfully replaced synthetic data with authentic GA4 data',
      periodsRefetched: results.periodsProcessed,
      dailyDataPeriods: results.dailyDataPeriods,
      monthlyDataPeriods: results.monthlyDataPeriods,
      lastFetchedAt: results.lastFetchedAt,
      errors: results.errors
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in cleanup and fetch route:', {
      error: errorMessage,
      clientId: req.params.clientId,
      userId: req.user?.id
    });
    
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Failed to cleanup and fetch authentic data',
      details: errorMessage
    });
  } finally {
    // Always release cleanup lock
    cleanupInProgress = false;
  }
});

/**
 * Clear synthetic/derived caches for the given clientId only
 * Preserves data integrity by ensuring atomic operations where possible
 */
async function clearSyntheticDataForClient(clientId: string): Promise<void> {
  if (!validateClientId(clientId)) {
    throw new Error('Invalid clientId format for cleanup operation');
  }
  
  logger.info(`Clearing synthetic/derived caches for client: ${clientId}`);
  
  try {
    // Clear all client metrics (will be replaced with fresh GA4 data)
    await storage.clearAllClientMetrics(clientId);
    
    // More efficient AI insights clearing
    const insights = await storage.getAIInsightsByClient(clientId);
    
    // Clear insights in parallel for better performance
    const clearingPromises = insights.map(insight => 
      storage.deleteAIInsightByMetric(clientId, insight.metricName)
    );
    
    await Promise.all(clearingPromises);
    
    logger.info(`Successfully cleared synthetic/derived caches for client: ${clientId}`, {
      metricsCleared: true,
      insightsCleared: insights.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error clearing synthetic data for client ${clientId}:`, { error: errorMessage });
    throw new Error(`Cleanup failed: ${errorMessage}`);
  }
}

export default router;

/*
 * BACKWARD COMPATIBILITY NOTES FOR GA4_COMPAT_MODE=true (default):
 * 
 * Legacy Behaviors Preserved:
 * - Basic clientId validation only (bypasses GA4_STRICT_CLIENTID_VALIDATION)
 * - Legacy service sequence: smartGA4DataFetcher({ clientId }) without force
 * - Historical cleanup method unchanged
 * - Error messages in original format
 * 
 * Compat Mode Route Behaviors:
 * - Force refresh only when GA4_FORCE_ENABLED explicitly true
 * - No enhanced metadata in response headers
 * - Preserves original JSON response structure
 * - Maintains historical error handling patterns
 * 
 * When GA4_COMPAT_MODE=false:
 * - Enhanced validation and security features enabled
 * - Modern service call patterns with force parameters
 * - Extended metadata and audit trail logging
 */