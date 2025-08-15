import { APP_CONFIG } from '@/config/app.config';
import { toast } from '@/hooks/use-toast';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network error occurred', details?: any) {
    super(message, 'NETWORK_ERROR', 0, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication failed', details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
  }
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private retryMap = new Map<string, number>();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  async handleError(error: any, context?: string): Promise<void> {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    // Determine error type and show appropriate message
    if (error instanceof NetworkError || error.code === 'NETWORK_ERROR') {
      toast({
        title: 'Connection Error',
        description: APP_CONFIG.messages.errors.network,
        variant: 'destructive',
        duration: APP_CONFIG.toast.error,
      });
    } else if (error instanceof ValidationError) {
      toast({
        title: 'Validation Error',
        description: error.message || APP_CONFIG.messages.errors.validation,
        variant: 'destructive',
        duration: APP_CONFIG.toast.error,
      });
    } else if (error instanceof AuthError || error.statusCode === 401) {
      toast({
        title: 'Authorization Error',
        description: APP_CONFIG.messages.errors.unauthorized,
        variant: 'destructive',
        duration: APP_CONFIG.toast.error,
      });
      // Optionally redirect to login
      if (window.location.pathname !== '/login') {
        setTimeout(() => window.location.href = '/login', 2000);
      }
    } else {
      toast({
        title: 'Error',
        description: error.message || APP_CONFIG.messages.errors.generic,
        variant: 'destructive',
        duration: APP_CONFIG.toast.error,
      });
    }
  }

  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: boolean;
      context?: string;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = APP_CONFIG.api.retryAttempts,
      delay = APP_CONFIG.api.retryDelay,
      backoff = true,
      context = 'operation',
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation or auth errors
        if (
          error instanceof ValidationError ||
          error instanceof AuthError ||
          (error as any).statusCode === 400 ||
          (error as any).statusCode === 401
        ) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
          console.log(`Retry ${attempt}/${maxAttempts} for ${context} in ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  clearRetryCount(key: string): void {
    this.retryMap.delete(key);
  }
}

export const errorHandler = ErrorHandler.getInstance();