/**
 * Production-ready logging configuration for Pulse Dashboard™
 * Implements environment-based log levels and structured logging
 */

export interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

export interface LogConfig {
  level: keyof LogLevel;
  structured: boolean;
  timestamp: boolean;
  colors: boolean;
}

/**
 * Get production logging configuration based on environment
 */
export function getProductionLogConfig(): LogConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        level: 'INFO',
        structured: true,
        timestamp: true,
        colors: false
      };
    case 'staging':
      return {
        level: 'DEBUG',
        structured: true,
        timestamp: true,
        colors: false
      };
    case 'development':
    default:
      return {
        level: 'DEBUG',
        structured: false,
        timestamp: true,
        colors: true
      };
  }
}

/**
 * Production-ready logger with environment-based configuration
 */
export class ProductionLogger {
  private config: LogConfig;
  private currentLevel: number;

  constructor() {
    this.config = getProductionLogConfig();
    this.currentLevel = LOG_LEVELS[this.config.level];
  }

  private shouldLog(level: keyof LogLevel): boolean {
    return LOG_LEVELS[level] <= this.currentLevel;
  }

  private formatMessage(level: keyof LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = this.config.timestamp ? new Date().toISOString() : '';
    
    if (this.config.structured) {
      // Structured logging for production
      const logEntry = {
        timestamp,
        level,
        message,
        ...(args.length > 0 && { data: args })
      };
      return JSON.stringify(logEntry);
    } else {
      // Human-readable logging for development
      const prefix = timestamp ? `[${timestamp}] [${level}]` : `[${level}]`;
      const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')}` : '';
      return `${prefix}: ${message}${formattedArgs}`;
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.info(this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }
}

// Export singleton instance
export const productionLogger = new ProductionLogger();