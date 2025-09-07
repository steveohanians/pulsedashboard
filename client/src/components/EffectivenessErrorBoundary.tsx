import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';
import { errorHandler, AppError } from '@/services/error/ErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  clientName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EffectivenessErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const enhancedError = new AppError(
      `Effectiveness analysis error: ${error.message}`,
      'EFFECTIVENESS_ERROR',
      500
    );
    
    errorHandler.handleError(enhancedError, 'effectiveness boundary');
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isTimeoutError = this.state.error?.message?.includes('timeout') || 
                            this.state.error?.message?.includes('Request timeout');
      const isNetworkError = this.state.error?.message?.includes('Network') ||
                           this.state.error?.message?.includes('fetch');

      return (
        <Card 
          className="max-w-md w-full mx-auto mt-8"
          role="alert"
          aria-live="assertive"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
              Effectiveness Analysis Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {isTimeoutError ? (
                <>
                  <p className="mb-2">The effectiveness analysis is taking longer than expected.</p>
                  <p>This can happen with complex websites. You can:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                    <li>Wait a moment and try again</li>
                    <li>Check if the analysis completed in the background</li>
                    <li>Contact support if this persists</li>
                  </ul>
                </>
              ) : isNetworkError ? (
                <>
                  <p className="mb-2">Unable to connect to the analysis service.</p>
                  <p>Please check your connection and try again.</p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    An error occurred while analyzing{' '}
                    {this.props.clientName ? `${this.props.clientName}'s` : 'the'} website effectiveness.
                  </p>
                  <p>The issue has been logged and our team will investigate.</p>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={this.handleRetry} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleRetry();
                  }
                }}
                variant="outline" 
                size="sm"
                aria-label="Retry the effectiveness analysis"
                tabIndex={0}
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Try Again
              </Button>
              <Button 
                onClick={this.handleRefresh}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleRefresh();
                  }
                }}
                size="sm"
                aria-label="Refresh the entire page"
                tabIndex={0}
              >
                Refresh Page
              </Button>
            </div>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Error details (dev only)</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words bg-muted p-2 rounded text-xs">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}