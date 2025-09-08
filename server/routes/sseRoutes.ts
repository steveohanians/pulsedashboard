/**
 * Server-Sent Events (SSE) Routes
 * 
 * Provides real-time progress streaming for effectiveness analysis runs.
 * Eliminates need for frontend polling by pushing updates as they happen.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import logger from '../utils/logging/logger';
import { getProgressTracker } from '../services/effectiveness/progressTracker';
import { sseEventEmitter, type SSEProgressData, type SSECompletionData, type SSEErrorData } from '../services/sse/sseEventEmitter';

const router = Router();

// Track active SSE connections by client ID
const activeConnections = new Map<string, Set<Response>>();

// Connection limits and monitoring - Relaxed for development
const CONNECTION_LIMITS = {
  maxConnectionsPerClient: 20,    // Max concurrent connections per client (increased)
  maxTotalConnections: 500,       // Max total connections across all clients (increased)
  connectionTimeoutMs: 600000,    // 10 minutes max connection time (increased)
};

/**
 * SSE endpoint for real-time progress updates
 * GET /progress/:clientId
 */
router.get('/progress/:clientId', requireAuth, async (req: Request, res: Response) => {
  const { clientId } = req.params;
  
  try {
    // Verify client access
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check user permissions
    if (req.user?.role !== 'Admin' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    logger.info('SSE connection established', { 
      clientId, 
      userId: req.user?.id,
      userAgent: req.get('User-Agent')
    });

    // Check connection limits with detailed logging
    const totalConnections = getActiveConnectionCount();
    const clientConnections = getActiveConnectionCount(clientId);

    logger.debug('SSE Connection attempt', { 
      clientId, 
      totalConnections, 
      clientConnections,
      limits: CONNECTION_LIMITS 
    });

    if (totalConnections >= CONNECTION_LIMITS.maxTotalConnections) {
      logger.warn('Total connection limit exceeded', { 
        clientId, 
        totalConnections,
        limit: CONNECTION_LIMITS.maxTotalConnections 
      });
      return res.status(429).json({ 
        error: 'Too many concurrent connections. Please try again later.',
        details: { totalConnections, limit: CONNECTION_LIMITS.maxTotalConnections }
      });
    }

    if (clientConnections >= CONNECTION_LIMITS.maxConnectionsPerClient) {
      logger.warn('Client connection limit exceeded', { 
        clientId, 
        clientConnections,
        limit: CONNECTION_LIMITS.maxConnectionsPerClient 
      });
      return res.status(429).json({ 
        error: 'Too many concurrent connections for this client. Please close other tabs and try again.',
        details: { clientConnections, limit: CONNECTION_LIMITS.maxConnectionsPerClient }
      });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Send initial connection confirmation
    sendSSEEvent(res, 'connected', { 
      clientId, 
      timestamp: new Date().toISOString(),
      message: 'Progress stream connected'
    });

    // Track this connection
    if (!activeConnections.has(clientId)) {
      activeConnections.set(clientId, new Set());
    }
    activeConnections.get(clientId)!.add(res);

    // Send current progress state immediately
    await sendCurrentProgress(res, clientId);

    // Set up progress event listeners for this client
    const progressHandler = (data: SSEProgressData) => {
      if (data.clientId === clientId) {
        sendSSEEvent(res, 'progress', data);
      }
    };

    const completionHandler = (data: SSECompletionData) => {
      if (data.clientId === clientId) {
        sendSSEEvent(res, 'completed', data);
      }
    };

    const errorHandler = (data: SSEErrorData) => {
      if (data.clientId === clientId) {
        sendSSEEvent(res, 'error', data);
      }
    };

    // Register event listeners
    sseEventEmitter.on('progress', progressHandler);
    sseEventEmitter.on('completed', completionHandler);
    sseEventEmitter.on('error', errorHandler);

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      sendSSEEvent(res, 'heartbeat', { 
        timestamp: new Date().toISOString() 
      });
    }, 30000); // Every 30 seconds

    // Connection timeout - close after max time
    const connectionTimeout = setTimeout(() => {
      logger.info('SSE connection timeout, closing', { 
        clientId, 
        userId: req.user?.id,
        timeoutMs: CONNECTION_LIMITS.connectionTimeoutMs
      });
      
      sendSSEEvent(res, 'timeout', {
        message: 'Connection timeout - please refresh to reconnect',
        timestamp: new Date().toISOString()
      });
      
      res.end();
    }, CONNECTION_LIMITS.connectionTimeoutMs);

    // Handle client disconnect
    req.on('close', () => {
      logger.info('SSE connection closed', { clientId, userId: req.user?.id });
      
      // Remove event listeners
      sseEventEmitter.removeListener('progress', progressHandler);
      sseEventEmitter.removeListener('completed', completionHandler);
      sseEventEmitter.removeListener('error', errorHandler);
      
      // Clear heartbeat and timeout
      clearInterval(heartbeat);
      clearTimeout(connectionTimeout);
      
      // Remove from active connections
      const connections = activeConnections.get(clientId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          activeConnections.delete(clientId);
        }
      }
    });

    // Handle server-side errors
    req.on('error', (error) => {
      logger.error('SSE connection error', { 
        clientId, 
        userId: req.user?.id,
        error: error.message 
      });
    });

  } catch (error) {
    logger.error('SSE setup failed', {
      clientId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

/**
 * Send an SSE event to a specific response stream
 */
function sendSSEEvent(res: Response, event: string, data: any): void {
  if (res.writableEnded) {
    return;
  }

  try {
    const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(eventData);
  } catch (error) {
    logger.error('Failed to send SSE event', {
      event,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Send current progress state to a newly connected client
 */
async function sendCurrentProgress(res: Response, clientId: string): Promise<void> {
  try {
    // Get current progress from tracker if available
    const tracker = getProgressTracker();
    if (tracker) {
      const state = tracker.getState();
      sendSSEEvent(res, 'progress', {
        clientId,
        ...state,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Fallback: get latest run from database
    const latestRun = await storage.getLatestEffectivenessRun(clientId);
    if (latestRun) {
      const progress = parseInt(latestRun.progress?.replace('%', '') || '0');
      
      sendSSEEvent(res, 'progress', {
        clientId,
        overallPercent: progress,
        status: latestRun.status,
        message: latestRun.progressDetail || 'Loading current state...',
        timestamp: new Date().toISOString()
      });
    } else {
      sendSSEEvent(res, 'progress', {
        clientId,
        overallPercent: 0,
        status: 'idle',
        message: 'No active analysis',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Failed to send current progress', {
      clientId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Note: Broadcast functions moved to sseEventEmitter module to avoid circular imports

/**
 * Get active connection count for monitoring
 */
export function getActiveConnectionCount(clientId?: string): number {
  if (clientId) {
    return activeConnections.get(clientId)?.size || 0;
  }
  
  let total = 0;
  for (const connections of activeConnections.values()) {
    total += connections.size;
  }
  return total;
}

/**
 * Health check endpoint with detailed monitoring
 */
router.get('/health', (req, res) => {
  const totalConnections = getActiveConnectionCount();
  const clientCounts = Array.from(activeConnections.entries()).map(([clientId, connections]) => ({
    clientId,
    connections: connections.size
  }));

  // Calculate utilization
  const clientUtilization = (activeConnections.size / CONNECTION_LIMITS.maxTotalConnections) * 100;
  const connectionUtilization = (totalConnections / CONNECTION_LIMITS.maxTotalConnections) * 100;

  // Check if we're approaching limits
  const status = connectionUtilization > 90 ? 'warning' : 
                 connectionUtilization > 75 ? 'caution' : 'healthy';

  res.json({
    status,
    connections: {
      total: totalConnections,
      maxTotal: CONNECTION_LIMITS.maxTotalConnections,
      utilization: Math.round(connectionUtilization * 100) / 100
    },
    clients: {
      active: activeConnections.size,
      maxPerClient: CONNECTION_LIMITS.maxConnectionsPerClient,
      details: clientCounts
    },
    limits: CONNECTION_LIMITS,
    eventEmitter: {
      totalListeners: sseEventEmitter.getTotalListenerCount(),
      progressListeners: sseEventEmitter.getListenerCount('progress'),
      completedListeners: sseEventEmitter.getListenerCount('completed'),
      errorListeners: sseEventEmitter.getListenerCount('error')
    },
    timestamp: new Date().toISOString()
  });
});

export default router;