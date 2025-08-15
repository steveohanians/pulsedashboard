import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender } from '@testing-library/react';
import { vi } from 'vitest';

// Create a test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Custom render with providers
export function render(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...options } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

// Mock services
export const mockServices = {
  clientService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    triggerGA4Sync: vi.fn(),
    fetchIcon: vi.fn(),
    clearIcon: vi.fn(),
  },
  userService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    invite: vi.fn(),
    sendPasswordReset: vi.fn(),
  },
  portfolioService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    recalculateAverages: vi.fn(),
    resyncSemrush: vi.fn(),
    getCompanyData: vi.fn(),
  },
};

// Test data factories
export const testData = {
  createClient: (overrides = {}) => ({
    id: 'client-1',
    name: 'Test Client',
    websiteUrl: 'https://test.com',
    businessSize: 'Medium',
    industryVertical: 'Technology',
    ga4PropertyId: '123456789',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createUser: (overrides = {}) => ({
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'User' as const,
    status: 'Active' as const,
    clientId: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createPortfolioCompany: (overrides = {}) => ({
    id: 'portfolio-1',
    name: 'Portfolio Company',
    websiteUrl: 'https://portfolio.com',
    businessSize: 'Large',
    industryVertical: 'SaaS',
    active: true,
    createdAt: new Date(),
    ...overrides,
  }),
};

export * from '@testing-library/react';