/**
 * Resilient Database Connection Manager
 * 
 * Provides robust database connectivity with:
 * - Automatic retry logic
 * - Connection health monitoring
 * - Heartbeat queries for long operations
 * - Graceful degradation
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../../shared/schema.js";
import logger from "../utils/logging/logger";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

export interface DatabaseRetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface HeartbeatOptions {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
}

class ResilientDatabaseConnection {
  private pool: Pool | null = null;
  private db: any = null;
  private isHealthy = true;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date | null = null;
  private connectionAttempts = 0;
  
  private readonly retryOptions: DatabaseRetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  private readonly heartbeatOptions: HeartbeatOptions = {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    timeoutMs: 5000    // 5 seconds
  };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    await this.createConnection();
    this.startHeartbeat();
  }

  private async createConnection(): Promise<void> {
    try {
      // Enhanced pool configuration for long-running operations
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Connection timeouts
        connectionTimeoutMillis: 60000,   // 60s to establish connection
        query_timeout: 45000,             // 45s per individual query
        
        // Pool sizing for concurrent operations
        max: 12,                          // Increased for client + competitors
        min: 2,                           // Keep minimum connections ready
        
        // Connection lifecycle
        idleTimeoutMillis: 300000,        // 5 minutes idle timeout
        maxUses: 1000,                    // Reuse connections efficiently  
        allowExitOnIdle: false,           // Don't exit during long operations
        
        // Enhanced error handling
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });

      this.db = drizzle({ client: this.pool, schema });
      this.isHealthy = true;
      this.connectionAttempts = 0;

      logger.info('Resilient database connection established', {
        maxConnections: 12,
        heartbeatEnabled: this.heartbeatOptions.enabled,
        retryPolicy: this.retryOptions
      });

    } catch (error) {
      this.isHealthy = false;
      logger.error('Failed to create database connection', {
        error: error instanceof Error ? error.message : String(error),
        attempt: this.connectionAttempts + 1
      });
      throw error;
    }
  }

  private startHeartbeat(): void {
    if (!this.heartbeatOptions.enabled) return;

    this.heartbeatInterval = setInterval(async () => {
      await this.performHeartbeat();
    }, this.heartbeatOptions.intervalMs);

    logger.info('Database heartbeat monitoring started', {
      intervalMs: this.heartbeatOptions.intervalMs
    });
  }

  private async performHeartbeat(): Promise<void> {
    try {
      if (!this.pool) return;

      const startTime = Date.now();
      await Promise.race([
        this.pool.query('SELECT 1 as heartbeat, NOW() as timestamp'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Heartbeat timeout')), this.heartbeatOptions.timeoutMs)
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.lastHeartbeat = new Date();
      this.isHealthy = true;

      logger.debug('Database heartbeat successful', {
        durationMs: duration,
        timestamp: this.lastHeartbeat.toISOString()
      });

    } catch (error) {
      this.isHealthy = false;
      logger.warn('Database heartbeat failed - connection may be unhealthy', {
        error: error instanceof Error ? error.message : String(error),
        lastSuccessfulHeartbeat: this.lastHeartbeat?.toISOString()
      });

      // Attempt reconnection if heartbeat fails
      await this.attemptReconnection();
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (this.connectionAttempts >= this.retryOptions.maxRetries) {
      logger.error('Max reconnection attempts reached - database unavailable', {
        maxRetries: this.retryOptions.maxRetries
      });
      return;
    }

    this.connectionAttempts++;
    const delay = Math.min(
      this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffMultiplier, this.connectionAttempts - 1),
      this.retryOptions.maxDelay
    );

    logger.info('Attempting database reconnection', {
      attempt: this.connectionAttempts,
      maxRetries: this.retryOptions.maxRetries,
      delayMs: delay
    });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.createConnection();
      logger.info('Database reconnection successful', {
        attempt: this.connectionAttempts
      });
    } catch (error) {
      logger.error('Database reconnection failed', {
        attempt: this.connectionAttempts,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute a query with automatic retry on connection failure
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'database operation'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        if (!this.isHealthy) {
          await this.attemptReconnection();
        }

        if (!this.db) {
          throw new Error('Database connection not available');
        }

        const result = await operation();
        
        // Reset connection attempts on success
        this.connectionAttempts = 0;
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn(`Database operation failed (attempt ${attempt}/${this.retryOptions.maxRetries})`, {
          context,
          error: lastError.message,
          willRetry: attempt < this.retryOptions.maxRetries
        });

        if (attempt < this.retryOptions.maxRetries) {
          // Check if error is retryable
          const isRetryable = this.isRetryableError(lastError);
          if (!isRetryable) {
            logger.error('Non-retryable database error encountered', {
              context,
              error: lastError.message
            });
            throw lastError;
          }

          // Mark connection as unhealthy
          this.isHealthy = false;

          // Wait before retry
          const delay = Math.min(
            this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffMultiplier, attempt - 1),
            this.retryOptions.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Database operation failed after all retry attempts', {
      context,
      error: lastError?.message,
      maxRetries: this.retryOptions.maxRetries
    });

    throw lastError || new Error('Database operation failed');
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'terminating connection due to administrator command',
      'connection timeout',
      'connection closed',
      'socket hang up',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Start heartbeat queries during long-running operations
   */
  public startLongOperationHeartbeat(operationName: string): void {
    logger.info('Starting enhanced heartbeat for long operation', {
      operation: operationName,
      heartbeatIntervalMs: this.heartbeatOptions.intervalMs
    });

    // Immediately perform a heartbeat
    this.performHeartbeat();
  }

  /**
   * Get database instance with health check
   */
  public getDatabase(): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!this.isHealthy) {
      logger.warn('Database connection is unhealthy - operation may fail');
    }

    return this.db;
  }

  /**
   * Get pool instance for legacy compatibility
   */
  public getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Get connection health status
   */
  public getHealthStatus(): {
    isHealthy: boolean;
    lastHeartbeat: Date | null;
    connectionAttempts: number;
  } {
    return {
      isHealthy: this.isHealthy,
      lastHeartbeat: this.lastHeartbeat,
      connectionAttempts: this.connectionAttempts
    };
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.executeWithRetry(
        () => this.pool!.query('SELECT 1 as test, NOW() as timestamp'),
        'connection test'
      );
      return true;
    } catch (error) {
      logger.error('Database connection test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down resilient database connection');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('Database connection pool closed successfully');
      } catch (error) {
        logger.error('Error closing database pool', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}

// Export singleton instance
export const resilientDb = new ResilientDatabaseConnection();

// Export database instance for backward compatibility  
export const db = resilientDb.getDatabase();

// Export test function
export const testDatabaseConnection = () => resilientDb.testConnection();