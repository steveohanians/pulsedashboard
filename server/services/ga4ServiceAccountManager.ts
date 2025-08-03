/**
 * GA4 Service Account Management System
 * 
 * Handles multiple Google service accounts for Clear Digital's access to client GA4 properties.
 * Each service account can access multiple client properties and tracks access verification.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { 
  ga4ServiceAccounts, 
  ga4PropertyAccess, 
  clients,
  GA4ServiceAccount,
  GA4PropertyAccess,
  InsertGA4ServiceAccount,
  InsertGA4PropertyAccess,
  UpdateGA4ServiceAccount,
  UpdateGA4PropertyAccess
} from '../../shared/schema';
import logger from '../utils/logger';

export interface GA4AccessConfig {
  serviceAccountId: string;
  propertyId: string;
  clientId: string;
}

export interface PropertyAccessResult {
  success: boolean;
  propertyName?: string;
  accessLevel?: string;
  error?: string;
}

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

class GA4ServiceAccountManager {
  
  /**
   * Get all active service accounts
   */
  async getActiveServiceAccounts(): Promise<GA4ServiceAccount[]> {
    try {
      return await db.select().from(ga4ServiceAccounts)
        .where(eq(ga4ServiceAccounts.active, true));
    } catch (error) {
      logger.error('Failed to retrieve service accounts:', error);
      throw error;
    }
  }

  /**
   * Create a new service account configuration
   */
  async createServiceAccount(data: InsertGA4ServiceAccount): Promise<GA4ServiceAccount> {
    try {
      const [serviceAccount] = await db.insert(ga4ServiceAccounts)
        .values(data)
        .returning();
      
      logger.info(`Created GA4 service account: ${serviceAccount.name}`, {
        serviceAccountId: serviceAccount.id,
        email: serviceAccount.serviceAccountEmail
      });
      
      return serviceAccount;
    } catch (error) {
      logger.error('Failed to create service account:', error);
      throw error;
    }
  }

  /**
   * Update service account configuration
   */
  async updateServiceAccount(id: string, data: UpdateGA4ServiceAccount): Promise<GA4ServiceAccount> {
    try {
      const [serviceAccount] = await db.update(ga4ServiceAccounts)
        .set(data)
        .where(eq(ga4ServiceAccounts.id, id))
        .returning();
      
      if (!serviceAccount) {
        throw new Error(`Service account ${id} not found`);
      }
      
      logger.info(`Updated GA4 service account: ${serviceAccount.name}`);
      return serviceAccount;
    } catch (error) {
      logger.error('Failed to update service account:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a service account
   */
  async deleteServiceAccount(id: string): Promise<void> {
    try {
      // First delete any associated property access records
      await db.delete(ga4PropertyAccess)
        .where(eq(ga4PropertyAccess.serviceAccountId, id));
      
      // Then delete the service account
      const result = await db.delete(ga4ServiceAccounts)
        .where(eq(ga4ServiceAccounts.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error(`Service account ${id} not found`);
      }
      
      logger.info(`Deleted GA4 service account: ${result[0].name}`, {
        serviceAccountId: id,
        email: result[0].serviceAccountEmail
      });
    } catch (error) {
      logger.error('Failed to delete service account:', error);
      throw error;
    }
  }

  /**
   * Test Google account access (OAuth-based authentication)
   */
  async testAccountAccess(serviceAccountId: string): Promise<boolean> {
    try {
      const serviceAccount = await db.select()
        .from(ga4ServiceAccounts)
        .where(and(
          eq(ga4ServiceAccounts.id, serviceAccountId),
          eq(ga4ServiceAccounts.active, true)
        ))
        .limit(1);

      if (!serviceAccount.length) {
        return false;
      }

      // For now, return true as we're using OAuth flow
      // In production, this would initiate OAuth flow to verify access
      logger.info(`Testing access for Google account: ${serviceAccount[0].serviceAccountEmail}`);
      return true;
    } catch (error) {
      logger.error('Failed to test account access:', error);
      return false;
    }
  }

  /**
   * Create property access record and verify access
   */
  async setupPropertyAccess(data: InsertGA4PropertyAccess): Promise<GA4PropertyAccess> {
    try {
      // Check if access record already exists
      const existing = await db.select().from(ga4PropertyAccess)
        .where(and(
          eq(ga4PropertyAccess.clientId, data.clientId),
          eq(ga4PropertyAccess.propertyId, data.propertyId)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Property access already configured for client ${data.clientId} and property ${data.propertyId}`);
      }

      // Create the access record
      const [propertyAccess] = await db.insert(ga4PropertyAccess)
        .values(data)
        .returning();

      logger.info(`Created GA4 property access record`, {
        clientId: data.clientId,
        propertyId: data.propertyId,
        serviceAccountId: data.serviceAccountId
      });

      // Trigger access verification (async)
      this.verifyPropertyAccess(propertyAccess.id).catch(error => {
        logger.error(`Property access verification failed for ${propertyAccess.id}:`, error);
      });

      return propertyAccess;
    } catch (error) {
      logger.error('Failed to setup property access:', error);
      throw error;
    }
  }

  /**
   * Verify access to a GA4 property
   */
  async verifyPropertyAccess(accessId: string): Promise<PropertyAccessResult> {
    try {
      // Get property access record with service account details
      const accessRecord = await db.select({
        propertyAccess: ga4PropertyAccess,
        serviceAccount: ga4ServiceAccounts,
        client: clients
      })
      .from(ga4PropertyAccess)
      .leftJoin(ga4ServiceAccounts, eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id))
      .leftJoin(clients, eq(ga4PropertyAccess.clientId, clients.id))
      .where(eq(ga4PropertyAccess.id, accessId))
      .limit(1);

      if (!accessRecord.length) {
        throw new Error(`Property access record ${accessId} not found`);
      }

      const { propertyAccess, serviceAccount, client } = accessRecord[0];

      if (!serviceAccount) {
        throw new Error(`Service account not found for access record ${accessId}`);
      }

      // Use real Google Analytics API to verify property access
      const result = await this.checkPropertyAccess(
        serviceAccount,
        propertyAccess.propertyId
      );

      // Update the access record with verification results
      await db.update(ga4PropertyAccess)
        .set({
          accessVerified: result.success,
          lastVerified: new Date(),
          propertyName: result.propertyName,
          accessLevel: result.accessLevel,
          errorMessage: result.error,
          syncStatus: result.success ? 'success' : 'failed'
        })
        .where(eq(ga4PropertyAccess.id, accessId));

      logger.info(`Property access verification completed`, {
        accessId,
        success: result.success,
        propertyId: propertyAccess.propertyId,
        clientName: client?.name
      });

      return result;
    } catch (error) {
      logger.error(`Property access verification failed for ${accessId}:`, error);
      
      // Update record with error status
      await db.update(ga4PropertyAccess)
        .set({
          accessVerified: false,
          lastVerified: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          syncStatus: 'failed'
        })
        .where(eq(ga4PropertyAccess.id, accessId));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check real GA4 property access using Google Analytics Admin API
   */
  private async checkPropertyAccess(
    serviceAccount: GA4ServiceAccount, 
    propertyId: string
  ): Promise<PropertyAccessResult> {
    try {
      if (!serviceAccount.accessToken) {
        return {
          success: false,
          error: 'Service account not properly authenticated. Please complete OAuth flow.'
        };
      }

      // Check if token is expired and refresh if needed
      if (serviceAccount.tokenExpiry && new Date() > serviceAccount.tokenExpiry) {
        logger.warn('Access token expired, attempting to refresh', { serviceAccountId: serviceAccount.id });
        
        if (!serviceAccount.refreshToken) {
          return {
            success: false,
            error: 'Access token expired and no refresh token available. Please re-authenticate the service account.'
          };
        }

        try {
          const refreshedTokens = await this.refreshAccessToken(serviceAccount.refreshToken);
          
          // Update service account with new tokens
          await db.update(ga4ServiceAccounts)
            .set({
              accessToken: refreshedTokens.access_token,
              tokenExpiry: new Date(refreshedTokens.expiry_date)
            })
            .where(eq(ga4ServiceAccounts.id, serviceAccount.id));

          // Update the serviceAccount object for this request
          serviceAccount.accessToken = refreshedTokens.access_token;
          serviceAccount.tokenExpiry = new Date(refreshedTokens.expiry_date);
          
          logger.info('Successfully refreshed access token', { serviceAccountId: serviceAccount.id });
        } catch (error) {
          logger.error('Failed to refresh access token', { 
            serviceAccountId: serviceAccount.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          return {
            success: false,
            error: 'Failed to refresh access token. Please re-authenticate the service account.'
          };
        }
      }

      // Make request to Google Analytics Admin API to get property details
      const response = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${serviceAccount.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 403) {
        return {
          success: false,
          error: 'Insufficient permissions. Service account not added to this GA4 property.'
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: 'Property not found. Please verify the property ID is correct.'
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GA4 API error', { status: response.status, error: errorText });
        return {
          success: false,
          error: `GA4 API error: ${response.status} ${errorText}`
        };
      }

      const propertyData = await response.json();
      
      // Extract property name and determine access level
      const propertyName = propertyData.displayName || `Property ${propertyId}`;
      
      // Check access level by attempting to list accounts (higher permission)
      let accessLevel = 'Viewer';
      try {
        const accountResponse = await fetch(`https://analyticsadmin.googleapis.com/v1beta/accounts`, {
          headers: {
            'Authorization': `Bearer ${serviceAccount.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (accountResponse.ok) {
          accessLevel = 'Administrator';
        }
      } catch {
        // If account listing fails, user likely has limited permissions
        accessLevel = 'Viewer';
      }

      logger.info('Successfully verified GA4 property access', {
        propertyId,
        propertyName,
        accessLevel,
        serviceAccountEmail: serviceAccount.serviceAccountEmail
      });

      return {
        success: true,
        propertyName,
        accessLevel
      };

    } catch (error) {
      logger.error('Error checking GA4 property access', { 
        propertyId, 
        serviceAccountId: serviceAccount.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();
    
    return {
      access_token: tokens.access_token,
      expiry_date: Date.now() + (tokens.expires_in * 1000)
    };
  }

  /**
   * Get all property access records for a client
   */
  async getClientPropertyAccess(clientId: string): Promise<(GA4PropertyAccess & { serviceAccount: GA4ServiceAccount })[]> {
    try {
      const records = await db.select({
        propertyAccess: ga4PropertyAccess,
        serviceAccount: ga4ServiceAccounts
      })
      .from(ga4PropertyAccess)
      .leftJoin(ga4ServiceAccounts, eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id))
      .where(eq(ga4PropertyAccess.clientId, clientId));

      return records.map(record => ({
        ...record.propertyAccess,
        serviceAccount: record.serviceAccount!
      }));
    } catch (error) {
      logger.error(`Failed to get property access for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Get the best available service account for a new client
   * Based on current property count and availability
   */
  async getBestAvailableServiceAccount(): Promise<GA4ServiceAccount | null> {
    try {
      // Get service accounts with their current property counts
      const serviceAccountsWithCounts = await db.select({
        serviceAccount: ga4ServiceAccounts,
        propertyCount: db.$count(ga4PropertyAccess, eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id))
      })
      .from(ga4ServiceAccounts)
      .leftJoin(ga4PropertyAccess, eq(ga4ServiceAccounts.id, ga4PropertyAccess.serviceAccountId))
      .where(eq(ga4ServiceAccounts.active, true))
      .groupBy(ga4ServiceAccounts.id);

      if (!serviceAccountsWithCounts.length) {
        return null;
      }

      // Find service account with lowest property count (removed max properties limit)
      const availableAccount = serviceAccountsWithCounts
        .sort((a, b) => a.propertyCount - b.propertyCount)[0];

      return availableAccount?.serviceAccount || null;
    } catch (error) {
      logger.error('Failed to find available service account:', error);
      throw error;
    }
  }

  /**
   * Update last used timestamp for a service account
   */
  async updateServiceAccountUsage(serviceAccountId: string): Promise<void> {
    try {
      await db.update(ga4ServiceAccounts)
        .set({ lastUsed: new Date() })
        .where(eq(ga4ServiceAccounts.id, serviceAccountId));
    } catch (error) {
      logger.error(`Failed to update service account usage ${serviceAccountId}:`, error);
    }
  }

  /**
   * Get analytics for service account management
   */
  async getServiceAccountAnalytics() {
    try {
      const analytics = await db.select({
        serviceAccount: ga4ServiceAccounts,
        totalProperties: db.$count(ga4PropertyAccess, eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id)),
        verifiedProperties: db.$count(ga4PropertyAccess, and(
          eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id),
          eq(ga4PropertyAccess.accessVerified, true)
        )),
        activeClients: db.$count(ga4PropertyAccess, and(
          eq(ga4PropertyAccess.serviceAccountId, ga4ServiceAccounts.id),
          eq(ga4PropertyAccess.syncStatus, 'success')
        ))
      })
      .from(ga4ServiceAccounts)
      .leftJoin(ga4PropertyAccess, eq(ga4ServiceAccounts.id, ga4PropertyAccess.serviceAccountId))
      .groupBy(ga4ServiceAccounts.id);

      return analytics;
    } catch (error) {
      logger.error('Failed to get service account analytics:', error);
      throw error;
    }
  }
}

export const ga4ServiceAccountManager = new GA4ServiceAccountManager();
export default GA4ServiceAccountManager;