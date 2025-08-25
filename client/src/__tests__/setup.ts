/**
 * Test Setup Configuration
 * 
 * Global test setup for Jest and React Testing Library
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Mock window.scrollTo for tests
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true
});

// Mock window.open for tests
Object.defineProperty(window, 'open', {
  value: vi.fn(),
  writable: true
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));