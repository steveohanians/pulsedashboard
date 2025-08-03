/**
 * Google OAuth Routes for GA4 Integration
 * 
 * Handles OAuth 2.0 flow for Google Analytics 4 API access
 */

import { Router } from 'express';
import { z } from 'zod';
import googleOAuthService from '../services/googleOAuthService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/oauth/google/authorize/:serviceAccountId
 * Initiate OAuth flow for service account
 */
router.get('/authorize/:serviceAccountId', async (req, res) => {
  try {
    const { serviceAccountId } = req.params;
    
    // Generate OAuth authorization URL
    const authUrl = googleOAuthService.generateAuthUrl(serviceAccountId);
    
    logger.info('OAuth authorization initiated', {
      serviceAccountId,
      adminId: req.user?.id
    });
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Failed to initiate OAuth authorization:', error);
    res.status(500).json({ 
      message: 'Failed to initiate OAuth authorization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/oauth/google/callback
 * Handle OAuth callback from Google
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.error('OAuth authorization failed:', error);
      return res.redirect('/admin?oauth=error&message=' + encodeURIComponent(error as string));
    }
    
    if (!code || !state) {
      return res.redirect('/admin?oauth=error&message=Missing authorization code or state');
    }
    
    const serviceAccountId = state as string;
    
    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code as string);
    
    // Store tokens in database
    await googleOAuthService.storeTokens(serviceAccountId, tokens);
    
    logger.info('OAuth flow completed successfully', {
      serviceAccountId,
      scopes: tokens.scope
    });
    
    // Redirect back to admin panel with success
    res.redirect('/admin?oauth=success&tab=ga4-accounts');
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.redirect('/admin?oauth=error&message=' + encodeURIComponent(
      error instanceof Error ? error.message : 'OAuth verification failed'
    ));
  }
});

/**
 * POST /api/oauth/google/test/:serviceAccountId
 * Test OAuth access for service account
 */
router.post('/test/:serviceAccountId', async (req, res) => {
  try {
    const { serviceAccountId } = req.params;
    
    const isValid = await googleOAuthService.testOAuthAccess(serviceAccountId);
    
    const result = {
      success: isValid,
      message: isValid 
        ? 'OAuth access verified successfully' 
        : 'OAuth access verification failed - please re-authorize',
      testedAt: new Date().toISOString()
    };
    
    logger.info('OAuth access test completed', {
      serviceAccountId,
      success: isValid,
      adminId: req.user?.id
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to test OAuth access:', error);
    res.status(500).json({ 
      message: 'Failed to test OAuth access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/oauth/google/verify-property/:serviceAccountId
 * Verify access to specific GA4 property
 */
router.post('/verify-property/:serviceAccountId', async (req, res) => {
  try {
    const { serviceAccountId } = req.params;
    const { propertyId } = z.object({
      propertyId: z.string().min(1, 'Property ID is required')
    }).parse(req.body);
    
    const permission = await googleOAuthService.verifyGA4PropertyAccess(serviceAccountId, propertyId);
    
    logger.info('GA4 property access verification completed', {
      serviceAccountId,
      propertyId,
      verified: permission.verified,
      permissions: permission.permissions,
      adminId: req.user?.id
    });
    
    res.json(permission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    
    logger.error('Failed to verify GA4 property access:', error);
    res.status(500).json({ 
      message: 'Failed to verify GA4 property access',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;