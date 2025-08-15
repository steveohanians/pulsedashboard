import { apiRequest } from '@/lib/queryClient';

/**
 * Base service class providing common CRUD operations
 * All service classes extend this to inherit standard REST operations
 */
export abstract class BaseService {
  protected basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Make a request to the API with error handling and retry logic
   */
  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', 
    path: string = '', 
    data?: unknown,
    options?: { retry?: boolean; context?: string }
  ): Promise<T> {
    const { retry = true, context = this.basePath } = options || {};

    const makeRequest = async () => {
      try {
        const response = await apiRequest(method, `${this.basePath}${path}`, data);
        return response as T;
      } catch (error: any) {
        // Transform to typed errors
        if (error.message?.includes('Network') || error.code === 'ECONNREFUSED') {
          const NetworkError = (await import('@/services/error/ErrorHandler')).NetworkError;
          throw new NetworkError(error.message, error);
        }
        if (error.statusCode === 400 || error.message?.includes('Validation')) {
          const ValidationError = (await import('@/services/error/ErrorHandler')).ValidationError;
          throw new ValidationError(error.message, error);
        }
        throw error;
      }
    };

    if (retry && method === 'GET') {
      // Only retry GET requests
      const errorHandler = (await import('@/services/error/ErrorHandler')).errorHandler;
      return errorHandler.withRetry(makeRequest, { context });
    }

    return makeRequest();
  }

  /**
   * Get all items with retry
   */
  async getAll<T>(): Promise<T[]> {
    return this.request<T[]>('GET', '', undefined, { retry: true });
  }

  /**
   * Get item by ID with retry
   */
  async getById<T>(id: string): Promise<T> {
    return this.request<T>('GET', `/${id}`, undefined, { retry: true });
  }

  /**
   * Create new item (no retry)
   */
  async create<T>(data: unknown): Promise<T> {
    return this.request<T>('POST', '', data, { retry: false });
  }

  /**
   * Update existing item (no retry)
   */
  async update<T>(id: string, data: unknown): Promise<T> {
    return this.request<T>('PUT', `/${id}`, data, { retry: false });
  }

  /**
   * Delete item (no retry)
   */
  async delete(id: string): Promise<void> {
    return this.request<void>('DELETE', `/${id}`, undefined, { retry: false });
  }
}