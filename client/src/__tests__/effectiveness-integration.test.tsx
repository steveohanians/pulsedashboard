import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { effectivenessApi } from '@/services/api/EffectivenessApiService';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Effectiveness Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Complete Effectiveness Workflow', () => {
    it('should handle full analysis lifecycle from start to completion', async () => {
      const clientId = 'test-client-workflow';
      const runId = 'test-run-workflow';

      // Mock API responses for different stages
      const mockResponses = [
        // Initial fetch - no run
        { run: null, client: { id: clientId, name: 'Test Client' } },
        // After refresh - pending run
        { 
          run: { id: runId, status: 'pending', clientId }, 
          client: { id: clientId, name: 'Test Client' } 
        },
        // Progress updates
        { 
          run: { id: runId, status: 'tier1_analyzing', clientId }, 
          client: { id: clientId, name: 'Test Client' } 
        },
        {
          run: { id: runId, status: 'tier1_complete', clientId },
          client: { id: clientId, name: 'Test Client' }
        },
        {
          run: { id: runId, status: 'tier2_analyzing', clientId },
          client: { id: clientId, name: 'Test Client' }
        },
        // Final completion
        {
          run: {
            id: runId,
            status: 'completed',
            clientId,
            overallScore: 8.5,
            criterionScores: [
              { id: '1', criterion: 'positioning', score: 9 },
              { id: '2', criterion: 'brand_story', score: 8 }
            ]
          },
          client: { id: clientId, name: 'Test Client' }
        }
      ];

      let responseIndex = 0;
      vi.mocked(fetch).mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('refresh')) {
          // Mock refresh endpoint
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        } else {
          // Mock latest effectiveness endpoint
          const response = mockResponses[responseIndex] || mockResponses[mockResponses.length - 1];
          responseIndex++;
          return new Response(JSON.stringify(response), { status: 200 });
        }
      });

      // Test complete workflow
      const stateManager = EffectivenessStateManager.getInstance(queryClient);

      // 1. Start analysis
      stateManager.startNewAnalysis(clientId);
      await stateManager.forceProcessQueue();

      // 2. Fetch initial state
      let data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.client.id).toBe(clientId);

      // 3. Refresh to start analysis
      await effectivenessApi.refreshEffectiveness(clientId);
      data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.run.status).toBe('pending');

      // 4. Simulate progress updates
      data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.run.status).toBe('tier1_analyzing');

      data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.run.status).toBe('tier1_complete');

      // 5. Handle completion
      data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.run.status).toBe('completed');
      expect(data.run.overallScore).toBe(8.5);
      expect(data.run.criterionScores).toHaveLength(2);

      stateManager.handleRunCompletion(clientId, runId, data);
      await stateManager.forceProcessQueue();
    });

    it('should handle state recovery after interruption', async () => {
      const clientId = 'test-client-recovery';
      const runId = 'test-run-recovery';

      // Mock interrupted state
      const interruptedState = {
        clientId,
        runId,
        lastStatus: 'tier1_analyzing',
        timestamp: Date.now(),
        retryCount: 0
      };

      // Mock sessionStorage
      const mockStorage = {
        getItem: vi.fn(() => JSON.stringify(interruptedState)),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };

      Object.defineProperty(window, 'sessionStorage', {
        value: mockStorage,
        writable: true
      });

      // Mock recovery scenario - run completed during interruption
      const completedResponse = {
        run: {
          id: runId,
          status: 'completed',
          clientId,
          overallScore: 7.8
        },
        client: { id: clientId, name: 'Recovered Client' }
      };

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(completedResponse), { status: 200 })
      );

      const stateRecovery = new EffectivenessStateRecovery(queryClient);
      
      // Attempt recovery
      const recovered = await stateRecovery.checkAndRecover();
      expect(recovered).toBe(true);
      
      // Should clear recovery state on completion
      expect(mockStorage.removeItem).toHaveBeenCalledWith('effectiveness_recovery_state');
    });

    it('should handle API validation errors gracefully', async () => {
      const clientId = 'test-client-validation';

      // Mock invalid response
      const invalidResponse = { invalidField: 'invalid data' };
      
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify(invalidResponse), { status: 200 })
      );

      // Should throw validation error
      await expect(effectivenessApi.getLatestEffectiveness(clientId))
        .rejects.toThrow('Invalid response');
    });

    it('should handle network failures with circuit breaker', async () => {
      const clientId = 'test-client-network-failure';

      // Mock network failures
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'));

      // Should trigger circuit breaker after failures
      await expect(effectivenessApi.getLatestEffectiveness(clientId))
        .rejects.toThrow();
      
      await expect(effectivenessApi.getLatestEffectiveness(clientId))
        .rejects.toThrow();
      
      await expect(effectivenessApi.getLatestEffectiveness(clientId))
        .rejects.toThrow();

      // Circuit breaker should be open
      await expect(effectivenessApi.getLatestEffectiveness(clientId))
        .rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle evidence and insights workflow', async () => {
      const clientId = 'test-client-evidence';
      const runId = 'test-run-evidence';

      // Mock evidence response
      const evidenceResponse = {
        evidence: [
          {
            id: 'evidence-1',
            criterion: 'positioning',
            type: 'text',
            content: 'Clear value proposition'
          },
          {
            id: 'evidence-2',
            criterion: 'brand_story',
            type: 'visual',
            content: 'Brand story section'
          }
        ]
      };

      // Mock insights response
      const insightsResponse = {
        success: true,
        insights: {
          insight: 'Strong positioning with clear value proposition',
          recommendations: [
            'Enhance brand story section',
            'Add more trust signals'
          ],
          confidence: 0.85,
          key_pattern: 'clear_messaging'
        },
        clientName: 'Test Client',
        overallScore: 8.2,
        runId
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(evidenceResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(insightsResponse), { status: 200 }));

      // Test evidence workflow
      const evidence = await effectivenessApi.getEffectivenessEvidence(runId);
      expect(evidence.evidence).toHaveLength(2);
      expect(evidence.evidence[0].criterion).toBe('positioning');

      // Test insights workflow
      const insights = await effectivenessApi.generateInsights(clientId, runId);
      expect(insights.success).toBe(true);
      expect(insights.insights.confidence).toBe(0.85);
      expect(insights.insights.recommendations).toHaveLength(2);
    });
  });

  describe('Atomic State Management Integration', () => {
    it('should handle concurrent state operations without conflicts', async () => {
      const clientId = 'test-client-concurrent';
      const stateManager = EffectivenessStateManager.getInstance(queryClient);

      // Simulate concurrent operations
      const operations = [
        () => stateManager.updateEffectivenessRun(clientId, {
          id: 'run-1', status: 'pending', clientId
        }),
        () => stateManager.refreshEffectivenessData(clientId, 'concurrent test 1'),
        () => stateManager.updateEffectivenessRun(clientId, {
          id: 'run-1', status: 'analyzing', clientId
        }),
        () => stateManager.refreshEffectivenessData(clientId, 'concurrent test 2'),
        () => stateManager.handleRunCompletion(clientId, 'run-1', {
          run: { id: 'run-1', status: 'completed', clientId }
        })
      ];

      // Execute all operations
      operations.forEach(op => op());

      const initialStatus = stateManager.getQueueStatus();
      expect(initialStatus.pending).toBe(5);

      // Process all operations atomically
      await stateManager.forceProcessQueue();

      const finalStatus = stateManager.getQueueStatus();
      expect(finalStatus.pending).toBe(0);
      expect(finalStatus.processing).toBe(false);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should integrate all error recovery mechanisms', async () => {
      const clientId = 'test-client-error-recovery';
      const runId = 'test-run-error-recovery';

      // Test sequence: network error -> validation error -> success
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ invalid: 'data' }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            run: { id: runId, status: 'completed', clientId },
            client: { id: clientId, name: 'Test Client' }
          }), { status: 200 })
        );

      const stateManager = EffectivenessStateManager.getInstance(queryClient);

      // Should handle network error
      try {
        await effectivenessApi.getLatestEffectiveness(clientId);
      } catch (error) {
        expect(error.message).toContain('Network');
      }

      // Should handle validation error
      try {
        await effectivenessApi.getLatestEffectiveness(clientId);
      } catch (error) {
        expect(error.message).toContain('Invalid response');
        stateManager.cleanupFailedEffectivenessState(clientId);
      }

      // Should succeed after cleanup
      const data = await effectivenessApi.getLatestEffectiveness(clientId);
      expect(data.run.status).toBe('completed');
    });
  });
});