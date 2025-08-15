import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryError } from '../QueryError';

describe('QueryError', () => {
  it('should display error message', () => {
    render(<QueryError message="Test error message" />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should display retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    
    render(<QueryError message="Test error" onRetry={onRetry} />);
    
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should not display retry button when onRetry is not provided', () => {
    render(<QueryError message="Test error" />);
    
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    
    render(<QueryError message="Test error" onRetry={onRetry} />);
    
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should display error icon', () => {
    render(<QueryError message="Test error" />);
    
    // Check for the AlertCircle icon (lucide-react)
    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
  });

  it('should apply correct styling classes', () => {
    const { container } = render(<QueryError message="Test error" />);
    
    const errorContainer = container.firstChild;
    expect(errorContainer).toHaveClass('flex', 'items-center', 'justify-center', 'py-8');
  });
});