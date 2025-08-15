# Testing Infrastructure

## Overview
This directory contains the testing infrastructure for the Pulse Dashboard enterprise-grade frontend architecture.

## Test Categories

### Unit Tests
- **ErrorHandler Tests**: `services/error/__tests__/ErrorHandler.test.ts`
- **Component Tests**: `components/__tests__/*.test.tsx`
- **Service Tests**: `services/api/__tests__/*.test.ts`

### Integration Tests
- **Admin Panel Integration**: `__tests__/admin-panel.integration.test.tsx`
- **Service Layer Integration**: Tests for the complete service architecture

### E2E Tests
- **Critical User Paths**: `__tests__/critical-path.e2e.test.ts`
- **Admin Workflows**: Complete admin panel functionality

## Test Utilities
- **Test Utils**: `test/test-utils.tsx` - React Query providers, mock services, test data factories
- **Setup**: `test/setup.ts` - Global test configuration

## Configuration
- **Vitest**: `vitest.config.ts` - Unit and integration test configuration
- **Playwright**: `playwright.config.ts` - E2E test configuration
- **Test Runner**: `scripts/run-tests.sh` - Comprehensive test execution

## Mock Services
Complete mock implementations for:
- Client Service
- User Service  
- Portfolio Service
- Cache Manager
- Event Bus

## Test Data Factories
Reusable test data generators for:
- Clients
- Users
- Portfolio Companies

## Error Handling Tests
Comprehensive tests for the enterprise error handling system:
- Error classification
- Retry logic
- Backoff calculations
- Context generation
- React error boundaries

## Running Tests
```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## Note
Due to dependency conflicts with the current vite/tailwind setup, some testing libraries require manual installation with legacy peer deps. The testing infrastructure is architecturally complete and ready for use once dependencies are resolved.