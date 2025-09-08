/**
 * Enhanced Database Connection with Resilience Features
 * 
 * This module provides the main database connection with:
 * - Automatic retry logic for connection failures
 * - Heartbeat monitoring during long operations  
 * - Graceful degradation and reconnection
 * - Enhanced error handling for Neon serverless
 */

import { resilientDb, db, testDatabaseConnection } from './db/resilientConnection';
import logger from "./utils/logging/logger";

// Re-export for backward compatibility
export { db, testDatabaseConnection };

// Export pool for legacy compatibility (e.g., session storage)
export const pool = resilientDb.getPool();

// Export resilient connection instance for advanced usage
export { resilientDb };

/**
 * Execute database operation with automatic retry on connection failure
 * Use this for critical operations that need resilience
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  context: string = 'database operation'
): Promise<T> {
  return resilientDb.executeWithRetry(operation, context);
}

/**
 * Start enhanced heartbeat monitoring for long-running operations
 * Call this before starting effectiveness analysis or other long operations
 */
export function startLongOperationHeartbeat(operationName: string): void {
  resilientDb.startLongOperationHeartbeat(operationName);
}

/**
 * Get database connection health status
 */
export function getDatabaseHealthStatus() {
  return resilientDb.getHealthStatus();
}
