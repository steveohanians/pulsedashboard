// Client-side logging utility for development and production
// Replaces direct console usage with proper logging levels

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class ClientLogger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel[level as keyof typeof LogLevel])) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
      case 'ERROR':
        console.error(formattedMessage, ...args);
        break;
      case 'WARN':
        console.warn(formattedMessage, ...args);
        break;
      case 'INFO':
        console.log(formattedMessage, ...args);
        break;
      case 'DEBUG':
        console.log(formattedMessage, ...args);
        break;
    }
  }

  error(message: string, ...args: any[]): void {
    this.formatMessage('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.formatMessage('WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.formatMessage('INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.formatMessage('DEBUG', message, ...args);
  }

  // Component-specific logging helpers
  component(componentName: string, message: string, ...args: any[]): void {
    this.debug(`[${componentName}] ${message}`, ...args);
  }

  api(endpoint: string, message: string, ...args: any[]): void {
    this.debug(`[API:${endpoint}] ${message}`, ...args);
  }

  performance(operation: string, duration: number): void {
    this.debug(`[PERF] ${operation} completed in ${duration}ms`);
  }
}

// Export singleton instance
export const logger = new ClientLogger();

// Legacy console replacement for gradual migration
export const devLog = {
  debug: (...args: any[]) => logger.debug(args.join(' ')),
  info: (...args: any[]) => logger.info(args.join(' ')),
  warn: (...args: any[]) => logger.warn(args.join(' ')),
  error: (...args: any[]) => logger.error(args.join(' '))
};