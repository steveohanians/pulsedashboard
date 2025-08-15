import { apiRequest } from '@/lib/queryClient';

/**
 * Authentication service
 * Handles login, logout, and password reset operations
 */
export class AuthService {
  /**
   * Forgot password request
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiRequest('POST', '/api/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return apiRequest('POST', '/api/reset-password', { token, newPassword });
  }

  /**
   * Get current user session (handled by existing auth system)
   */
  async getCurrentUser(): Promise<any> {
    return apiRequest('GET', '/api/user');
  }

  /**
   * Login (handled by existing auth system)
   */
  async login(email: string, password: string): Promise<any> {
    return apiRequest('POST', '/api/login', { email, password });
  }

  /**
   * Logout (handled by existing auth system)
   */
  async logout(): Promise<void> {
    return apiRequest('POST', '/api/logout');
  }
}