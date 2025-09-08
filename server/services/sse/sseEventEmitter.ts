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
}

// Export singleton instance
export const sseEventEmitter = new SSEEventEmitter();

// Export the class for testing
export { SSEEventEmitter };