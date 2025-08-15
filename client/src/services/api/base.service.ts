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
   * Make a request to the API
   */
  protected request<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', path: string = '', data?: any): Promise<T> {
    return apiRequest(method, `${this.basePath}${path}`, data);
  }

  /**
   * Get all items
   */
  async getAll<T = any>(): Promise<T[]> {
    return this.request<T[]>('GET');
  }

  /**
   * Get item by ID
   */
  async getById<T = any>(id: string): Promise<T> {
    return this.request<T>('GET', `/${id}`);
  }

  /**
   * Create new item
   */
  async create<T = any>(data: any): Promise<T> {
    return this.request<T>('POST', '', data);
  }

  /**
   * Update existing item
   */
  async update<T = any>(id: string, data: any): Promise<T> {
    return this.request<T>('PUT', `/${id}`, data);
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    return this.request<void>('DELETE', `/${id}`);
  }
}