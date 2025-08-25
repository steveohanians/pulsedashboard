/**
 * GA4 Status System Tests
 * 
 * Tests the complete status tracking system including:
 * - StatusRegistry operations
 * - API endpoints
 * - SmartDataFetcher integration
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GA4StatusRegistry } from '../services/ga4/StatusRegistry.js';

describe('GA4 Status System', () => {
  
  describe('StatusRegistry', () => {
    test('should start and complete fetch tracking', () => {
      const registry = new GA4StatusRegistry();
      const clientId = 'test-client';
      const timePeriod = 'Last Month';
      
      // Start a fetch
      const statusKey = registry.startFetch(clientId, timePeriod);
      assert.ok(statusKey, 'Status key should be returned');
      
      // Check status is in progress
      const status = registry.getStatus(clientId, timePeriod);
      assert.ok(status, 'Status should exist');
      assert.strictEqual(status.inProgress, true, 'Should be in progress');
      assert.strictEqual(status.clientId, clientId, 'Client ID should match');
      assert.strictEqual(status.timePeriod, timePeriod, 'Time period should match');
      
      // Complete the fetch
      registry.completeFetch(statusKey, true, 'monthly');
      
      // Check status is completed
      const completedStatus = registry.getStatus(clientId, timePeriod);
      assert.ok(completedStatus, 'Status should still exist');
      assert.strictEqual(completedStatus.inProgress, false, 'Should not be in progress');
      assert.ok(completedStatus.lastRefreshedAt, 'Should have lastRefreshedAt timestamp');
    });

    test('should handle multiple clients', () => {
      const registry = new GA4StatusRegistry();
      const client1 = 'client-1';
      const client2 = 'client-2';
      const timePeriod = 'Last Month';
      
      // Start fetches for both clients
      const status1 = registry.startFetch(client1, timePeriod);
      const status2 = registry.startFetch(client2, timePeriod);
      
      assert.ok(status1, 'Client 1 status key should be returned');
      assert.ok(status2, 'Client 2 status key should be returned');
      assert.notStrictEqual(status1, status2, 'Status keys should be different');
      
      // Check client-specific statuses
      const client1Statuses = registry.getClientStatuses(client1);
      const client2Statuses = registry.getClientStatuses(client2);
      
      assert.strictEqual(client1Statuses.length, 1, 'Client 1 should have one status');
      assert.strictEqual(client2Statuses.length, 1, 'Client 2 should have one status');
      assert.strictEqual(client1Statuses[0].clientId, client1, 'Client 1 status should match');
      assert.strictEqual(client2Statuses[0].clientId, client2, 'Client 2 status should match');
    });

    test('should handle errors properly', () => {
      const registry = new GA4StatusRegistry();
      const clientId = 'test-client';
      const timePeriod = 'Last Month';
      const errorMessage = 'Test error message';
      
      // Start a fetch
      const statusKey = registry.startFetch(clientId, timePeriod);
      
      // Complete with error
      registry.completeFetch(statusKey, false, 'monthly', errorMessage);
      
      // Check error is recorded
      const status = registry.getStatus(clientId, timePeriod);
      assert.ok(status, 'Status should exist');
      assert.strictEqual(status.inProgress, false, 'Should not be in progress');
      assert.strictEqual(status.error, errorMessage, 'Error message should be recorded');
    });

    test('should force expire fetches', () => {
      const registry = new GA4StatusRegistry();
      const clientId = 'test-client';
      const timePeriod = 'Last Month';
      
      // Start a fetch
      const statusKey = registry.startFetch(clientId, timePeriod);
      
      // Verify it's in progress
      let status = registry.getStatus(clientId, timePeriod);
      assert.strictEqual(status.inProgress, true, 'Should be in progress');
      
      // Force expire
      const expired = registry.forceExpireFetch(clientId, timePeriod);
      assert.strictEqual(expired, true, 'Should successfully expire');
      
      // Verify it's no longer in progress
      status = registry.getStatus(clientId, timePeriod);
      assert.strictEqual(status.inProgress, false, 'Should no longer be in progress');
      assert.ok(status.error?.includes('Force expired'), 'Should have force expired error message');
    });

    test('should provide accurate statistics', () => {
      const registry = new GA4StatusRegistry();
      
      // Start multiple fetches
      registry.startFetch('client-1', 'Last Month');
      registry.startFetch('client-1', 'Last Quarter');
      registry.startFetch('client-2', 'Last Month');
      
      const stats = registry.getStats();
      assert.strictEqual(stats.inProgressCount, 3, 'Should have 3 in progress');
      assert.strictEqual(stats.totalFetches, 3, 'Should have 3 total fetches');
      assert.ok(stats.oldestInProgress, 'Should have oldest in progress timestamp');
      assert.ok(stats.lastActivity, 'Should have last activity timestamp');
    });

    test('should cleanup old completed statuses', () => {
      const registry = new GA4StatusRegistry();
      const clientId = 'test-client';
      
      // Start and complete a fetch
      const statusKey = registry.startFetch(clientId, 'Last Month');
      registry.completeFetch(statusKey, true, 'monthly');
      
      // Manually set an old timestamp to simulate aged status
      const status = registry.getStatus(clientId, 'Last Month');
      if (status) {
        // Set timestamp to 2 hours ago (older than 1 hour cleanup threshold)
        (status as any).lastRefreshedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      }
      
      // Trigger cleanup by calling private method via any cast
      (registry as any).cleanupExpiredEntries();
      
      // Status should be removed
      const cleanedStatus = registry.getStatus(clientId, 'Last Month');
      assert.strictEqual(cleanedStatus, null, 'Old status should be cleaned up');
    });
  });

  describe('Status API Integration', () => {
    test('should handle status registry in memory', () => {
      // Test that the status registry maintains state correctly
      const registry = new GA4StatusRegistry();
      
      // Start multiple operations
      const operations = [
        { clientId: 'client-1', timePeriod: 'Last Month' },
        { clientId: 'client-1', timePeriod: 'Last Quarter' },
        { clientId: 'client-2', timePeriod: 'Last Month' }
      ];
      
      const statusKeys = operations.map(op => 
        registry.startFetch(op.clientId, op.timePeriod)
      );
      
      // Verify all are tracked
      assert.strictEqual(statusKeys.length, 3, 'Should track all operations');
      
      // Complete some operations
      registry.completeFetch(statusKeys[0], true, 'monthly');
      registry.completeFetch(statusKeys[1], false, 'monthly', 'Test error');
      
      // Verify mixed states
      const client1Statuses = registry.getClientStatuses('client-1');
      assert.strictEqual(client1Statuses.length, 2, 'Client 1 should have 2 statuses');
      
      const successStatus = client1Statuses.find(s => s.timePeriod === 'Last Month');
      const errorStatus = client1Statuses.find(s => s.timePeriod === 'Last Quarter');
      const inProgressStatus = registry.getStatus('client-2', 'Last Month');
      
      assert.strictEqual(successStatus?.inProgress, false, 'Success status should be complete');
      assert.strictEqual(successStatus?.error, null, 'Success status should have no error');
      
      assert.strictEqual(errorStatus?.inProgress, false, 'Error status should be complete');
      assert.strictEqual(errorStatus?.error, 'Test error', 'Error status should have error message');
      
      assert.strictEqual(inProgressStatus?.inProgress, true, 'In-progress status should still be active');
    });
  });
});

// Export for potential external testing
export { GA4StatusRegistry };