/**
 * SSE Event Emitter
 * 
 * Centralized event emitter for Server-Sent Events.
 * Provides a clean interface for broadcasting progress updates
 * without circular dependencies.
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logging/logger';

export interface SSEProgressData {
  clientId: string;
  overallPercent: number;
  timeElapsed?: number;
  timeRemaining?: number;
  currentPhase?: 'initializing' | 'client' | 'competitors' | 'insights' | 'completed';
  currentEntity?: string;
  currentOperation?: string;
  clientComplete?: boolean;
  competitorsComplete?: number;
  competitorsTotal?: number;
  criteriaComplete?: number;
  criteriaTotal?: number;
  message: string;
  pace?: 'faster' | 'normal' | 'slower';
  timestamp: string;
}

export interface SSECompletionData {
  clientId: string;
  overallPercent: number;
  overallScore?: number;
  message: string;
  totalTime: number;
  timestamp: string;
}

export interface SSEErrorData {
  clientId: string;
  error: string;
  timestamp: string;
}

// Benchmark Sync SSE Event Types
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

/**
 * Global SSE event emitter for cross-service communication
 */
class SSEEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent connections
  }

  /**
   * Broadcast progress update to all clients listening for a specific clientId
   */
  broadcastProgress(clientId: string, progressData: Omit<SSEProgressData, 'clientId' | 'timestamp'>): void {
    const eventData: SSEProgressData = {
      clientId,
      ...progressData,
      timestamp: new Date().toISOString()
    };

    logger.debug('Broadcasting progress update', { 
      clientId, 
      progress: progressData.overallPercent 
    });

    this.emit('progress', eventData);
  }

  /**
   * Broadcast completion event
   */
  broadcastCompletion(clientId: string, completionData: Omit<SSECompletionData, 'clientId' | 'timestamp'>): void {
    const eventData: SSECompletionData = {
      clientId,
      ...completionData,
      timestamp: new Date().toISOString()
    };

    logger.info('Broadcasting completion', { clientId });
    this.emit('completed', eventData);
  }

  /**
   * Broadcast error event
   */
  broadcastError(clientId: string, error: string): void {
    const eventData: SSEErrorData = {
      clientId,
      error,
      timestamp: new Date().toISOString()
    };

    logger.warn('Broadcasting error', { clientId, error });
    this.emit('error', eventData);
  }

  /**
   * Broadcast benchmark sync progress update
   */
  broadcastBenchmarkProgress(progressData: BenchmarkSyncProgressData): void {
    logger.debug('Broadcasting benchmark sync progress', { 
      jobId: progressData.jobId, 
      progress: progressData.overallPercent,
      currentPhase: progressData.currentPhase
    });

    this.emit('benchmark-progress', progressData);
  }

  /**
   * Broadcast benchmark sync completion
   */
  broadcastBenchmarkCompletion(completionData: BenchmarkSyncCompletionData): void {
    logger.info('Broadcasting benchmark sync completion', { 
      jobId: completionData.jobId,
      totalCompanies: completionData.totalCompanies,
      processedCompanies: completionData.processedCompanies
    });

    this.emit('benchmark-completed', completionData);
  }

  /**
   * Broadcast benchmark sync error
   */
  broadcastBenchmarkError(errorData: BenchmarkSyncErrorData): void {
    logger.warn('Broadcasting benchmark sync error', { 
      jobId: errorData.jobId, 
      error: errorData.error 
    });

    this.emit('benchmark-error', errorData);
  }

  /**
   * Get listener count for a specific event type
   */
  getListenerCount(event: string): number {
    return this.listenerCount(event);
  }

  /**
   * Get total listener count across all events
   */
  getTotalListenerCount(): number {
    const events = this.eventNames();
    return events.reduce((total, event) => total + this.listenerCount(event), 0);
  }

  /**
   * Emit benchmark sync progress - convenience method for individual company progress
   */
  emitBenchmarkSyncProgress(data: {
    companyId: string;
    companyName: string;
    stage: string;
    message: string;
    progress: number;
    jobId?: string;
  }): void {
    const progressData: BenchmarkSyncProgressData = {
      jobId: data.jobId || 'individual',
      jobType: 'individual',
      overallPercent: data.progress,
      totalCompanies: 1,
      processedCompanies: Math.floor(data.progress / 100),
      failedCompanies: 0,
      currentCompanyId: data.companyId,
      currentCompanyName: data.companyName,
      timeElapsed: 0,
      currentPhase: data.stage === 'completed' ? 'completed' : 'syncing',
      message: data.message,
      timestamp: new Date().toISOString()
    };

    this.broadcastBenchmarkProgress(progressData);
  }

  /**
   * Emit benchmark sync completion - convenience method for individual company completion
   */
  emitBenchmarkSyncCompleted(data: {
    companyId: string;
    companyName: string;
    message: string;
    jobId?: string;
  }): void {
    const completionData: BenchmarkSyncCompletionData = {
      jobId: data.jobId || 'individual',
      jobType: 'individual',
      totalCompanies: 1,
      processedCompanies: 1,
      failedCompanies: 0,
      totalTime: 0,
      message: data.message,
      timestamp: new Date().toISOString()
    };

    this.broadcastBenchmarkCompletion(completionData);
  }

  /**
   * Emit benchmark sync error - convenience method for individual company errors
   */
  emitBenchmarkSyncError(data: {
    companyId: string;
    companyName: string;
    error: string;
    jobId?: string;
  }): void {
    const errorData: BenchmarkSyncErrorData = {
      jobId: data.jobId || 'individual',
      error: `${data.companyName} (${data.companyId}): ${data.error}`,
      timestamp: new Date().toISOString()
    };

    this.broadcastBenchmarkError(errorData);
  }
}

// Export singleton instance
export const sseEventEmitter = new SSEEventEmitter();

// Export the class for testing
export { SSEEventEmitter };