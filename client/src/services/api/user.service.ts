import { BaseService } from './base.service';
import { cacheManager } from '../cache/CacheManager';

/**
 * User service
 * Handles admin user management operations
 */
export class UserService extends BaseService {
  constructor() {
    super('/api/admin/users');
  }

  /**
   * Get all users - extract users array from wrapped response
   */
  async getAll<T>(): Promise<T[]> {
    const response = await this.request<{ success: boolean; users: T[] }>('GET', '', undefined, { retry: true });
    return response.users;
  }

  /**
   * Create new item
   */
  async create<T = any>(data: any): Promise<T> {
    const result = await super.create<T>(data);
    cacheManager.invalidate('user');
    return result;
  }

  /**
   * Update existing item
   */
  async update<T = any>(id: string, data: any): Promise<T> {
    const result = await super.update<T>(id, data);
    cacheManager.invalidate('user');
    return result;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<void> {
    await super.delete(id);
    cacheManager.invalidate('user');
  }

  /**
   * Invite a new user
   */
  async invite(data: {
    name: string;
    email: string;
    role?: 'Admin' | 'User';
    clientId?: string;
  }): Promise<{ message: string; user: any }> {
    const result = await this.request<{ message: string; user: any }>('POST', '/invite', data);
    cacheManager.invalidate('user');
    return result;
  }

  /**
   * Send password reset email to user
   */
  async sendPasswordReset(id: string): Promise<{ message: string }> {
    return this.request('POST', `/${id}/send-password-reset`);
  }

  /**
   * Update user status (Active/Inactive)
   */
  async updateStatus(id: string, status: 'Active' | 'Inactive'): Promise<any> {
    const result = await this.update(id, { status });
    cacheManager.invalidate('user');
    return result;
  }
}