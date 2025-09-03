/**
 * Process termination handlers for graceful shutdown
 * 
 * Ensures proper cleanup of resources like Playwright browsers
 * when the server is terminated or restarted
 */

import { screenshotService } from '../services/effectiveness/screenshot';
import logger from './logging/logger';

let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, forcing exit');
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Clean up browser resources
    await screenshotService.cleanup();
    logger.info('Browser resources cleaned up successfully');
    
    // Additional cleanup can be added here (database connections, etc.)
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

/**
 * Setup process termination handlers
 */
export function setupProcessHandlers(): void {
  // Handle normal termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason, promise });
    gracefulShutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
  });
  
  logger.info('Process termination handlers setup complete');
}