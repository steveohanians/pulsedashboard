/**
 * GA4 Status API Routes
 * 
 * Provides observable status for GA4 fetch operations to enable
 * UI visibility into cache and lock states.
 */

import { Router } from 'express';
import { z } from 'zod';
import { ga4StatusRegistry } from '../services/ga4/StatusRegistry';
import { requireAuth, requireAdmin } from '../middleware/auth';
import logger from '../utils/logging/logger';

const router = Router();

// Request schemas for validation
const StatusRequestSchema = z.object({
  timePeriod: z.string().optional()
});

const ForceRefreshRequestSchema = z.object({
  timePeriod: z.string().optional(),
  reason: z.string().optional()
});

/**
 * GET /api/ga4-data/status/:clientId
 * Get GA4 fetch status for a specific client
 * Query params: timePeriod (optional) - filter to specific time period
 */
router.get('/status/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const query = StatusRequestSchema.parse(req.query);
    
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid clientId is required'
      });
    }

    logger.debug(`Fetching GA4 status for client: ${clientId}`, { 
      timePeriod: query.timePeriod 
    });

    if (query.timePeriod) {
      // Get status for specific time period
      const status = ga4StatusRegistry.getStatus(clientId, query.timePeriod);
      
      return res.json({
        success: true,
        data: {
          clientId,
          timePeriod: query.timePeriod,
          status: status || {
            clientId,
            timePeriod: query.timePeriod,
            inProgress: false,
            lastRefreshedAt: null,
            error: null,
            dataType: null,
            lockKey: `${clientId}:${query.timePeriod}`
          }
        }
      });
    } else {
      // Get all statuses for the client
      const statuses = ga4StatusRegistry.getClientStatuses(clientId);
      const stats = ga4StatusRegistry.getStats();
      
      return res.json({
        success: true,
        data: {
          clientId,
          statuses,
          stats,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error('Error fetching GA4 status:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch GA4 status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ga4-data/force-refresh/:clientId
 * Force refresh GA4 data for a client (admin only)
 * Bypasses TTL and expires any existing locks
 */
router.post('/force-refresh/:clientId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    const body = ForceRefreshRequestSchema.parse(req.body);
    
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid clientId is required'
      });
    }

    const timePeriod = body.timePeriod || 'force-refresh';
    const reason = body.reason || 'Admin force refresh';
    
    logger.info(`Admin force refresh requested for client: ${clientId}`, {
      timePeriod,
      reason,
      adminUserId: req.user?.id
    });

    // Force expire any existing fetches for this client
    if (body.timePeriod) {
      const expired = ga4StatusRegistry.forceExpireFetch(clientId, body.timePeriod);
      if (expired) {
        logger.info(`Force expired fetch for ${clientId}:${body.timePeriod}`);
      }
    } else {
      // Force expire all fetches for this client
      const statuses = ga4StatusRegistry.getClientStatuses(clientId);
      let expiredCount = 0;
      
      for (const status of statuses) {
        if (status.inProgress) {
          const expired = ga4StatusRegistry.forceExpireFetch(clientId, status.timePeriod);
          if (expired) expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        logger.info(`Force expired ${expiredCount} fetches for client: ${clientId}`);
      }
    }

    return res.json({
      success: true,
      data: {
        clientId,
        timePeriod,
        message: 'Force refresh initiated',
        reason,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in force refresh:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate force refresh',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ga4-data/status/registry/stats
 * Get registry statistics (admin only)
 */
router.get('/status/registry/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = ga4StatusRegistry.getStats();
    
    return res.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching registry stats:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch registry statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;