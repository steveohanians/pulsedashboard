import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireAuth, requireAdmin } from '../auth';

describe('Authentication Middleware Unit Tests', () => {
  
  describe('requireAuth middleware', () => {
    it('should return 401 UNAUTHENTICATED for unauthenticated requests', () => {
      const mockReq = {
        isAuthenticated: () => false,
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      let statusCode: number;
      let responseBody: any;
      
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (body: any) => {
          responseBody = body;
          return mockRes;
        }
      };
      
      const mockNext = () => {
        throw new Error('Next should not be called for unauthenticated requests');
      };
      
      requireAuth(mockReq, mockRes, mockNext);
      
      assert.strictEqual(statusCode!, 401);
      assert.strictEqual(responseBody.code, 'UNAUTHENTICATED');
      assert.strictEqual(responseBody.message, 'Authentication required');
    });
    
    it('should call next() for authenticated requests', () => {
      const mockReq = {
        isAuthenticated: () => true,
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      const mockRes = {
        status: () => { throw new Error('Status should not be called'); },
        json: () => { throw new Error('JSON should not be called'); }
      };
      
      let nextCalled = false;
      const mockNext = () => {
        nextCalled = true;
      };
      
      requireAuth(mockReq, mockRes, mockNext);
      
      assert.strictEqual(nextCalled, true);
    });
  });

  describe('requireAdmin middleware', () => {
    it('should return 401 UNAUTHENTICATED for unauthenticated requests', () => {
      const mockReq = {
        isAuthenticated: () => false,
        originalUrl: '/api/admin/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      let statusCode: number;
      let responseBody: any;
      
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (body: any) => {
          responseBody = body;
          return mockRes;
        }
      };
      
      const mockNext = () => {
        throw new Error('Next should not be called');
      };
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      assert.strictEqual(statusCode!, 401);
      assert.strictEqual(responseBody.code, 'UNAUTHENTICATED');
      assert.strictEqual(responseBody.message, 'Authentication required');
    });
    
    it('should return 403 FORBIDDEN for authenticated non-admin users', () => {
      const mockReq = {
        isAuthenticated: () => true,
        user: { id: 'user-id', role: 'User' },
        originalUrl: '/api/admin/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      let statusCode: number;
      let responseBody: any;
      
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (body: any) => {
          responseBody = body;
          return mockRes;
        }
      };
      
      const mockNext = () => {
        throw new Error('Next should not be called');
      };
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      assert.strictEqual(statusCode!, 403);
      assert.strictEqual(responseBody.code, 'FORBIDDEN');
      assert.strictEqual(responseBody.message, 'Admin access required');
    });
    
    it('should call next() for authenticated admin users', () => {
      const mockReq = {
        isAuthenticated: () => true,
        user: { id: 'admin-id', role: 'Admin' },
        originalUrl: '/api/admin/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      const mockRes = {
        status: () => { throw new Error('Status should not be called'); },
        json: () => { throw new Error('JSON should not be called'); }
      };
      
      let nextCalled = false;
      const mockNext = () => {
        nextCalled = true;
      };
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      assert.strictEqual(nextCalled, true);
    });
  });

  describe('Error Response Standardization', () => {
    it('should return standardized error codes and structure', () => {
      const mockReq = {
        isAuthenticated: () => false,
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      
      let responseBody: any;
      const mockRes = {
        status: () => mockRes,
        json: (body: any) => {
          responseBody = body;
          return mockRes;
        }
      };
      
      requireAuth(mockReq, mockRes, () => {});
      
      // Verify standardized error structure
      assert.ok(responseBody.code);
      assert.ok(responseBody.message);
      assert.strictEqual(typeof responseBody.code, 'string');
      assert.strictEqual(typeof responseBody.message, 'string');
    });
  });
});

describe('Middleware Order Verification Tests', () => {
  it('should prioritize authentication check over authorization check', () => {
    // Test that unauthenticated requests to admin routes get 401, not 403
    const mockReq = {
      isAuthenticated: () => false,
      originalUrl: '/api/admin/test',
      method: 'GET',
      ip: '127.0.0.1'
    };
    
    let statusCode: number;
    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: () => mockRes
    };
    
    requireAdmin(mockReq, mockRes, () => {});
    
    // Should be 401 (UNAUTHENTICATED), not 403 (FORBIDDEN)
    // This proves requireAdmin checks authentication first
    assert.strictEqual(statusCode!, 401);
  });
});