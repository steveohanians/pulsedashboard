import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from '../ErrorHandler';
import { NetworkError, ValidationError, AuthError } from '../ErrorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ErrorHandler.clearRetryHistory();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      const classified = ErrorHandler.classifyError(networkError);
      
      expect(classified).toBeInstanceOf(NetworkError);
      expect(classified.message).toBe('Network request failed');
      expect(classified.isRetryable).toBe(true);
    });

    it('should classify validation errors correctly', () => {
      const validationError = new Error('Invalid input data');
      validationError.name = 'ValidationError';
      
      const classified = ErrorHandler.classifyError(validationError);
      
      expect(classified).toBeInstanceOf(ValidationError);
      expect(classified.isRetryable).toBe(false);
    });

    it('should classify auth errors correctly', () => {
      const authError = new Error('Unauthorized access');
      authError.name = 'AuthError';
      
      const classified = ErrorHandler.classifyError(authError);
      
      expect(classified).toBeInstanceOf(AuthError);
      expect(classified.isRetryable).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should calculate backoff delay correctly', () => {
      const delay1 = ErrorHandler.calculateBackoffDelay(1);
      const delay2 = ErrorHandler.calculateBackoffDelay(2);
      const delay3 = ErrorHandler.calculateBackoffDelay(3);

      expect(delay1).toBe(1000); // 1s
      expect(delay2).toBe(2000); // 2s  
      expect(delay3).toBe(4000); // 4s
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should respect maximum retry attempts', () => {
      const shouldRetry1 = ErrorHandler.shouldRetry('test-key', 1);
      const shouldRetry2 = ErrorHandler.shouldRetry('test-key', 2);
      const shouldRetry3 = ErrorHandler.shouldRetry('test-key', 3);
      const shouldRetry4 = ErrorHandler.shouldRetry('test-key', 4);

      expect(shouldRetry1).toBe(true);
      expect(shouldRetry2).toBe(true);
      expect(shouldRetry3).toBe(true);
      expect(shouldRetry4).toBe(false); // Exceeds max retries
    });
  });

  describe('Error Context', () => {
    it('should generate development context', () => {
      const originalEnv = import.meta.env.DEV;
      // @ts-ignore
      import.meta.env.DEV = true;

      const error = new Error('Test error');
      const context = ErrorHandler.getErrorContext(error, 'test-operation');

      expect(context).toContain('Operation: test-operation');
      expect(context).toContain('Error: Test error');
      expect(context).toContain('Stack trace:');

      // @ts-ignore
      import.meta.env.DEV = originalEnv;
    });

    it('should generate production context', () => {
      const originalEnv = import.meta.env.DEV;
      // @ts-ignore
      import.meta.env.DEV = false;

      const error = new Error('Test error');
      const context = ErrorHandler.getErrorContext(error, 'test-operation');

      expect(context).toContain('Operation: test-operation');
      expect(context).toContain('Error: Test error');
      expect(context).not.toContain('Stack trace:');

      // @ts-ignore
      import.meta.env.DEV = originalEnv;
    });
  });
});