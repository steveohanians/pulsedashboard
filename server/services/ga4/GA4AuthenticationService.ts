/**
 * GA4 Authentication Service
 * 
 * Handles all authentication-related operations for GA4 API access.
 */

import { storage } from '../../storage';
import logger from '../../utils/logging/logger';
import { GA4_ENDPOINTS } from './constants';
import type { GA4PropertyAccess, TokenRefreshResult } from './types';

export class GA4AuthenticationService {
  // Map to track active token refresh promises to prevent race conditions
  private refreshPromises = new Map<string, Promise<TokenRefreshResult>>();
  
  /**
   * Get authenticated GA4 property access for a client
   */
  async getPropertyAccess(clientId: string): Promise<GA4PropertyAccess | null> {
    try {
      const propertyAccess = await storage.getGA4PropertyAccessByClient(clientId);
      if (!propertyAccess || !propertyAccess.accessVerified) {
        logger.warn(`No verified GA4 property access for client: ${clientId}`);
        return null;
      }

      // Get service account with access token
      let serviceAccount = await storage.getGA4ServiceAccount(propertyAccess.serviceAccountId);
      if (!serviceAccount || !serviceAccount.accessToken) {
        logger.warn(`No access token for service account: ${propertyAccess.serviceAccountId}`);
        return null;
      }

      // Check if token is expired and refresh if needed
      if (serviceAccount.tokenExpiry && new Date() > serviceAccount.tokenExpiry) {
        logger.info(`Access token expired for service account ${serviceAccount.id}, refreshing...`);
        
        if (!serviceAccount.refreshToken) {
          logger.error(`No refresh token available for service account: ${serviceAccount.id}`);
          return null;
        }

        // Check if race condition prevention is enabled
        const lockEnabled = process.env.GA4_TOKEN_REFRESH_LOCK_ENABLED !== 'false';
        
        try {
          let refreshedTokens: TokenRefreshResult;
          
          if (lockEnabled) {
            // Race condition prevention: check if refresh is already in progress
            const refreshKey = serviceAccount.id;
            
            if (this.refreshPromises.has(refreshKey)) {
              logger.info(`Token refresh already in progress for service account ${serviceAccount.id}, waiting...`);
              refreshedTokens = await this.refreshPromises.get(refreshKey)!;
            } else {
              // Create and store refresh promise
              const refreshPromise = this.refreshAccessToken(serviceAccount.refreshToken);
              this.refreshPromises.set(refreshKey, refreshPromise);
              
              try {
                refreshedTokens = await refreshPromise;
              } finally {
                // Always clean up the promise
                this.refreshPromises.delete(refreshKey);
              }
            }
          } else {
            // Legacy behavior: direct refresh without locking
            refreshedTokens = await this.refreshAccessToken(serviceAccount.refreshToken);
          }
          
          // Update service account with new tokens
          await this.updateServiceAccountTokens(
            serviceAccount.id, 
            refreshedTokens.access_token, 
            new Date(refreshedTokens.expiry_date)
          );

          // Update the serviceAccount object for this request
          serviceAccount.accessToken = refreshedTokens.access_token;
          serviceAccount.tokenExpiry = new Date(refreshedTokens.expiry_date);
          
          logger.info(`Successfully refreshed access token for service account: ${serviceAccount.id}`);
        } catch (error) {
          logger.error(`Failed to refresh access token for service account ${serviceAccount.id}:`, error);
          return null;
        }
      }

      return {
        propertyId: propertyAccess.propertyId,
        serviceAccountId: propertyAccess.serviceAccountId,
        accessToken: serviceAccount.accessToken
      };
    } catch (error) {
      logger.error('Error getting GA4 property access:', error);
      return null;
    }
  }

  /**
   * Refresh an expired access token using the refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
    const response = await fetch(GA4_ENDPOINTS.OAUTH_REFRESH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in * 1000) // Convert to timestamp
    };
  }

  /**
   * Update service account tokens in database
   */
  private async updateServiceAccountTokens(
    serviceAccountId: string, 
    accessToken: string, 
    tokenExpiry: Date
  ): Promise<void> {
    const { db } = await import('../../db');
    const { ga4ServiceAccounts } = await import('../../../shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(ga4ServiceAccounts)
      .set({
        accessToken,
        tokenExpiry
      })
      .where(eq(ga4ServiceAccounts.id, serviceAccountId));
  }

  /**
   * Validate if client has valid GA4 access
   */
  async validateClientAccess(clientId: string): Promise<boolean> {
    const access = await this.getPropertyAccess(clientId);
    return !!access;
  }
}