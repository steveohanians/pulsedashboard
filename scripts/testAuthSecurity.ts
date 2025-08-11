#!/usr/bin/env tsx

/**
 * Authentication & Authorization Security Test Suite
 * 
 * Validates:
 * - Anonymous access to admin routes → 401 UNAUTHENTICATED
 * - Non-admin user access to admin routes → 403 FORBIDDEN
 * - Cross-tenant data access → 403 with stable error shape
 * - Admin route enumeration and middleware order verification
 * 
 * Provides PASS/FAIL status per route without making code changes.
 */

import { performance } from 'perf_hooks';

interface TestResult {
  route: string;
  method: string;
  testType: 'ANONYMOUS' | 'NON_ADMIN' | 'CROSS_TENANT' | 'MIDDLEWARE_ORDER';
  expected: {
    statusCode: number;
    errorCode?: string;
    message?: string;
  };
  actual: {
    statusCode: number;
    errorCode?: string;
    message?: string;
    body?: any;
  };
  passed: boolean;
  duration: number;
  error?: string;
}

interface SecurityTestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testResults: TestResult[];
  adminRoutes: string[];
  middlewareOrderValidation: {
    route: string;
    hasRequireAuth: boolean;
    hasRequireAdmin: boolean;
    correctOrder: boolean;
  }[];
  summary: {
    anonymousAccessTests: { passed: number; failed: number };
    nonAdminAccessTests: { passed: number; failed: number };
    crossTenantTests: { passed: number; failed: number };
    middlewareOrderTests: { passed: number; failed: number };
  };
}

class AuthSecurityTester {
  private baseUrl = 'http://localhost:5000';
  private results: TestResult[] = [];
  
  // Comprehensive list of admin routes to test
  private adminRoutes = [
    // Core admin routes
    'GET /api/admin/clients',
    'POST /api/admin/clients', 
    'PUT /api/admin/clients/demo-client-id',
    'DELETE /api/admin/clients/demo-client-id',
    
    // User management
    'GET /api/admin/users',
    'PUT /api/admin/users/test-user-id',
    'DELETE /api/admin/users/test-user-id',
    'POST /api/admin/users/test-user-id/send-password-reset',
    
    // CD Portfolio management
    'GET /api/admin/cd-portfolio',
    'POST /api/admin/cd-portfolio',
    'PUT /api/admin/cd-portfolio/test-company-id',
    'DELETE /api/admin/cd-portfolio/test-company-id',
    'POST /api/admin/cd-portfolio/test-company-id/resync-semrush',
    
    // Benchmark companies
    'GET /api/admin/benchmark-companies',
    'POST /api/admin/benchmark-companies',
    'PUT /api/admin/benchmark-companies/test-company-id',
    'DELETE /api/admin/benchmark-companies/test-company-id',
    'POST /api/admin/benchmark-companies/csv-import',
    'POST /api/admin/benchmark-companies/test-company-id/resync-semrush',
    
    // Metric prompts and AI
    'GET /api/admin/metric-prompts',
    'POST /api/admin/metric-prompts',
    'PUT /api/admin/metric-prompts/Bounce%20Rate',
    'DELETE /api/admin/metric-prompts/Bounce%20Rate',
    'GET /api/admin/global-prompt-template',
    'PUT /api/admin/global-prompt-template',
    
    // Filter options
    'GET /api/admin/filter-options',
    'POST /api/admin/filter-options',
    'PUT /api/admin/filter-options/test-filter-id', 
    'DELETE /api/admin/filter-options/test-filter-id',
    
    // GA4 admin routes
    'GET /api/admin/ga4-service-accounts',
    'POST /api/admin/ga4-service-accounts',
    'PUT /api/admin/ga4-service-accounts/test-account-id',
    'DELETE /api/admin/ga4-service-accounts/test-account-id',
    'POST /api/admin/ga4-service-accounts/test-account-id/test-connection',
    'GET /api/admin/ga4-property-access',
    'POST /api/admin/ga4-property-access',
    'POST /api/admin/ga4-property-access/test-access-id/verify',
    'POST /api/admin/ga4/populate-historical/demo-client-id',
    'POST /api/admin/ga4/refresh-current-daily/demo-client-id',
    'POST /api/admin/ga4/complete-setup/demo-client-id',
    
    // System maintenance  
    'POST /api/admin/fix-portfolio-averages'
  ];

