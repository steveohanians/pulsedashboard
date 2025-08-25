/**
 * Error Handling Tests
 * 
 * Tests for the comprehensive error handling system including:
 * - Error banner display for different error types
 * - Proper error code mapping
 * - Retry functionality
 * - User interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBanner, useErrorBanner } from '@/components/ErrorBanner';
import { APIError } from '@/lib/queryClient';
import { ERROR_CODES } from '@shared/errorTypes';
import { apiRequest } from '@/lib/queryClient';

// Mock component to test the useErrorBanner hook
function TestErrorBannerComponent() {
  const { error, showError, dismissError, clearError } = useErrorBanner();

  const handleSchemaError = () => {
    const error = new APIError(
      ERROR_CODES.SCHEMA_MISMATCH,
      'Data contract has changed',
      422,
      'Data structure has been updated. Please retry or contact admin if issues persist.',
      true
    );
    showError(error);
  };

  const handleGA4AuthError = () => {
    const error = new APIError(
      ERROR_CODES.GA4_AUTH,
      'GA4 authentication failed',
      401,
      'GA4 access needs to be reconnected. Please check authentication settings.',
      false
    );
    showError(error);
  };

  const handleGA4QuotaError = () => {
    const error = new APIError(
      ERROR_CODES.GA4_QUOTA,
      'GA4 API quota exceeded',
      429,
      'GA4 quota limit reached. Please try again later.',
      true,
      3600
    );
    showError(error);
  };

  const handleClientNotFoundError = () => {
    const error = new APIError(
      ERROR_CODES.CLIENT_NOT_FOUND,
      'Client not found',
      404,
      'Verify the client ID and ensure the client exists',
      false
    );
    showError(error);
  };

  return (
    <div>
      <button onClick={handleSchemaError} data-testid="trigger-schema-error">
        Trigger Schema Error
      </button>
      <button onClick={handleGA4AuthError} data-testid="trigger-ga4-auth-error">
        Trigger GA4 Auth Error
      </button>
      <button onClick={handleGA4QuotaError} data-testid="trigger-ga4-quota-error">
        Trigger GA4 Quota Error
      </button>
      <button onClick={handleClientNotFoundError} data-testid="trigger-client-error">
        Trigger Client Error
      </button>
      
      <ErrorBanner
        error={error}
        onRetry={() => console.log('Retry clicked')}
        onDismiss={dismissError}
      />
    </div>
  );
}

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('Error Handling System', () => {
  describe('ErrorBanner Component', () => {
    it('displays schema mismatch error with retry button', async () => {
      renderWithQueryClient(<TestErrorBannerComponent />);
      
      // Trigger schema error
      fireEvent.click(screen.getByTestId('trigger-schema-error'));
      
      // Check error banner appears
      await waitFor(() => {
        expect(screen.getByText('Data Contract Changed')).toBeInTheDocument();
        expect(screen.getByText(/Data structure has been updated/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('displays GA4 auth error with settings button', async () => {
      renderWithQueryClient(<TestErrorBannerComponent />);
      
      // Trigger GA4 auth error
      fireEvent.click(screen.getByTestId('trigger-ga4-auth-error'));
      
      // Check error banner appears
      await waitFor(() => {
        expect(screen.getByText('GA4 Authentication Required')).toBeInTheDocument();
        expect(screen.getByText(/GA4 access needs to be reconnected/)).toBeInTheDocument();
        expect(screen.getByText('Open Settings')).toBeInTheDocument();
      });
    });

    it('displays GA4 quota error with disabled retry', async () => {
      renderWithQueryClient(<TestErrorBannerComponent />);
      
      // Trigger GA4 quota error
      fireEvent.click(screen.getByTestId('trigger-ga4-quota-error'));
      
      // Check error banner appears
      await waitFor(() => {
        expect(screen.getByText('GA4 Quota Exceeded')).toBeInTheDocument();
        expect(screen.getByText(/GA4 quota limit reached/)).toBeInTheDocument();
        
        // Retry button should be disabled for quota errors
        const retryButton = screen.getByText('Retry Later');
        expect(retryButton).toBeDisabled();
      });
    });

    it('displays client not found error without retry', async () => {
      renderWithQueryClient(<TestErrorBannerComponent />);
      
      // Trigger client error
      fireEvent.click(screen.getByTestId('trigger-client-error'));
      
      // Check error banner appears
      await waitFor(() => {
        expect(screen.getByText('Client Not Found')).toBeInTheDocument();
        expect(screen.getByText(/Verify the client ID/)).toBeInTheDocument();
        
        // Should not have retry button for client not found
        expect(screen.queryByText('Retry')).not.toBeInTheDocument();
      });
    });

    it('allows dismissing error banners', async () => {
      renderWithQueryClient(<TestErrorBannerComponent />);
      
      // Trigger an error
      fireEvent.click(screen.getByTestId('trigger-schema-error'));
      
      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Data Contract Changed')).toBeInTheDocument();
      });
      
      // Click dismiss button
      const dismissButton = screen.getByRole('button', { name: /close|dismiss/i });
      fireEvent.click(dismissButton);
      
      // Error should be dismissed
      await waitFor(() => {
        expect(screen.queryByText('Data Contract Changed')).not.toBeInTheDocument();
      });
    });
  });

  describe('API Error Handling', () => {
    // Mock fetch for testing API error responses
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('handles standardized error responses correctly', async () => {
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'SCHEMA_MISMATCH',
          message: 'Data contract has changed',
          hint: 'Data structure has been updated. Please retry or contact admin.',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve(JSON.stringify(mockErrorResponse))
      });

      try {
        await apiRequest('GET', '/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).code).toBe(ERROR_CODES.SCHEMA_MISMATCH);
        expect((error as APIError).statusCode).toBe(422);
        expect((error as APIError).retryable).toBe(true);
      }
    });

    it('maps legacy HTTP status codes to error codes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      });

      try {
        await apiRequest('GET', '/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).code).toBe(ERROR_CODES.UNAUTHENTICATED);
        expect((error as APIError).statusCode).toBe(401);
      }
    });

    it('handles network errors properly', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      try {
        await apiRequest('GET', '/api/test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('Error Banner Integration', () => {
    it('displays appropriate error banners for different scenarios', () => {
      const mockRetry = vi.fn();
      const mockDismiss = vi.fn();

      // Test schema mismatch error
      const schemaError = new APIError(
        ERROR_CODES.SCHEMA_MISMATCH,
        'Data contract changed',
        422,
        'Please retry or contact admin',
        true
      );

      const { rerender } = render(
        <ErrorBanner
          error={schemaError}
          onRetry={mockRetry}
          onDismiss={mockDismiss}
        />
      );

      expect(screen.getByText('Data Contract Changed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();

      // Test GA4 quota error
      const quotaError = new APIError(
        ERROR_CODES.GA4_QUOTA,
        'Quota exceeded',
        429,
        'Try again later',
        true,
        3600
      );

      rerender(
        <ErrorBanner
          error={quotaError}
          onRetry={mockRetry}
          onDismiss={mockDismiss}
        />
      );

      expect(screen.getByText('GA4 Quota Exceeded')).toBeInTheDocument();
      expect(screen.getByText(/Retry in 60 minute/)).toBeInTheDocument();
    });
  });
});

// Integration test with React Query
describe('Error Handling with React Query', () => {
  it('integrates error handling with query mutations', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock an API error response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve(JSON.stringify({
        success: false,
        error: {
          code: 'SCHEMA_MISMATCH',
          message: 'Data contract changed',
          retryable: true
        }
      }))
    });

    renderWithQueryClient(<TestErrorBannerComponent />);

    // Simulate an API call that triggers an error
    try {
      await apiRequest('GET', '/api/dashboard/test');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).code).toBe(ERROR_CODES.SCHEMA_MISMATCH);
    }
  });
});