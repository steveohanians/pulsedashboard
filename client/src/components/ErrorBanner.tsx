/**
 * Error Banner Component
 * 
 * Displays non-blocking error banners for different error types with
 * appropriate retry mechanisms and user guidance.
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings, Clock, ExternalLink, X } from 'lucide-react';
import { ERROR_CODES, ErrorCode } from '@shared/errorTypes';
import { APIError } from '@/lib/queryClient';

interface ErrorBannerProps {
  error: APIError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Error banner configuration for different error types
 */
const ERROR_BANNER_CONFIG: Record<ErrorCode, {
  variant: 'default' | 'destructive';
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: React.ElementType;
  showRetry: boolean;
  retryDisabled?: boolean;
}> = {
  [ERROR_CODES.SCHEMA_MISMATCH]: {
    variant: 'default',
    icon: AlertTriangle,
    title: 'Data Contract Changed',
    description: 'Data structure has been updated. Please retry or contact admin if issues persist.',
    actionLabel: 'Retry',
    actionIcon: RefreshCw,
    showRetry: true
  },
  [ERROR_CODES.GA4_AUTH]: {
    variant: 'destructive',
    icon: Settings,
    title: 'GA4 Authentication Required',
    description: 'GA4 access needs to be reconnected. Please check authentication settings.',
    actionLabel: 'Open Settings',
    actionIcon: ExternalLink,
    showRetry: false
  },
  [ERROR_CODES.GA4_QUOTA]: {
    variant: 'default',
    icon: Clock,
    title: 'GA4 Quota Exceeded',
    description: 'GA4 quota limit reached. Please try again later.',
    actionLabel: 'Retry Later',
    actionIcon: Clock,
    showRetry: true,
    retryDisabled: true
  },
  [ERROR_CODES.UNAUTHENTICATED]: {
    variant: 'destructive',
    icon: AlertTriangle,
    title: 'Authentication Required',
    description: 'Please log in to access this data.',
    showRetry: false
  },
  [ERROR_CODES.FORBIDDEN]: {
    variant: 'destructive',
    icon: AlertTriangle,
    title: 'Access Denied',
    description: 'You do not have permission to access this resource.',
    showRetry: false
  },
  [ERROR_CODES.RATE_LIMITED]: {
    variant: 'default',
    icon: Clock,
    title: 'Rate Limited',
    description: 'Too many requests. Please wait before trying again.',
    actionLabel: 'Retry Later',
    actionIcon: Clock,
    showRetry: true,
    retryDisabled: true
  },
  [ERROR_CODES.CLIENT_NOT_FOUND]: {
    variant: 'destructive',
    icon: AlertTriangle,
    title: 'Client Not Found',
    description: 'The requested client data could not be found.',
    showRetry: false
  },
  [ERROR_CODES.NO_DATA]: {
    variant: 'default',
    icon: AlertTriangle,
    title: 'No Data Available',
    description: 'No data is available for the selected period.',
    showRetry: false
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    variant: 'destructive',
    icon: AlertTriangle,
    title: 'Server Error',
    description: 'An internal server error occurred. Please try again.',
    actionLabel: 'Retry',
    actionIcon: RefreshCw,
    showRetry: true
  },
  [ERROR_CODES.VALIDATION_ERROR]: {
    variant: 'default',
    icon: AlertTriangle,
    title: 'Validation Error',
    description: 'The provided data is invalid. Please check your input.',
    showRetry: false
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    variant: 'destructive',
    icon: AlertTriangle,
    title: 'Network Error',
    description: 'Network connection failed. Please check your connection and try again.',
    actionLabel: 'Retry',
    actionIcon: RefreshCw,
    showRetry: true
  }
};

/**
 * Error banner component that displays appropriate UI based on error type
 */
export function ErrorBanner({ error, onRetry, onDismiss, className }: ErrorBannerProps) {
  if (!error) return null;

  const config = ERROR_BANNER_CONFIG[error.code] || ERROR_BANNER_CONFIG[ERROR_CODES.INTERNAL_ERROR];
  const Icon = config.icon;
  const ActionIcon = config.actionIcon;

  // Calculate retry delay message
  const getRetryMessage = () => {
    if (error.retryAfter) {
      const minutes = Math.ceil(error.retryAfter / 60);
      return ` (Retry in ${minutes} minute${minutes > 1 ? 's' : ''})`;
    }
    return '';
  };

  // Handle action button click
  const handleActionClick = () => {
    if (error.code === ERROR_CODES.GA4_AUTH) {
      // Open settings or GA4 configuration page
      window.open('/admin/settings', '_blank');
    } else if (config.showRetry && onRetry && !config.retryDisabled) {
      onRetry();
    }
  };

  return (
    <Alert variant={config.variant} className={`mb-4 ${className || ''}`}>
      <Icon className="h-4 w-4" />
      <div className="flex items-center justify-between w-full">
        <div className="flex-1">
          <AlertDescription className="font-medium">
            {config.title}
          </AlertDescription>
          <AlertDescription className="text-sm mt-1">
            {error.hint || config.description}
            {error.code === ERROR_CODES.GA4_QUOTA && getRetryMessage()}
          </AlertDescription>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {config.showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleActionClick}
              disabled={config.retryDisabled}
              className="whitespace-nowrap"
            >
              {ActionIcon && <ActionIcon className="h-3 w-3 mr-1" />}
              {config.actionLabel || 'Retry'}
            </Button>
          )}
          
          {error.code === ERROR_CODES.GA4_AUTH && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleActionClick}
              className="whitespace-nowrap"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open Settings
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="p-1 h-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

/**
 * Hook for managing error banner state
 */
export function useErrorBanner() {
  const [error, setError] = React.useState<APIError | null>(null);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const showError = React.useCallback((error: APIError) => {
    const errorKey = `${error.code}-${error.message}`;
    if (!dismissed.has(errorKey)) {
      setError(error);
    }
  }, [dismissed]);

  const dismissError = React.useCallback(() => {
    if (error) {
      const errorKey = `${error.code}-${error.message}`;
      setDismissed(prev => new Set(prev).add(errorKey));
      setError(null);
    }
  }, [error]);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    showError,
    dismissError,
    clearError
  };
}