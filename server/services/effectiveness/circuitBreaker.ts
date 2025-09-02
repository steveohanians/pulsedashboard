/**
 * Circuit Breaker for Effectiveness Scoring Services
 * 
 * Prevents cascading failures by temporarily disabling failing services
 * and providing intelligent fallbacks
 */

import logger from '../../utils/logging/logger';

interface CircuitBreakerOptions {
  failureThreshold: number;  // Number of failures before opening circuit
  recoveryTimeout: number;   // Time before attempting to close circuit (ms)
  monitoringWindow: number;  // Time window to track failures (ms)
}

interface ServiceState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  lastAttemptTime: number;
}

export class CircuitBreaker {
  private services: Map<string, ServiceState> = new Map();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      ...options
    };
  }

  /**
   * Execute a service call with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const state = this.getServiceState(serviceName);
    
    // If circuit is open, check if recovery time has passed
    if (state.isOpen) {
      const timeSinceLastAttempt = Date.now() - state.lastAttemptTime;
      
      if (timeSinceLastAttempt < this.options.recoveryTimeout) {
        logger.info(`Circuit breaker OPEN for ${serviceName}, using fallback`, {
          serviceName,
          failures: state.failures,
          timeSinceLastAttempt,
          recoveryTimeout: this.options.recoveryTimeout
        });
        
        if (fallback) {
          return await fallback();
        } else {
          throw new Error(`Service ${serviceName} is temporarily unavailable (circuit breaker open)`);
        }
      } else {
        // Try to close circuit (half-open state)
        logger.info(`Circuit breaker attempting to close for ${serviceName}`, { serviceName });
        state.isOpen = false;
        state.failures = 0;
      }
    }

    // Execute the service call
    state.lastAttemptTime = Date.now();
    
    try {
      const result = await fn();
      
      // Success - reset failure count
      this.recordSuccess(serviceName);
      
      return result;
      
    } catch (error) {
      // Failure - increment failure count
      this.recordFailure(serviceName);
      
      const currentState = this.getServiceState(serviceName);
      
      logger.warn(`Service ${serviceName} failed`, {
        serviceName,
        error: error instanceof Error ? error.message : String(error),
        failures: currentState.failures,
        threshold: this.options.failureThreshold,
        circuitOpen: currentState.isOpen
      });
      
      // If circuit is now open and we have a fallback, use it
      if (currentState.isOpen && fallback) {
        logger.info(`Using fallback for ${serviceName} (circuit breaker opened)`, { serviceName });
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Get current state of a service
   */
  private getServiceState(serviceName: string): ServiceState {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        lastAttemptTime: 0
      });
    }
    
    return this.services.get(serviceName)!;
  }

  /**
   * Record a successful service call
   */
  private recordSuccess(serviceName: string): void {
    const state = this.getServiceState(serviceName);
    state.failures = 0;
    state.isOpen = false;
    
    logger.debug(`Circuit breaker success for ${serviceName}`, { serviceName });
  }

  /**
   * Record a failed service call
   */
  private recordFailure(serviceName: string): void {
    const state = this.getServiceState(serviceName);
    const now = Date.now();
    
    // Reset failure count if monitoring window has passed
    if (now - state.lastFailureTime > this.options.monitoringWindow) {
      state.failures = 0;
    }
    
    state.failures++;
    state.lastFailureTime = now;
    
    // Open circuit if threshold exceeded
    if (state.failures >= this.options.failureThreshold) {
      state.isOpen = true;
      
      logger.warn(`Circuit breaker OPENED for ${serviceName}`, {
        serviceName,
        failures: state.failures,
        threshold: this.options.failureThreshold,
        monitoringWindow: this.options.monitoringWindow,
        recoveryTimeout: this.options.recoveryTimeout
      });
    }
  }

  /**
   * Get status of all services
   */
  public getStatus(): Record<string, { failures: number; isOpen: boolean; lastFailureTime: number }> {
    const status: Record<string, any> = {};
    
    for (const [serviceName, state] of this.services) {
      status[serviceName] = {
        failures: state.failures,
        isOpen: state.isOpen,
        lastFailureTime: state.lastFailureTime
      };
    }
    
    return status;
  }

  /**
   * Manually reset a service's circuit breaker
   */
  public reset(serviceName?: string): void {
    if (serviceName) {
      const state = this.getServiceState(serviceName);
      state.failures = 0;
      state.isOpen = false;
      state.lastFailureTime = 0;
      state.lastAttemptTime = 0;
      
      logger.info(`Circuit breaker reset for ${serviceName}`, { serviceName });
    } else {
      // Reset all services
      this.services.clear();
      logger.info('All circuit breakers reset');
    }
  }

  /**
   * Check if a service circuit is open
   */
  public isOpen(serviceName: string): boolean {
    const state = this.services.get(serviceName);
    return state?.isOpen || false;
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 30000,  // 30 seconds
  monitoringWindow: 60000  // 1 minute
});