import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clientService } from '../client.service';
import { cacheManager } from '../../cache/CacheManager';
import { eventBus } from '../../events/EventBus';

// Mock dependencies
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../../cache/CacheManager', () => ({
  cacheManager: {
    invalidate: vi.fn(),
  },
}));

vi.mock('../../events/EventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

describe('ClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('delete', () => {
    it('should delete client and invalidate cache', async () => {
      const { apiRequest } = await import('@/lib/queryClient');
      vi.mocked(apiRequest).mockResolvedValue(undefined);

      await clientService.delete('client-1');

      expect(apiRequest).toHaveBeenCalledWith('DELETE', '/api/admin/clients/client-1', undefined);
      expect(cacheManager.invalidate).toHaveBeenCalledWith('client');
    });
  });

  describe('triggerGA4Sync', () => {
    it('should emit events and call sync endpoint', async () => {
      const { apiRequest } = await import('@/lib/queryClient');
      vi.mocked(apiRequest).mockResolvedValue({ success: true });

      await clientService.triggerGA4Sync('client-1');

      expect(eventBus.emit).toHaveBeenCalledWith('ga4.sync.started', { clientId: 'client-1' });
      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/admin/clients/client-1/sync-ga4', undefined);
      expect(eventBus.emit).toHaveBeenCalledWith('ga4.sync.completed', expect.objectContaining({
        clientId: 'client-1',
      }));
    });

    it('should emit failure event on error', async () => {
      const { apiRequest } = await import('@/lib/queryClient');
      const error = new Error('Sync failed');
      vi.mocked(apiRequest).mockRejectedValue(error);

      await expect(clientService.triggerGA4Sync('client-1')).rejects.toThrow('Sync failed');

      expect(eventBus.emit).toHaveBeenCalledWith('ga4.sync.failed', expect.objectContaining({
        clientId: 'client-1',
        error,
      }));
    });
  });

  describe('createWithGA4Setup', () => {
    it('should create client and trigger GA4 sync if requested', async () => {
      const { apiRequest } = await import('@/lib/queryClient');
      const newClient = { id: 'new-client', name: 'New Client' };
      vi.mocked(apiRequest).mockResolvedValue(newClient);

      const data = {
        name: 'New Client',
        ga4PropertyId: '123456789',
        serviceAccountId: 'sa-1',
        autoSyncGA4: true,
      };

      const result = await clientService.createWithGA4Setup(data);

      expect(result).toEqual(newClient);
      expect(eventBus.emit).toHaveBeenCalledWith('client.created', expect.any(Object));
      expect(eventBus.emit).toHaveBeenCalledWith('client.ga4.connected', expect.any(Object));
      expect(eventBus.emit).toHaveBeenCalledWith('ga4.sync.started', expect.any(Object));
    });
  });
});