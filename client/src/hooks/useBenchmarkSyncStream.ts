/**
 * Benchmark Sync SSE Stream Hook
 * 
 * Provides real-time sync status updates for benchmark companies via SSE.
 * Automatically reconnects on failure and handles connection lifecycle.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BenchmarkCompany } from '@/types/api.types';

export interface BenchmarkSyncProgressData {
  jobId: string;
  jobType: 'individual' | 'bulk' | 'incremental';
  overallPercent: number;
  totalCompanies: number;
  processedCompanies: number;
  failedCompanies: number;
  currentCompanyId?: string;
  currentCompanyName?: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
  currentPhase: 'initializing' | 'syncing' | 'completing' | 'completed';
  message: string;
  timestamp: string;
}

export interface BenchmarkSyncCompletionData {
  jobId: string;
  jobType: 'individual' | 'bulk' | 'incremental';
  totalCompanies: number;
  processedCompanies: number;
  failedCompanies: number;
  totalTime: number;
  message: string;
  timestamp: string;
}

export interface BenchmarkSyncErrorData {
  jobId: string;
  error: string;
  timestamp: string;
}

export interface CompanySyncStatus {
  companyId: string;
  syncStatus: "pending" | "processing" | "verified" | "error";
  message?: string;
  timestamp: string;
}

export type BenchmarkSyncEvent = 
  | { type: 'connected'; data: { message: string; timestamp: string } }
  | { type: 'progress'; data: BenchmarkSyncProgressData }
  | { type: 'completed'; data: BenchmarkSyncCompletionData }
  | { type: 'error'; data: BenchmarkSyncErrorData }
  | { type: 'company-status'; data: CompanySyncStatus }
  | { type: 'heartbeat'; data: { timestamp: string } };

interface UseBenchmarkSyncStreamOptions {
  /** Enable the SSE connection */
  enabled?: boolean;
  
  /** Reconnect automatically on disconnect */
  autoReconnect?: boolean;
  
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  
  /** Base reconnection delay in ms */
  reconnectDelay?: number;
}

interface UseBenchmarkSyncStreamReturn {
  // Current sync progress data
  syncProgress: BenchmarkSyncProgressData | null;
  
  // Total progress computed from sync progress
  totalProgress: {
    total: number;
    completed: number;
    failed: number;
  };
  
  // Company status updates
  companySyncStatuses: Map<string, CompanySyncStatus>;
  
  // Active jobs
  activeSyncJob: string | null;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  
  // Error handling
  error: string | null;
  lastError: BenchmarkSyncErrorData | null;
  
  // Connection info
  connectionAttempts: number;
  lastConnected: Date | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  
  // Completion data
  lastCompletion: BenchmarkSyncCompletionData | null;
  
  // Helper functions
  getCompanyStatus: (companyId: string) => "pending" | "processing" | "verified" | "error" | null;
  isCompanyProcessing: (companyId: string) => boolean;
  isSyncInProgress: boolean;
}

