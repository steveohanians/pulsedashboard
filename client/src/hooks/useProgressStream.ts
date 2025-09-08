/**
 * Server-Sent Events (SSE) Progress Stream Hook
 * 
 * Provides real-time progress updates via SSE instead of polling.
 * Automatically reconnects on failure and handles connection lifecycle.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminQueryKeys } from '@/lib/adminQueryKeys';

export interface ProgressStreamData {
  clientId: string;
  overallPercent: number;
  timeElapsed: number;
  timeRemaining: number;
  currentPhase: 'initializing' | 'client' | 'competitors' | 'insights' | 'completed';
  currentEntity: string;
  currentOperation: string;
  clientComplete: boolean;
  competitorsComplete: number;
  competitorsTotal: number;
  criteriaComplete: number;
  criteriaTotal: number;
  message: string;
  pace: 'faster' | 'normal' | 'slower';
  status?: string;
  timestamp: string;
}

export interface ProgressStreamError {
  clientId: string;
  error: string;
  timestamp: string;
}

export interface ProgressStreamCompletion {
  clientId: string;
  overallScore?: number;
  timestamp: string;
}

export type ProgressStreamEvent = 
  | { type: 'connected'; data: { clientId: string; message: string; timestamp: string } }
  | { type: 'progress'; data: ProgressStreamData }
  | { type: 'completed'; data: ProgressStreamCompletion }
  | { type: 'error'; data: ProgressStreamError }
  | { type: 'heartbeat'; data: { timestamp: string } };

interface UseProgressStreamOptions {
  /** Enable the SSE connection */
  enabled?: boolean;
  
  /** Reconnect automatically on disconnect */
  autoReconnect?: boolean;
  
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  
  /** Base reconnection delay in ms */
  reconnectDelay?: number;
  
  /** Fallback to polling if SSE fails */
  fallbackToPolling?: boolean;
}

interface UseProgressStreamReturn {
  // Current progress data
  progressData: ProgressStreamData | null;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  
  // Error handling
  error: string | null;
  lastError: ProgressStreamError | null;
  
  // Connection info
  connectionAttempts: number;
  lastConnected: Date | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  
  // Completion data
  lastCompletion: ProgressStreamCompletion | null;
}

