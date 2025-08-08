/**
 * Production Logger - Centralized logging utility for comprehensive system observability.
 * Provides structured logging with environment-aware behavior, specialized handlers, and consistent formatting.
 * 
 * Core Features:
 * - Environment-aware debug logging (development only)
 * - Structured message formatting with ISO timestamps
 * - Metadata support for contextual information
 * - Specialized handlers for database and security events
 * - JSON serialization for complex data structures
 * - Consistent log level management and formatting
 * 
 * Environment Behavior:
 * - Development: All log levels including debug messages
 * - Production: Error, warning, and info levels only (debug suppressed)
 * - Automatic NODE_ENV detection for environment-specific behavior
 * 
 * Log Levels (in order of severity):
 * - ERROR: System errors, exceptions, and critical failures
 * - WARN: Warning conditions and potential issues  
 * - INFO: General application information and events
 * - DEBUG: Detailed debugging information (development only)
 * 
 * Specialized Handlers:
 * - Database operations logging with context preservation
 * - Security event logging with high severity and enhanced metadata
 * - Structured metadata serialization for complex objects
 * 
 * Usage Patterns:
 * - Standard logging: logger.info('Message', { key: 'value' })
 * - Database events: logger.database('Query executed', { table: 'users' })
 * - Security events: logger.security('Login attempt', { username, ip })
 * 
 * @module Logger
 */

// ============================
// TYPE DEFINITIONS AND CONSTANTS
// ============================

/**
 * Log level enumeration for consistent level management.
 * Defines available log levels with their string representations.
 */
interface LogLevel {
  /** Critical errors and system failures */
  ERROR: 'error';
  /** Warning conditions and potential issues */
  WARN: 'warn';
  /** General application information */
  INFO: 'info';
  /** Detailed debugging information (development only) */
  DEBUG: 'debug';
}

/**
 * Log level configuration with string mappings for consistent formatting.
 * Used throughout the logger for level identification and message formatting.
 */
const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// ============================
// CORE LOGGER CLASS
// ============================

/**
 * Production logger implementation with environment-aware behavior and structured formatting.
 * Provides comprehensive logging capabilities with specialized handlers for different event types.
 * 
 * Key Features:
 * - Automatic environment detection for debug behavior control
 * - Consistent timestamp formatting using ISO 8601 standard
 * - Structured metadata serialization for complex objects
 * - Level-based message formatting with uppercase identifiers
 * - Environment-specific debug message suppression
 */
class Logger {
  /** Environment flag for development-specific behavior (debug logging) */
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  /**
   * Formats log messages with consistent structure and metadata serialization.
   * Creates standardized log entries with ISO timestamps and optional contextual data.
   * 
   * Format Structure:
   * [YYYY-MM-DDTHH:mm:ss.sssZ] LEVEL: message {metadata}
   * 
   * Features:
   * - ISO 8601 timestamp formatting for consistent time representation
   * - Uppercase level identifiers for visual scanning
   * - JSON serialization of metadata objects for structured logging
   * - Null-safe metadata handling
   * 
   * @param level - Log level string for message identification
   * @param message - Primary log message content
   * @param meta - Optional metadata object for contextual information
   * @returns Formatted log string ready for output
   */
  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const baseMsg = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (meta) {
      return `${baseMsg} ${JSON.stringify(meta)}`;
    }
    
    return baseMsg;
  }
  
  // ============================
  // CORE LOGGING METHODS
  // ============================

  /**
   * Logs critical errors, system failures, and exceptions requiring immediate attention.
   * Uses console.error for appropriate log level handling and error stream output.
   * 
   * Use Cases:
   * - Database connection failures
   * - API authentication errors  
   * - Unhandled exceptions and system crashes
   * - Security violations and access denials
   * 
   * @param message - Descriptive error message
   * @param meta - Optional error context (stack traces, error objects, request details)
   */
  error(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.ERROR, message, meta);
    console.error(formattedMsg);
  }
  
  /**
   * Logs warning conditions and potential issues that require monitoring.
   * Uses console.warn for appropriate log level categorization.
   * 
   * Use Cases:
   * - Performance degradation warnings
   * - Input validation failures
   * - Rate limiting activations
   * - Deprecated API usage
   * 
   * @param message - Warning description and context
   * @param meta - Optional warning metadata (metrics, thresholds, affected resources)
   */
  warn(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.WARN, message, meta);
    console.warn(formattedMsg);
  }
  
  /**
   * Logs general application information, events, and operational status.
   * Provides visibility into normal system operations and state changes.
   * 
   * Use Cases:
   * - Application startup and shutdown events
   * - User authentication successes
   * - Background job completions
   * - Configuration changes and updates
   * 
   * @param message - Informational message content
   * @param meta - Optional contextual information (user IDs, operation results, timing)
   */
  info(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.INFO, message, meta);
    console.log(formattedMsg);
  }
  
  /**
   * Logs detailed debugging information for development and troubleshooting.
   * Environment-aware: only outputs in development mode to prevent production log pollution.
   * 
   * Environment Behavior:
   * - Development: Full debug output with detailed context
   * - Production: Silent operation (debug messages suppressed)
   * 
   * Use Cases:
   * - Variable values and state inspection
   * - Control flow tracking and branch analysis
   * - Performance timing and optimization data
   * - Detailed request/response debugging
   * 
   * @param message - Detailed debug information
   * @param meta - Optional debug context (variable states, execution paths, performance data)
   */
  debug(message: string, meta?: any): void {
    if (this.isDevelopment) {
      const formattedMsg = this.formatMessage(LOG_LEVELS.DEBUG, message, meta);
      console.log(formattedMsg);
    }
  }
  
  // ============================
  // SPECIALIZED LOGGING HANDLERS
  // ============================

  /**
   * Logs database operations and query events with specialized formatting.
   * Provides centralized database activity monitoring and debugging capabilities.
   * 
   * Features:
   * - Prefixed with "DATABASE:" for easy filtering and searching
   * - Environment-aware (debug level, development only)
   * - Structured metadata support for query details and performance
   * 
   * Use Cases:
   * - SQL query execution logging
   * - Connection pool status monitoring
   * - Transaction lifecycle tracking
   * - Database performance metrics
   * - Migration execution status
   * 
   * @param message - Database operation description
   * @param meta - Optional database context (query text, execution time, affected rows)
   */
  database(message: string, meta?: any): void {
    this.debug(`DATABASE: ${message}`, meta);
  }
  
  /**
   * Logs security-related events with enhanced metadata and high severity marking.
   * Provides comprehensive security event tracking for monitoring and incident response.
   * 
   * Features:
   * - Logged at ERROR level for visibility and alerting
   * - Prefixed with "SECURITY:" for immediate identification
   * - Automatic timestamp and severity metadata injection
   * - Enhanced context preservation for forensic analysis
   * 
   * Security Event Categories:
   * - Authentication failures and suspicious login attempts
   * - Authorization violations and privilege escalations
   * - Input validation failures and potential attacks
   * - Rate limiting triggers and abuse detection
   * - Data access violations and unauthorized operations
   * 
   * @param event - Security event type and description
   * @param details - Security context (user info, IP addresses, request details, threat indicators)
   */
  security(event: string, details: any): void {
    this.error(`SECURITY: ${event}`, {
      ...details,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    });
  }
}

export const logger = new Logger();
export default logger;