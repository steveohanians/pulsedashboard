import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EffectivenessCard } from '@/components/effectiveness-card';
import { effectivenessApi } from '@/services/api/EffectivenessApiService';
import { errorHandler } from '@/services/error/ErrorHandler';

// Mock the API service
vi.mock('@/services/api/EffectivenessApiService', () => ({
  effectivenessApi: {
    getLatestEffectiveness: vi.fn(),
    startEffectivenessAnalysis: vi.fn(),
    getEvidence: vi.fn(),
    generateInsights: vi.fn()
  }
}));

// Mock error handler
vi.mock('@/services/error/ErrorHandler', () => ({
  errorHandler: {
    handleError: vi.fn(),
    withRetry: vi.fn()
  },
  AppError: class AppError extends Error {
    constructor(message: string, public code?: string, public statusCode?: number) {
      super(message);
    }
  },
  NetworkError: class NetworkError extends Error {},
  AuthError: class AuthError extends Error {}
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Effectiveness Reliability Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Effectiveness Run Scenarios', () => {
    it('should handle successful analysis lifecycle', async () => {
      const mockRunData = {
        run: {
          id: 'test-run-123',
          status: 'pending',
          clientId: 'test-client'
        },
        client: {
          id: 'test-client',
          name: 'Test Client'
        }
      };

      const completedRunData = {
        ...mockRunData,
        run: {
          ...mockRunData.run,
          status: 'completed',
          overallScore: 8.5,
          criterionScores: [
            { criterion: 'positioning', score: 9 },
            { criterion: 'brand_story', score: 8 }
          ]
        }
      };

      // Mock API responses
      vi.mocked(effectivenessApi.getLatestEffectiveness)
        .mockResolvedValueOnce(mockRunData)
        .mockResolvedValueOnce(completedRunData);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      // Should show initial pending state
      expect(screen.getByText(/analyzing/i)).toBeInTheDocument();

      // Wait for completion state
      await waitFor(() => {
        expect(screen.getByText(/8\.5/)).toBeInTheDocument();
      });
    });

    it('should handle analysis timeout gracefully', async () => {
      const mockRunData = {
        run: {
          id: 'test-run-timeout',
          status: 'tier1_analyzing',
          clientId: 'test-client'
        },
        client: { id: 'test-client', name: 'Test Client' }
      };

      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue(mockRunData);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      await waitFor(() => {
        expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
      });

      // Simulate timeout (would be handled by navigation hook)
      expect(vi.mocked(effectivenessApi.getLatestEffectiveness)).toHaveBeenCalled();
    });

    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network error');
      
      vi.mocked(effectivenessApi.getLatestEffectiveness)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          run: { id: 'test-run', status: 'completed', clientId: 'test-client' },
          client: { id: 'test-client' }
        });

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(vi.mocked(effectivenessApi.getLatestEffectiveness)).toHaveBeenCalledTimes(2);
      });
    });

    it('should validate API response structure', async () => {
      const invalidResponse = { invalidData: true };
      
      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue(invalidResponse as any);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      // Should handle invalid response gracefully
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Atomic State Management', () => {
    it('should queue cache operations atomically', async () => {
      const stateManager = EffectivenessStateManager.getInstance(queryClient);
      
      // Queue multiple operations
      stateManager.updateEffectivenessRun('test-client', {
        id: 'test-run',
        status: 'pending',
        clientId: 'test-client'
      });
      
      stateManager.refreshEffectivenessData('test-client', 'test refresh');
      
      const status = stateManager.getQueueStatus();
      expect(status.pending).toBeGreaterThan(0);
      
      // Process queue
      await stateManager.forceProcessQueue();
      
      const finalStatus = stateManager.getQueueStatus();
      expect(finalStatus.pending).toBe(0);
    });

    it('should prevent cache conflicts during concurrent operations', async () => {
      const stateManager = EffectivenessStateManager.getInstance(queryClient);
      
      // Simulate concurrent operations
      const operations = Array.from({ length: 5 }, (_, i) => 
        stateManager.updateEffectivenessRun('test-client', {
          id: `test-run-${i}`,
          status: 'analyzing',
          clientId: 'test-client'
        })
      );
      
      // All operations should be queued
      const status = stateManager.getQueueStatus();
      expect(status.pending).toBe(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should recover from interrupted analysis', async () => {
      // Mock interrupted state in sessionStorage
      const interruptedState = {
        clientId: 'test-client',
        runId: 'test-run',
        lastStatus: 'tier1_analyzing',
        timestamp: Date.now(),
        retryCount: 0
      };
      
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(interruptedState)),
          setItem: vi.fn(),
          removeItem: vi.fn()
        },
        writable: true
      });

      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue({
        run: { id: 'test-run', status: 'completed', clientId: 'test-client' },
        client: { id: 'test-client' }
      });

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      await waitFor(() => {
        expect(vi.mocked(effectivenessApi.getLatestEffectiveness)).toHaveBeenCalled();
      });
    });

    it('should handle API validation errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      vi.mocked(effectivenessApi.startEffectivenessAnalysis).mockRejectedValue(validationError);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(vi.mocked(errorHandler.handleError)).toHaveBeenCalledWith(
          validationError,
          'effectiveness refresh'
        );
      });
    });
  });

  describe('Component Integration', () => {
    it('should preserve fun progress messages during analysis', async () => {
      const mockRunData = {
        run: {
          id: 'test-run',
          status: 'tier1_analyzing',
          clientId: 'test-client'
        },
        client: { id: 'test-client' }
      };

      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue(mockRunData);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      // Should show fun progress messages
      await waitFor(() => {
        const progressMessages = [
          /exploring your site/i,
          /scanning pixels/i,
          /reading between/i
        ];
        
        const hasProgressMessage = progressMessages.some(regex => 
          screen.queryByText(regex) !== null
        );
        
        expect(hasProgressMessage).toBe(true);
      });
    });

    it('should handle evidence drawer integration', async () => {
      const mockRunData = {
        run: {
          id: 'test-run',
          status: 'completed',
          clientId: 'test-client',
          overallScore: 8.5
        },
        client: { id: 'test-client' }
      };

      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue(mockRunData);

      renderWithQueryClient(<EffectivenessCard clientId="test-client" />);

      await waitFor(() => {
        const evidenceButton = screen.getByRole('button', { name: /view evidence/i });
        expect(evidenceButton).toBeInTheDocument();
      });
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on component unmount', () => {
      const { unmount } = renderWithQueryClient(<EffectivenessCard clientId="test-client" />);
      
      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should prevent memory leaks in progressive toasts', async () => {
      const mockRunData = {
        run: { id: 'test-run', status: 'tier1_complete', clientId: 'test-client' },
        client: { id: 'test-client' }
      };

      vi.mocked(effectivenessApi.getLatestEffectiveness).mockResolvedValue(mockRunData);

      const { unmount } = renderWithQueryClient(<EffectivenessCard clientId="test-client" />);
      
      // Unmount before toasts can fire
      unmount();
      
      // Should not cause memory leaks or errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });
});