export function useBenchmarkSyncStream(
  options: UseBenchmarkSyncStreamOptions = {}
): UseBenchmarkSyncStreamReturn {
  const {
    enabled = true,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000
  } = options;

  // State management
  const [syncProgress, setSyncProgress] = useState<BenchmarkSyncProgressData | null>(null);
  const [companySyncStatuses, setCompanySyncStatuses] = useState<Map<string, CompanySyncStatus>>(new Map());
  const [activeSyncJob, setActiveSyncJob] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<BenchmarkSyncErrorData | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastCompletion, setLastCompletion] = useState<BenchmarkSyncCompletionData | null>(null);

  // Refs for managing connection lifecycle
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDisconnectingRef = useRef(false);
  const lastConnectAttemptRef = useRef<number>(0);
  const CONNECTION_THROTTLE_MS = 1000;

  // API endpoint for benchmark sync SSE
  const getSSEUrl = useCallback(() => {
    return `${window.location.origin}/api/sse/benchmark-sync`;
  }, []);

  // Helper functions
  const getCompanyStatus = useCallback((companyId: string): "pending" | "processing" | "verified" | "error" | null => {
    const status = companySyncStatuses.get(companyId);
    return status?.syncStatus || null;
  }, [companySyncStatuses]);

  const isCompanyProcessing = useCallback((companyId: string): boolean => {
    const status = getCompanyStatus(companyId);
    return status === "processing";
  }, [getCompanyStatus]);

  const isSyncInProgress = Boolean(activeSyncJob && syncProgress && syncProgress.currentPhase !== 'completed');

  // Helper function to map backend status to frontend syncStatus
  const mapStatusToSyncStatus = (status: string): "pending" | "processing" | "verified" | "error" => {
    switch (status) {
      case 'completed': return 'verified';
      case 'processing': return 'processing';
      case 'failed':
      case 'error': return 'error';
      case 'pending':
      default: return 'pending';
    }
  };

  // Compute total progress from sync progress data
  const totalProgress = {
    total: syncProgress?.totalCompanies || 0,
    completed: syncProgress?.processedCompanies || 0,
    failed: syncProgress?.failedCompanies || 0,
  };

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current || isDisconnectingRef.current || !enabled) {
      return;
    }

    // Throttle connection attempts
    const now = Date.now();
    if (now - lastConnectAttemptRef.current < CONNECTION_THROTTLE_MS) {
      console.warn('[Benchmark SSE] Connection throttled - too frequent attempts');
      return;
    }
    lastConnectAttemptRef.current = now;

    setIsConnecting(true);
    setError(null);
    setConnectionAttempts(prev => prev + 1);

    try {
      const eventSource = new EventSource(getSSEUrl());

      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('[Benchmark SSE] Connection opened');
        setIsConnected(true);
        setIsConnecting(false);
        setIsReconnecting(false);
        setError(null);
        setLastConnected(new Date());
        setConnectionAttempts(0);
      };

      // Handle different event types
      eventSource.addEventListener('connected', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = messageEvent.data ? JSON.parse(messageEvent.data) : {};
          console.log('[Benchmark SSE] Connected:', data);
        } catch (e) {
          console.warn('[Benchmark SSE] Failed to parse connected event:', (event as MessageEvent).data, e);
        }
      });

      eventSource.addEventListener('progress', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (!messageEvent.data) {
            console.warn('[Benchmark SSE] Progress event missing data');
            return;
          }
          const data: BenchmarkSyncProgressData = JSON.parse(messageEvent.data);
          console.log('[Benchmark SSE] Progress update:', data.overallPercent + '%', data.message);
          setSyncProgress(data);
          setActiveSyncJob(data.jobId);
          setError(null);
        } catch (e) {
          console.warn('[Benchmark SSE] Failed to parse progress event:', (event as MessageEvent).data, e);
        }
      });

      eventSource.addEventListener('completed', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (!messageEvent.data) {
            console.warn('[Benchmark SSE] Completion event missing data');
            return;
          }
          const data: BenchmarkSyncCompletionData = JSON.parse(messageEvent.data);
          console.log('[Benchmark SSE] Sync completed:', data);
          setLastCompletion(data);
          setActiveSyncJob(null);
          
          // Update progress to completed state
          setSyncProgress(prev => prev ? {
            ...prev,
            overallPercent: 100,
            currentPhase: 'completed',
            message: data.message
          } : null);
        } catch (e) {
          console.warn('[Benchmark SSE] Failed to parse completion event:', (event as MessageEvent).data, e);
        }
      });

      eventSource.addEventListener('error', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (!messageEvent.data) {
            console.warn('[Benchmark SSE] Error event missing data');
            setError('Unknown SSE error');
            return;
          }
          const data: BenchmarkSyncErrorData = JSON.parse(messageEvent.data);
          console.warn('[Benchmark SSE] Server error event:', data);
          setLastError(data);
          setError(data.error);
          setActiveSyncJob(null);
        } catch (e) {
          console.warn('[Benchmark SSE] Failed to parse error event:', (event as MessageEvent).data, e);
          setError('SSE communication error');
        }
      });

      // Company status updates with payload normalization
      eventSource.addEventListener('company-status', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (!messageEvent.data) {
            console.warn('[Benchmark SSE] Company status event missing data');
            return;
          }
          const rawData = JSON.parse(messageEvent.data);
          console.log('[Benchmark SSE] Company status update:', rawData);
          
          // Normalize payload - handle both { status } and { syncStatus } formats
          const normalizedData: CompanySyncStatus = {
            companyId: rawData.companyId,
            syncStatus: rawData.syncStatus || mapStatusToSyncStatus(rawData.status),
            message: rawData.message,
            timestamp: rawData.timestamp || new Date().toISOString()
          };
          
          setCompanySyncStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(normalizedData.companyId, normalizedData);
            return newMap;
          });
        } catch (e) {
          console.warn('[Benchmark SSE] Failed to parse company status event:', (event as MessageEvent).data, e);
        }
      });

      eventSource.addEventListener('heartbeat', (event) => {
        // Silent heartbeat handling
        if (process.env.NODE_ENV === 'development') {
          try {
            const messageEvent = event as MessageEvent;
            if (messageEvent.data) {
              const data = JSON.parse(messageEvent.data);
              console.debug('[Benchmark SSE] Heartbeat:', data.timestamp);
            }
          } catch (e) {
            console.warn('[Benchmark SSE] Failed to parse heartbeat:', (event as MessageEvent).data, e);
          }
        }
      });

      // Connection error
      eventSource.onerror = (event) => {
        console.error('[Benchmark SSE] Connection error:', event);
        
        setIsConnected(false);
        setIsConnecting(false);
        
        if (isDisconnectingRef.current) {
          return;
        }

        const errorMsg = `Benchmark sync connection lost (attempt ${connectionAttempts + 1})`;
        setError(errorMsg);

        eventSource.close();
        eventSourceRef.current = null;

        // Auto-reconnect if enabled and under limit
        if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
          setIsReconnecting(true);
          
          const delay = reconnectDelay * Math.pow(2, Math.min(connectionAttempts, 4));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[Benchmark SSE] Reconnecting in ${delay}ms...`);
            connect();
          }, delay);
        } else {
          console.error('[Benchmark SSE] Max reconnection attempts reached');
          setIsReconnecting(false);
        }
      };

    } catch (err) {
      console.error('[Benchmark SSE] Failed to create EventSource:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
      setIsReconnecting(false);
    }
  }, [enabled, autoReconnect, maxReconnectAttempts, reconnectDelay, getSSEUrl]);

  // Disconnect from SSE stream with sync protection
  const disconnect = useCallback((force: boolean = false) => {
    // Prevent disconnection during active sync unless forced
    if (!force && isSyncInProgress) {
      console.warn('[Benchmark SSE] Blocked disconnect during active sync - use force=true to override');
      return;
    }
    
    console.log('[Benchmark SSE] Disconnecting', force ? '(forced)' : '');
    
    isDisconnectingRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setIsReconnecting(false);
    setError(null);
    
    setTimeout(() => {
      isDisconnectingRef.current = false;
    }, 1000);
  }, [isSyncInProgress]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && !eventSourceRef.current && !isDisconnectingRef.current) {
      connect();
    }
    
    return () => {
      if (!enabled) {
        disconnect(true); // Force disconnect when disabled
      }
    };
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect(true); // Force disconnect on unmount
    };
  }, [disconnect]);

  return {
    syncProgress,
    totalProgress,
    companySyncStatuses,
    activeSyncJob,
    isConnected,
    isConnecting,
    isReconnecting,
    error,
    lastError,
    connectionAttempts,
    lastConnected,
    connect,
    disconnect,
    lastCompletion,
    getCompanyStatus,
    isCompanyProcessing,
    isSyncInProgress
  };
}