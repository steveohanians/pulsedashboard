// Simple logging utility for production
interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const baseMsg = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (meta) {
      return `${baseMsg} ${JSON.stringify(meta)}`;
    }
    
    return baseMsg;
  }
  
  error(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.ERROR, message, meta);
    console.error(formattedMsg);
  }
  
  warn(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.WARN, message, meta);
    console.warn(formattedMsg);
  }
  
  info(message: string, meta?: any): void {
    const formattedMsg = this.formatMessage(LOG_LEVELS.INFO, message, meta);
    console.log(formattedMsg);
  }
  
  debug(message: string, meta?: any): void {
    if (this.isDevelopment) {
      const formattedMsg = this.formatMessage(LOG_LEVELS.DEBUG, message, meta);
      console.log(formattedMsg);
    }
  }
  
  // Log security events
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