import { BaseService } from './base.service';

/**
 * User service
 * Handles admin user management operations
 */
export class UserService extends BaseService {
  constructor() {
    super('/api/admin/users');
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
    return this.request('POST', '/invite', data);
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
    return this.update(id, { status });
  }
}