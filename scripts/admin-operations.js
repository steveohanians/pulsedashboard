#!/usr/bin/env node
/**
 * Admin Operations Script
 * Handles common admin operations with proper authentication and error handling
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pulsedashboard.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cleardigital123';

class AdminAPI {
  constructor() {
    this.sessionCookie = null;
  }

  async login() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD
        })
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      // Extract session cookie
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        this.sessionCookie = setCookieHeader.split(';')[0];
      }

      const result = await response.json();
      console.log('✓ Successfully authenticated as admin');
      return result;
    } catch (error) {
      console.error('✗ Authentication failed:', error.message);
      throw error;
    }
  }

  async makeRequest(method, endpoint, body = null) {
    if (!this.sessionCookie) {
      await this.login();
    }

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, options);
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`✗ Request failed [${method} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  async refreshGA4Data(clientId) {
    console.log(`🔄 Refreshing GA4 data for client: ${clientId}`);
    return await this.makeRequest('POST', `/api/ga4-data/refresh/${clientId}`);
  }

  async syncGA4Data(clientId) {
    console.log(`🔄 Syncing GA4 data for client: ${clientId}`);
    return await this.makeRequest('POST', `/api/ga4-data/sync/${clientId}`);
  }

  async getClients() {
    console.log('📊 Fetching all clients');
    return await this.makeRequest('GET', '/api/admin/clients');
  }

  async getGA4PropertyAccess(clientId) {
    console.log(`🔍 Getting GA4 property access for client: ${clientId}`);
    return await this.makeRequest('GET', `/api/admin/ga4-property-access/client/${clientId}`);
  }

  async updatePropertyAccess(accessId, updateData) {
    console.log(`📝 Updating property access: ${accessId}`);
    return await this.makeRequest('PUT', `/api/admin/ga4-property-access/${accessId}`, updateData);
  }

  async verifyPropertyAccess(accessId) {
    console.log(`✅ Verifying property access: ${accessId}`);
    return await this.makeRequest('POST', `/api/admin/ga4-property-access/${accessId}/verify`);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const clientId = args[1];

  const api = new AdminAPI();

  try {
    switch (command) {
      case 'refresh-ga4':
        if (!clientId) throw new Error('Client ID required');
        const refreshResult = await api.refreshGA4Data(clientId);
        console.log('✓ GA4 data refresh completed:', refreshResult);
        break;

      case 'sync-ga4':
        if (!clientId) throw new Error('Client ID required');
        const syncResult = await api.syncGA4Data(clientId);
        console.log('✓ GA4 data sync completed:', syncResult);
        break;

      case 'list-clients':
        const clients = await api.getClients();
        console.log('📋 Clients:', clients.map(c => `${c.id}: ${c.name}`));
        break;

      case 'check-property':
        if (!clientId) throw new Error('Client ID required');
        const propertyAccess = await api.getGA4PropertyAccess(clientId);
        console.log('🔍 Property Access:', propertyAccess);
        break;

      default:
        console.log(`
Usage: node scripts/admin-operations.js <command> [clientId]

Commands:
  refresh-ga4 <clientId>   - Refresh GA4 data for client
  sync-ga4 <clientId>      - Sync GA4 data for client  
  list-clients             - List all clients
  check-property <clientId> - Check GA4 property access for client

Example:
  node scripts/admin-operations.js refresh-ga4 demo-client-id
        `);
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AdminAPI };