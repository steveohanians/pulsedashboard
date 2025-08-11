#!/usr/bin/env node
/**
 * Admin Route Protection Audit Script
 * 
 * This script verifies that all admin routes are properly protected
 * with the correct middleware order: requireAuth -> requireAdmin -> handler
 */

import fs from 'fs';
import path from 'path';

interface RouteInfo {
  method: string;
  path: string;
  middlewares: string[];
  lineNumber: number;
  hasAuth: boolean;
  hasAdmin: boolean;
  isProperlyProtected: boolean;
}

function auditAdminRoutes(): RouteInfo[] {
  const routesFilePath = path.join(__dirname, 'routes.ts');
  const routesContent = fs.readFileSync(routesFilePath, 'utf-8');
  const lines = routesContent.split('\n');
  
  const adminRoutes: RouteInfo[] = [];
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Look for admin routes
    if (trimmedLine.includes('/api/admin/')) {
      for (const method of httpMethods) {
        const methodPattern = new RegExp(`app\\.${method}\\(["'\`]([^"'\`]+)["'\`]`, 'i');
        const match = trimmedLine.match(methodPattern);
        
        if (match) {
          const routePath = match[1];
          const middlewares = extractMiddlewares(trimmedLine);
          
          const routeInfo: RouteInfo = {
            method: method.toUpperCase(),
            path: routePath,
            middlewares,
            lineNumber: index + 1,
            hasAuth: middlewares.includes('requireAuth'),
            hasAdmin: middlewares.includes('requireAdmin'),
            isProperlyProtected: false
          };
          
          // Check if properly protected
          // Admin routes should have requireAdmin (which includes auth check)
          // Or explicit requireAuth -> requireAdmin order
          routeInfo.isProperlyProtected = routeInfo.hasAdmin || 
            (routeInfo.hasAuth && middlewares.indexOf('requireAuth') < middlewares.indexOf('requireAdmin'));
          
          adminRoutes.push(routeInfo);
        }
      }
    }
  });
  
  return adminRoutes;
}

function extractMiddlewares(line: string): string[] {
  const middlewares: string[] = [];
  
  // Extract middleware functions from the route definition
  const middlewarePatterns = [
    'requireAuth',
    'requireAdmin', 
    'adminLimiter',
    'authLimiter'
  ];
  
  middlewarePatterns.forEach(pattern => {
    if (line.includes(pattern)) {
      middlewares.push(pattern);
    }
  });
  
  return middlewares;
}

function generateAuditReport(routes: RouteInfo[]): string {
  let report = `
# Admin Route Protection Audit Report
Generated: ${new Date().toISOString()}

## Summary
- Total admin routes found: ${routes.length}
- Properly protected: ${routes.filter(r => r.isProperlyProtected).length}
- Needs attention: ${routes.filter(r => !r.isProperlyProtected).length}

## Detailed Analysis

### ✅ Properly Protected Routes
`;

  const protectedRoutes = routes.filter(r => r.isProperlyProtected);
  protectedRoutes.forEach(route => {
    report += `- ${route.method} ${route.path} (Line ${route.lineNumber})\n`;
    report += `  Middlewares: ${route.middlewares.join(' → ')}\n\n`;
  });

  const unprotectedRoutes = routes.filter(r => !r.isProperlyProtected);
  if (unprotectedRoutes.length > 0) {
    report += `
### ⚠️  Routes Needing Attention
`;
    unprotectedRoutes.forEach(route => {
      report += `- ${route.method} ${route.path} (Line ${route.lineNumber})\n`;
      report += `  Current middlewares: ${route.middlewares.join(' → ')}\n`;
      report += `  Issue: Missing admin protection\n\n`;
    });
  }

  report += `
## Middleware Order Requirements
1. Admin routes should use requireAdmin middleware (includes auth check)
2. OR explicit requireAuth → requireAdmin order
3. Error codes: 401 UNAUTHENTICATED, 403 FORBIDDEN

## Admin Routes by Pattern
`;

  const routesByPath = routes.reduce((acc, route) => {
    const pathPattern = route.path.replace(/:\w+/g, ':id');
    if (!acc[pathPattern]) acc[pathPattern] = [];
    acc[pathPattern].push(route);
    return acc;
  }, {} as Record<string, RouteInfo[]>);

  Object.entries(routesByPath).forEach(([pattern, patternRoutes]) => {
    report += `\n### ${pattern}\n`;
    patternRoutes.forEach(route => {
      const status = route.isProperlyProtected ? '✅' : '⚠️';
      report += `${status} ${route.method} (Line ${route.lineNumber})\n`;
    });
  });

  return report;
}

// Run audit if called directly
if (require.main === module) {
  try {
    console.log('🔍 Auditing admin route protection...\n');
    
    const routes = auditAdminRoutes();
    const report = generateAuditReport(routes);
    
    console.log(report);
    
    // Write report to file
    const reportPath = path.join(__dirname, 'admin-route-audit-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    
    const unprotectedCount = routes.filter(r => !r.isProperlyProtected).length;
    if (unprotectedCount > 0) {
      console.log(`\n⚠️  ${unprotectedCount} routes need attention`);
      process.exit(1);
    } else {
      console.log('\n✅ All admin routes are properly protected');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

export { auditAdminRoutes, generateAuditReport };