export function useProgressStream(
  clientId: string,
  options: UseProgressStreamOptions = {}
): UseProgressStreamReturn {
  // Remove excessive logging to prevent render loops
  // console.log('[SSE Hook] useProgressStream called', { clientId, options });
  
  const {
    enabled = true,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    fallbackToPolling = true
  } = options;

  // State management
  const [progressData, setProgressData] = useState<ProgressStreamData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ProgressStreamError | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastCompletion, setLastCompletion] = useState<ProgressStreamCompletion | null>(null);

  // Refs for managing connection lifecycle
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDisconnectingRef = useRef(false);
  const lastConnectAttemptRef = useRef<number>(0);
  const CONNECTION_THROTTLE_MS = 1000; // Prevent connections more frequent than 1 second

  // API endpoint - use same origin to avoid CORS issues
  const getSSEUrl = useCallback(() => {
    // Always use same origin (works for both Replit and localhost)
    return `${window.location.origin}/api/sse/progress/${clientId}`;
  }, [clientId]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current || isDisconnectingRef.current || !enabled) {
      return;
    }

    // Throttle connection attempts to prevent loops
    const now = Date.now();
    if (now - lastConnectAttemptRef.current < CONNECTION_THROTTLE_MS) {
      console.warn('[SSE] Connection throttled - too frequent attempts');
      return;
    }
    lastConnectAttemptRef.current = now;

    setIsConnecting(true);
    setError(null);
    setConnectionAttempts(prev => prev + 1);

    try {
      const eventSource = new EventSource(getSSEUrl(), {
        withCredentials: true
      });

      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('[SSE] Connection opened for client:', clientId);
        setIsConnected(true);
        setIsConnecting(false);
        setIsReconnecting(false);
        setError(null);
        setLastConnected(new Date());
        setConnectionAttempts(0); // Reset on successful connection
      };

      // Handle different event types
      eventSource.addEventListener('connected', (event) => {
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          console.log('[SSE] Connected event:', data);
        } catch (e) {
          console.warn('[SSE] Failed to parse connected event:', event.data, e);
        }
      });

      eventSource.addEventListener('progress', (event) => {
        try {
          if (!event.data) {
            console.warn('[SSE] Progress event missing data');
            return;
          }
          const data: ProgressStreamData = JSON.parse(event.data);
          console.log('[SSE] Progress update:', data.overallPercent + '%');
          setProgressData(data);
          setError(null); // Clear errors on successful data
        } catch (e) {
          console.warn('[SSE] Failed to parse progress event:', event.data, e);
        }
      });

      eventSource.addEventListener('completed', (event) => {
        try {
          if (!event.data) {
            console.warn('[SSE] Completion event missing data');
            return;
          }
          const data: ProgressStreamCompletion = JSON.parse(event.data);
          console.log('[SSE] Analysis completed:', data);
          setLastCompletion(data);
          
          // Update progress to 100% completed state
          setProgressData(prev => prev ? {
            ...prev,
            overallPercent: 100,
            currentPhase: 'completed',
            message: 'Analysis complete'
          } : null);
        } catch (e) {
          console.warn('[SSE] Failed to parse completion event:', event.data, e);
        }
      });

      eventSource.addEventListener('error', (event) => {
        try {
          if (!event.data) {
            console.warn('[SSE] Error event missing data');
            setError('Unknown SSE error');
            return;
          }
          const data: ProgressStreamError = JSON.parse(event.data);
          console.warn('[SSE] Server error event:', data);
          setLastError(data);
          setError(data.error);
        } catch (e) {
          console.warn('[SSE] Failed to parse error event:', event.data, e);
          setError('SSE communication error');
        }
      });

      eventSource.addEventListener('heartbeat', (event) => {
        // Just log heartbeats in dev mode
        if (process.env.NODE_ENV === 'development') {
          try {
            if (event.data) {
              const data = JSON.parse(event.data);
              console.log('[SSE] Heartbeat:', data.timestamp);
            }
          } catch (e) {
            console.warn('[SSE] Failed to parse heartbeat event:', event.data, e);
          }
        }
      });

      // Connection error
      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error for client:', clientId, event);
        
        setIsConnected(false);
        setIsConnecting(false);
        
        // Don't try to reconnect if we're intentionally disconnecting
        if (isDisconnectingRef.current) {
          return;
        }

        // Set error message
        const errorMsg = `Connection lost (attempt ${connectionAttempts + 1})`;
        setError(errorMsg);

        // Close current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Auto-reconnect if enabled and under limit
        if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
          setIsReconnecting(true);
          
          const delay = reconnectDelay * Math.pow(2, Math.min(connectionAttempts, 4)); // Exponential backoff
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[SSE] Reconnecting to ${clientId} in ${delay}ms...`);
            connect();
          }, delay);
        } else {
          console.error(`[SSE] Max reconnection attempts reached for ${clientId}`);
          setIsReconnecting(false);
        }
      };

    } catch (err) {
      console.error('[SSE] Failed to create EventSource:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
      setIsReconnecting(false);
    }
  }, [clientId, enabled, autoReconnect, maxReconnectAttempts, reconnectDelay]); // Remove connectionAttempts and getSSEUrl to prevent loops

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    console.log('[SSE] Manually disconnecting from', clientId);
    
    isDisconnectingRef.current = true;
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Reset state
    setIsConnected(false);
    setIsConnecting(false);
    setIsReconnecting(false);
    setError(null);
    
    // Allow reconnections again after a brief delay
    setTimeout(() => {
      isDisconnectingRef.current = false;
    }, 1000);
  }, [clientId]);

  // Auto-connect when enabled - with stable dependencies to prevent loops
  useEffect(() => {
    if (enabled && !eventSourceRef.current && !isDisconnectingRef.current) {
      connect();
    }
    
    return () => {
      // Cleanup on unmount or when disabled
      if (!enabled) {
        disconnect();
      }
    };
  }, [enabled]); // Remove function dependencies to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    progressData,
    isConnected,
    isConnecting,
    isReconnecting,
    error,
    lastError,
    connectionAttempts,
    lastConnected,
    connect,
    disconnect,
    lastCompletion
  };
}

// Fallback hook that combines SSE with polling fallback
export function useProgressStreamWithFallback(
  clientId: string,
  options: UseProgressStreamOptions = {}
) {
  const sseResult = useProgressStream(clientId, options);
  
  // Import the existing polling hook for fallback
  // Note: You'll need to import your existing useEffectivenessData hook
  // const pollingResult = useEffectivenessData(clientId, { 
  //   enablePolling: !sseResult.isConnected && options.fallbackToPolling 
  // });

  // For now, just return SSE results
  // In a full implementation, you'd merge SSE and polling data intelligently
  return sseResult;
}