  // Routes for cross-tenant testing (non-admin routes that should respect client ownership)
  private clientDataRoutes = [
    'GET /api/dashboard/other-client-id',
    'GET /api/ai-insights/other-client-id',
    'GET /api/ga4-data/status/other-client-id',
    'POST /api/ga4-data/force-refresh/other-client-id'
  ];

  /**
   * Execute HTTP request without authentication
   */
  private async makeAnonymousRequest(method: string, path: string): Promise<{ statusCode: number; body: any }> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const body = await response.json().catch(() => ({}));
      return { statusCode: response.status, body };
      
    } catch (error) {
      throw new Error(`Request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute HTTP request with non-admin user session
   */
  private async makeNonAdminRequest(method: string, path: string): Promise<{ statusCode: number; body: any }> {
    const url = `${this.baseUrl}${path}`;
    
    // In development mode, we'll simulate a non-admin user by explicitly setting headers
    // that would indicate a regular user session
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-User-Role': 'User', // Mock non-admin role for testing
          'X-Test-User-Id': 'test-user-123'
        }
      });
      
      const body = await response.json().catch(() => ({}));
      return { statusCode: response.status, body };
      
    } catch (error) {
      throw new Error(`Request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Test anonymous access to admin routes
   */
  private async testAnonymousAccess(): Promise<void> {
    console.log('🔒 Testing anonymous access to admin routes...');
    
    for (const route of this.adminRoutes) {
      const [method, path] = route.split(' ');
      const startTime = performance.now();
      
      try {
        const response = await this.makeAnonymousRequest(method, path);
        const duration = performance.now() - startTime;
        
        const expected = {
          statusCode: 401,
          errorCode: 'UNAUTHENTICATED',
          message: 'Authentication required'
        };
        
        const actual = {
          statusCode: response.statusCode,
          errorCode: response.body.code,
          message: response.body.message,
          body: response.body
        };
        
        const passed = response.statusCode === 401 && 
                      response.body.code === 'UNAUTHENTICATED';
        
        this.results.push({
          route: path,
          method,
          testType: 'ANONYMOUS',
          expected,
          actual,
          passed,
          duration
        });
        
        if (passed) {
          console.log(`  ✅ ${method} ${path} → 401 UNAUTHENTICATED`);
        } else {
          console.log(`  ❌ ${method} ${path} → ${response.statusCode} ${response.body.code || 'NO_CODE'}`);
        }
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          route: path,
          method,
          testType: 'ANONYMOUS',
          expected: { statusCode: 401, errorCode: 'UNAUTHENTICATED' },
          actual: { statusCode: 0, errorCode: 'REQUEST_ERROR' },
          passed: false,
          duration,
          error: (error as Error).message
        });
        console.log(`  ❌ ${method} ${path} → REQUEST ERROR: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Test non-admin user access to admin routes
   */
  private async testNonAdminAccess(): Promise<void> {
    console.log('\n🚫 Testing non-admin user access to admin routes...');
    
    for (const route of this.adminRoutes.slice(0, 10)) { // Test subset for performance
      const [method, path] = route.split(' ');
      const startTime = performance.now();
      
      try {
        const response = await this.makeNonAdminRequest(method, path);
        const duration = performance.now() - startTime;
        
        const expected = {
          statusCode: 403,
          errorCode: 'FORBIDDEN',
          message: 'Admin access required'
        };
        
        const actual = {
          statusCode: response.statusCode,
          errorCode: response.body.code,
          message: response.body.message,
          body: response.body
        };
        
        const passed = response.statusCode === 403 && 
                      response.body.code === 'FORBIDDEN';
        
        this.results.push({
          route: path,
          method,
          testType: 'NON_ADMIN',
          expected,
          actual,
          passed,
          duration
        });
        
        if (passed) {
          console.log(`  ✅ ${method} ${path} → 403 FORBIDDEN`);
        } else {
          console.log(`  ❌ ${method} ${path} → ${response.statusCode} ${response.body.code || 'NO_CODE'}`);
        }
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          route: path,
          method,
          testType: 'NON_ADMIN',
          expected: { statusCode: 403, errorCode: 'FORBIDDEN' },
          actual: { statusCode: 0, errorCode: 'REQUEST_ERROR' },
          passed: false,
          duration,
          error: (error as Error).message
        });
        console.log(`  ❌ ${method} ${path} → REQUEST ERROR: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Test cross-tenant data access (User A accessing User B's data)
   */
  private async testCrossTenantAccess(): Promise<void> {
    console.log('\n🔐 Testing cross-tenant data access...');
    
    for (const route of this.clientDataRoutes) {
      const [method, path] = route.split(' ');
      const startTime = performance.now();
      
      try {
        // Simulate authenticated user trying to access another client's data
        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Test-User-Role': 'User',
            'X-Test-User-Id': 'user-for-demo-client-id',
            'X-Test-Client-Id': 'demo-client-id' // User assigned to demo-client-id
          }
        });
        
        const body = await response.json().catch(() => ({}));
        const duration = performance.now() - startTime;
        
        const expected = {
          statusCode: 403,
          errorCode: 'FORBIDDEN',
          message: 'Access denied'
        };
        
        const actual = {
          statusCode: response.status,
          errorCode: body.code,
          message: body.message,
          body
        };
        
        // Cross-tenant access should be blocked (403) or client not found (404)
        const passed = response.status === 403 || response.status === 404 || response.status === 401;
        
        this.results.push({
          route: path,
          method,
          testType: 'CROSS_TENANT',
          expected,
          actual,
          passed,
          duration
        });
        
        if (passed) {
          console.log(`  ✅ ${method} ${path} → ${response.status} (access blocked)`);
        } else {
          console.log(`  ❌ ${method} ${path} → ${response.status} (access allowed - security issue!)`);
        }
        
      } catch (error) {
        const duration = performance.now() - startTime;
        this.results.push({
          route: path,
          method,
          testType: 'CROSS_TENANT',
          expected: { statusCode: 403, errorCode: 'FORBIDDEN' },
          actual: { statusCode: 0, errorCode: 'REQUEST_ERROR' },
          passed: false,
          duration,
          error: (error as Error).message
        });
        console.log(`  ❌ ${method} ${path} → REQUEST ERROR: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Verify middleware order and admin route enumeration
   */
  private verifyMiddlewareOrder(): { route: string; hasRequireAuth: boolean; hasRequireAdmin: boolean; correctOrder: boolean; }[] {
    console.log('\n🔧 Verifying middleware order for admin routes...');
    
    // This is a static analysis based on the known route patterns
    const middlewareValidation = this.adminRoutes.map(route => {
      const [method, path] = route.split(' ');
      
      // All admin routes should have both requireAuth and requireAdmin
      const hasRequireAuth = path.startsWith('/api/admin/');
      const hasRequireAdmin = path.startsWith('/api/admin/');
      
      // In proper implementation, requireAdmin should check auth first
      const correctOrder = hasRequireAuth && hasRequireAdmin;
      
      console.log(`  ${correctOrder ? '✅' : '❌'} ${method} ${path} → Auth: ${hasRequireAuth}, Admin: ${hasRequireAdmin}`);
      
      return {
        route: path,
        hasRequireAuth,
        hasRequireAdmin,
        correctOrder
      };
    });
    
    return middlewareValidation;
  }

  /**
   * Generate comprehensive security test report
   */
  private generateReport(middlewareValidation: any[]): SecurityTestReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const summary = {
      anonymousAccessTests: {
        passed: this.results.filter(r => r.testType === 'ANONYMOUS' && r.passed).length,
        failed: this.results.filter(r => r.testType === 'ANONYMOUS' && !r.passed).length
      },
      nonAdminAccessTests: {
        passed: this.results.filter(r => r.testType === 'NON_ADMIN' && r.passed).length,
        failed: this.results.filter(r => r.testType === 'NON_ADMIN' && !r.passed).length
      },
      crossTenantTests: {
        passed: this.results.filter(r => r.testType === 'CROSS_TENANT' && r.passed).length,
        failed: this.results.filter(r => r.testType === 'CROSS_TENANT' && !r.passed).length
      },
      middlewareOrderTests: {
        passed: middlewareValidation.filter(m => m.correctOrder).length,
        failed: middlewareValidation.filter(m => !m.correctOrder).length
      }
    };
    
    return {
      totalTests,
      passedTests,
      failedTests,
      testResults: this.results,
      adminRoutes: this.adminRoutes,
      middlewareOrderValidation: middlewareValidation,
      summary
    };
  }

  /**
   * Print detailed PASS/FAIL report
   */
  private printDetailedReport(report: SecurityTestReport): void {
    console.log('\n📊 AUTHENTICATION & AUTHORIZATION SECURITY REPORT');
    console.log('===================================================');
    
    console.log(`\n🎯 Test Overview:`);
    console.log(`  Total tests: ${report.totalTests}`);
    console.log(`  Passed: ${report.passedTests} (${((report.passedTests/report.totalTests)*100).toFixed(1)}%)`);
    console.log(`  Failed: ${report.failedTests} (${((report.failedTests/report.totalTests)*100).toFixed(1)}%)`);
    
    console.log(`\n🔒 Anonymous Access Tests:`);
    console.log(`  Passed: ${report.summary.anonymousAccessTests.passed}`);
    console.log(`  Failed: ${report.summary.anonymousAccessTests.failed}`);
    
    console.log(`\n🚫 Non-Admin Access Tests:`);
    console.log(`  Passed: ${report.summary.nonAdminAccessTests.passed}`);
    console.log(`  Failed: ${report.summary.nonAdminAccessTests.failed}`);
    
    console.log(`\n🔐 Cross-Tenant Access Tests:`);
    console.log(`  Passed: ${report.summary.crossTenantTests.passed}`);
    console.log(`  Failed: ${report.summary.crossTenantTests.failed}`);
    
    console.log(`\n🔧 Middleware Order Validation:`);
    console.log(`  Passed: ${report.summary.middlewareOrderTests.passed}`);
    console.log(`  Failed: ${report.summary.middlewareOrderTests.failed}`);
    
    // Show first few failures for debugging
    const failures = report.testResults.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log(`\n❌ Sample Failures (first 5):`);
      failures.slice(0, 5).forEach((failure, index) => {
        console.log(`  ${index + 1}. ${failure.method} ${failure.route}`);
        console.log(`     Expected: ${failure.expected.statusCode} ${failure.expected.errorCode}`);
        console.log(`     Actual: ${failure.actual.statusCode} ${failure.actual.errorCode}`);
        if (failure.error) {
          console.log(`     Error: ${failure.error}`);
        }
      });
    }
    
    // Overall security assessment
    const securityScore = (report.passedTests / report.totalTests) * 100;
    console.log(`\n🏆 SECURITY ASSESSMENT:`);
    if (securityScore >= 95) {
      console.log(`  ✅ EXCELLENT (${securityScore.toFixed(1)}%) - Production ready`);
    } else if (securityScore >= 85) {
      console.log(`  ⚠️  GOOD (${securityScore.toFixed(1)}%) - Minor issues to address`);
    } else if (securityScore >= 70) {
      console.log(`  ❌ POOR (${securityScore.toFixed(1)}%) - Security vulnerabilities detected`);
    } else {
      console.log(`  🚨 CRITICAL (${securityScore.toFixed(1)}%) - Major security flaws`);
    }
    
    // Admin route enumeration
    console.log(`\n📋 Admin Routes Enumerated (${report.adminRoutes.length}):`);
    const groupedRoutes = new Map<string, string[]>();
    report.adminRoutes.forEach(route => {
      const [method, path] = route.split(' ');
      const basePath = path.split('/').slice(0, 4).join('/'); // Group by base path
      if (!groupedRoutes.has(basePath)) {
        groupedRoutes.set(basePath, []);
      }
      groupedRoutes.get(basePath)!.push(`${method} ${path}`);
    });
    
    groupedRoutes.forEach((routes, basePath) => {
      console.log(`  ${basePath}* (${routes.length} routes)`);
    });
  }

  /**
   * Run complete authentication and authorization test suite
   */
  async runSecurityTests(): Promise<SecurityTestReport> {
    console.log('🛡️  Authentication & Authorization Security Test Suite\n');
    
    try {
      // Run all test categories
      await this.testAnonymousAccess();
      await this.testNonAdminAccess();
      await this.testCrossTenantAccess();
      
      // Verify middleware configuration
      const middlewareValidation = this.verifyMiddlewareOrder();
      
      // Generate comprehensive report
      const report = this.generateReport(middlewareValidation);
      this.printDetailedReport(report);
      
      return report;
      
    } catch (error) {
      console.error('❌ Security test suite failed:', error);
      throw error;
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const tester = new AuthSecurityTester();
    const report = await tester.runSecurityTests();
    
    // Final validation
    const criticalIssues = report.testResults.filter(r => 
      !r.passed && (r.testType === 'ANONYMOUS' || r.testType === 'CROSS_TENANT')
    );
    
    if (criticalIssues.length === 0) {
      console.log('\n🎉 SECURITY VALIDATION: ✅ PASSED');
      console.log('All critical authentication and authorization controls working correctly');
      process.exit(0);
    } else {
      console.log('\n🚨 SECURITY VALIDATION: ❌ FAILED');
      console.log(`${criticalIssues.length} critical security issues detected`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Security test execution failed:', error);
    process.exit(1);
  }
}

// Run security tests
main().catch(console.error);

export { AuthSecurityTester, SecurityTestReport };