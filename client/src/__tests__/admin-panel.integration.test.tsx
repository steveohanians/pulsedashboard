import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockServices, testData } from '@/test/test-utils';
import AdminPanel from '@/pages/admin-panel';

// Mock the services
vi.mock('@/services/api', () => ({
  ...mockServices,
  cacheManager: {
    invalidate: vi.fn(),
  },
}));

// Mock auth hook
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { role: 'Admin', id: 'admin-1' } }),
}));

describe('Admin Panel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockServices.clientService.getAll.mockResolvedValue([
      testData.createClient(),
      testData.createClient({ id: 'client-2', name: 'Client 2' }),
    ]);
    
    mockServices.userService.getAll.mockResolvedValue([
      testData.createUser(),
      testData.createUser({ id: 'user-2', name: 'User 2' }),
    ]);
  });

  it('should load and display clients', async () => {
    render(<AdminPanel />);

    // Click on clients tab
    const clientsTab = screen.getByText('Client Management');
    await userEvent.click(clientsTab);

    // Wait for clients to load
    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    expect(mockServices.clientService.getAll).toHaveBeenCalled();
  });

  it('should delete a client', async () => {
    mockServices.clientService.delete.mockResolvedValue(undefined);
    
    render(<AdminPanel />);

    // Go to clients tab
    const clientsTab = screen.getByText('Client Management');
    await userEvent.click(clientsTab);

    // Wait for clients to load
    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    // Click delete button (assuming it's visible)
    const deleteButtons = screen.getAllByLabelText(/delete/i);
    await userEvent.click(deleteButtons[0]);

    // Confirm deletion in dialog
    const confirmButton = await screen.findByText('Delete Client');
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockServices.clientService.delete).toHaveBeenCalledWith('client-1');
    });
  });

  it('should trigger GA4 sync', async () => {
    mockServices.clientService.triggerGA4Sync.mockResolvedValue(undefined);
    
    render(<AdminPanel />);

    // Test would continue with finding and clicking sync button
    // This is a simplified example
  });
});