/**
 * GA4 Service Account Management Routes
 * Admin-only routes for managing Google service accounts and property access
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { 
  ga4ServiceAccounts, 
  ga4PropertyAccess,
  clients,
  insertGA4ServiceAccountSchema,
  updateGA4ServiceAccountSchema,
  insertGA4PropertyAccessSchema 
} from '../../shared/schema';
import { ga4ServiceAccountManager } from '../services/ga4ServiceAccountManager';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/ga4-service-accounts
 * Get all service accounts with analytics
 */
router.get('/ga4-service-accounts', async (req, res) => {
  try {
    const analytics = await ga4ServiceAccountManager.getServiceAccountAnalytics();
    
    res.json(analytics);
  } catch (error) {
    logger.error('Failed to fetch service accounts:', error);
    res.status(500).json({ 
      message: 'Failed to fetch service accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/ga4-service-accounts
 * Create a new service account configuration
 */
router.post('/ga4-service-accounts', async (req, res) => {
  try {
    const data = insertGA4ServiceAccountSchema.parse(req.body);
    
    const serviceAccount = await ga4ServiceAccountManager.createServiceAccount(data);
    
    logger.info('Service account created by admin', {
      serviceAccountId: serviceAccount.id,
      adminId: req.user?.id
    });
    
    res.status(201).json(serviceAccount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid service account data',
        errors: error.errors 
      });
    }
    
    logger.error('Failed to create service account:', error);
    res.status(500).json({ 
      message: 'Failed to create service account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/ga4-service-accounts/:id
 * Update service account configuration
 */
router.put('/ga4-service-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateGA4ServiceAccountSchema.parse(req.body);
    
    const serviceAccount = await ga4ServiceAccountManager.updateServiceAccount(id, data);
    
    logger.info('Service account updated by admin', {
      serviceAccountId: id,
      adminId: req.user?.id
    });
    
    res.json(serviceAccount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid service account data',
        errors: error.errors 
      });
    }
    
    logger.error('Failed to update service account:', error);
    res.status(500).json({ 
      message: 'Failed to update service account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/admin/ga4-service-accounts/:id
 * Permanently delete a service account
 */
router.delete('/ga4-service-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await ga4ServiceAccountManager.deleteServiceAccount(id);
    
    logger.info('Service account deleted by admin', {
      serviceAccountId: id,
      adminId: req.user?.id
    });
    
    res.json({ message: 'Service account deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete service account:', error);
    res.status(500).json({ 
      message: 'Failed to delete service account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/ga4-property-access
 * Get all property access records with client and service account details
 */
router.get('/ga4-property-access', async (req, res) => {
  try {
    const propertyAccess = await db.select({
      access: ga4PropertyAccess,
      client: {
        id: clients.id,
        name: clients.name,
        websiteUrl: clients.websiteUrl
      },
      serviceAccount: {
        id: ga4ServiceAccounts.id,
        name: ga4ServiceAccounts.name,
        serviceAccountEmail: ga4ServiceAccounts.serviceAccountEmail
      }
    })
    .from(ga4PropertyAccess)
    .leftJoin(clients, eq(ga4PropertyAccess.clientId, clients.id))
    .leftJoin(ga4ServiceAccounts, eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id))
    .orderBy(ga4PropertyAccess.createdAt);
    
    res.json(propertyAccess);
  } catch (error) {
    logger.error('Failed to fetch property access records:', error);
    res.status(500).json({ 
      message: 'Failed to fetch property access records',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/ga4-property-access
 * Setup property access for a client
 */
router.post('/ga4-property-access', async (req, res) => {
  try {
    const setupSchema = insertGA4PropertyAccessSchema.extend({
      autoAssignServiceAccount: z.boolean().optional()
    });
    
    const data = setupSchema.parse(req.body);
    
    // Auto-assign service account if requested
    if (data.autoAssignServiceAccount && !data.serviceAccountId) {
      const bestAccount = await ga4ServiceAccountManager.getBestAvailableServiceAccount();
      if (!bestAccount) {
        return res.status(400).json({ 
          message: 'No available service accounts found' 
        });
      }
      data.serviceAccountId = bestAccount.id;
    }
    
    const propertyAccess = await ga4ServiceAccountManager.setupPropertyAccess(data);
    
    logger.info('Property access setup by admin', {
      clientId: data.clientId,
      propertyId: data.propertyId,
      serviceAccountId: data.serviceAccountId,
      adminId: req.user?.id
    });
    
    res.status(201).json(propertyAccess);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid property access data',
        errors: error.errors 
      });
    }
    
    logger.error('Failed to setup property access:', error);
    res.status(500).json({ 
      message: 'Failed to setup property access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/ga4-property-access/:id
 * Update an existing property access record
 */
router.put('/ga4-property-access/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = z.object({
      propertyId: z.string().optional(),
      serviceAccountId: z.string().optional()
    }).parse(req.body);
    
    const result = await ga4ServiceAccountManager.updatePropertyAccess(id, updateData);
    
    if (!result) {
      return res.status(404).json({ message: 'Property access record not found' });
    }
    
    logger.info('Property access updated by admin', {
      accessId: id,
      updateData,
      adminId: req.user?.id
    });
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid update data',
        errors: error.errors 
      });
    }
    
    logger.error('Failed to update property access:', error);
    res.status(500).json({ 
      message: 'Failed to update property access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/ga4-property-access/:id/verify
 * Manually trigger property access verification
 */
router.post('/ga4-property-access/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await ga4ServiceAccountManager.verifyPropertyAccess(id);
    
    logger.info('Property access verification triggered by admin', {
      accessId: id,
      success: result.success,
      adminId: req.user?.id
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to verify property access:', error);
    res.status(500).json({ 
      message: 'Failed to verify property access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/ga4-property-access/client/:clientId
 * Get property access records for a specific client
 */
router.get('/ga4-property-access/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const propertyAccess = await ga4ServiceAccountManager.getClientPropertyAccess(clientId);
    
    res.json(propertyAccess);
  } catch (error) {
    logger.error('Failed to fetch client property access:', error);
    res.status(500).json({ 
      message: 'Failed to fetch client property access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/ga4-service-accounts/:id/test-connection
 * Test Google account access and connection
 */
router.post('/ga4-service-accounts/:id/test-connection', async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await ga4ServiceAccountManager.testAccountAccess(id);
    
    const testResult = {
      success,
      message: success ? 'Google account access verified' : 'Failed to verify Google account access',
      testedAt: new Date().toISOString()
    };
    
    logger.info('Google account connection test completed', {
      serviceAccountId: id,
      success: testResult.success,
      adminId: req.user?.id
    });
    
    res.json(testResult);
  } catch (error) {
    logger.error('Failed to test Google account connection:', error);
    res.status(500).json({ 
      message: 'Failed to test Google account connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/ga4-service-accounts/available
 * Get available service accounts for new property assignment
 */
router.get('/ga4-service-accounts/available', async (req, res) => {
  try {
    const bestAccount = await ga4ServiceAccountManager.getBestAvailableServiceAccount();
    
    if (!bestAccount) {
      return res.json({ 
        available: false, 
        message: 'No service accounts available for new properties' 
      });
    }
    
    res.json({ 
      available: true, 
      serviceAccount: bestAccount 
    });
  } catch (error) {
    logger.error('Failed to find available service account:', error);
    res.status(500).json({ 
      message: 'Failed to find available service account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;