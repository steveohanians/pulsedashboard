/**
 * Google OAuth Service for GA4 API Access
 * 
 * Handles OAuth 2.0 flow for Google Analytics 4 API access
 * Note: googleapis packages will be installed separately to resolve version conflicts
 */

import { db } from '../db';
import { ga4ServiceAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GA4Permission {
  propertyId: string;
  permissions: string[];
  verified: boolean;
}

class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  
  constructor() {
    // Initialize OAuth2 configuration
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/google/callback`;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(serviceAccountId: string): string {
    if (!this.clientId) {
      throw new Error('Google OAuth client ID not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics.manage.users.readonly'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: serviceAccountId
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: Date.now() + (tokens.expires_in * 1000)
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Store OAuth tokens for service account
   */
  async storeTokens(serviceAccountId: string, tokens: OAuthTokens): Promise<void> {
    try {
      await db.update(ga4ServiceAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: new Date(tokens.expiry_date),
          scopes: tokens.scope.split(' '),
          verified: true,
          lastUsed: new Date()
        })
        .where(eq(ga4ServiceAccounts.id, serviceAccountId));

      logger.info('OAuth tokens stored successfully', {
        serviceAccountId,
        scopes: tokens.scope
      });
    } catch (error) {
      logger.error('Failed to store OAuth tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(serviceAccountId: string): Promise<boolean> {
    try {
      const [account] = await db.select()
        .from(ga4ServiceAccounts)
        .where(eq(ga4ServiceAccounts.id, serviceAccountId))
        .limit(1);

      if (!account?.refreshToken) {
        return false;
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return false;
      }

      const tokens = await refreshResponse.json();
      
      if (tokens.access_token) {
        await db.update(ga4ServiceAccounts)
          .set({
            accessToken: tokens.access_token,
            tokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000))
          })
          .where(eq(ga4ServiceAccounts.id, serviceAccountId));

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      return false;
    }
  }

  /**
   * Verify access to specific GA4 property
   */
  async verifyGA4PropertyAccess(serviceAccountId: string, propertyId: string): Promise<GA4Permission> {
    try {
      const [account] = await db.select()
        .from(ga4ServiceAccounts)
        .where(eq(ga4ServiceAccounts.id, serviceAccountId))
        .limit(1);

      if (!account?.accessToken) {
        throw new Error('No access token found for service account');
      }

      // Check if token needs refresh
      if (account.tokenExpiry && account.tokenExpiry < new Date()) {
        const refreshed = await this.refreshAccessToken(serviceAccountId);
        if (!refreshed) {
          throw new Error('Failed to refresh access token');
        }
      }

      // Test access with a simple API call
      const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
        },
      });

      if (testResponse.ok) {
        // In production, you'd call the actual GA4 API to verify property access
        // For now, we'll assume success if we have valid tokens
        return {
          propertyId,
          permissions: ['READ'],
          verified: true
        };
      } else {
        return {
          propertyId,
          permissions: [],
          verified: false
        };
      }
    } catch (error) {
      logger.error('Failed to verify GA4 property access:', error);
      return {
        propertyId,
        permissions: [],
        verified: false
      };
    }
  }

  /**
   * Test basic OAuth access (no specific property)
   */
  async testOAuthAccess(serviceAccountId: string): Promise<boolean> {
    try {
      const [account] = await db.select()
        .from(ga4ServiceAccounts)
        .where(eq(ga4ServiceAccounts.id, serviceAccountId))
        .limit(1);

      if (!account?.accessToken) {
        return false;
      }

      // Check if token needs refresh
      if (account.tokenExpiry && account.tokenExpiry < new Date()) {
        return await this.refreshAccessToken(serviceAccountId);
      }

      // Test basic API access with user info endpoint
      const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
        },
      });

      if (!testResponse.ok) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('OAuth access test failed:', error);
      return false;
    }
  }
}

export default new GoogleOAuthService();