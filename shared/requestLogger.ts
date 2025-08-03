// Consolidated request logging patterns
// This eliminates duplicate logging logic across server routes

import { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  timestamp: Date;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Enhanced request logger
 * Consolidates logging patterns from server routes
 */
export class RequestLogger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000; // Keep last 1000 logs in memory

  /**
   * Express middleware for request logging
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      const originalSend = res.send;
      const originalJson = res.json;
      
      let responseBody: any;
      
      // Intercept response to capture data
      res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };
      
      res.json = function(obj) {
        responseBody = obj;
        return originalJson.call(this, obj);
      };
      
      // Log when response finishes
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        const logEntry: LogEntry = {
          timestamp: new Date(),
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userId: (req as any).user?.id,
          sessionId: req.sessionID
        };
        
        // Add error info if response indicates error
        if (res.statusCode >= 400 && responseBody) {
          if (typeof responseBody === 'string') {
            try {
              const parsed = JSON.parse(responseBody);
              logEntry.error = parsed.error || parsed.message;
            } catch {
              logEntry.error = responseBody;
            }
          } else if (responseBody.error || responseBody.message) {
            logEntry.error = responseBody.error || responseBody.message;
          }
        }
        
        RequestLogger.addLog(logEntry);
        RequestLogger.logToConsole(logEntry);
      });
      
      next();
    };
  }

  /**
   * Add log entry to memory store
   */
  private static addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Format and log to console
   */
  private static logToConsole(entry: LogEntry): void {
    const statusColor = this.getStatusColor(entry.statusCode || 0);
    const method = entry.method.padEnd(6);
    const status = entry.statusCode?.toString().padEnd(3) || '---';
    const time = `${entry.responseTime}ms`.padEnd(8);
    
    let logMessage = `${statusColor}${method} ${entry.url} ${status} in ${time}${this.resetColor()}`;
    
    // Add user context if available
    if (entry.userId) {
      logMessage += ` :: {"id":"${entry.userId}"${entry.sessionId ? `,"sessionId":"${entry.sessionId}"` : ''}…`;
    }
    
    // Add error info if present
    if (entry.error) {
      logMessage += ` ERROR: ${entry.error}`;
    }
    
    console.log(`${new Date().toTimeString().split(' ')[0]} [express] ${logMessage}`);
  }

  /**
   * Get color code for status
   */
  private static getStatusColor(status: number): string {
    if (status >= 500) return '\x1b[31m'; // Red
    if (status >= 400) return '\x1b[33m'; // Yellow
    if (status >= 300) return '\x1b[36m'; // Cyan
    if (status >= 200) return '\x1b[32m'; // Green
    return '\x1b[37m'; // White
  }

  /**
   * Reset color
   */
  private static resetColor(): string {
    return '\x1b[0m';
  }

  /**
   * Get recent logs
   */
  static getRecentLogs(limit: number = 50): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by criteria
   */
  static getLogsByCriteria(criteria: {
    method?: string;
    statusCode?: number;
    userId?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (criteria.method) {
      filteredLogs = filteredLogs.filter(log => log.method === criteria.method);
    }
    
    if (criteria.statusCode) {
      filteredLogs = filteredLogs.filter(log => log.statusCode === criteria.statusCode);
    }
    
    if (criteria.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === criteria.userId);
    }
    
    if (criteria.since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= criteria.since!);
    }
    
    if (criteria.limit) {
      filteredLogs = filteredLogs.slice(-criteria.limit);
    }
    
    return filteredLogs;
  }

  /**
   * Get error logs
   */
  static getErrorLogs(limit: number = 20): LogEntry[] {
    return this.logs
      .filter(log => log.statusCode && log.statusCode >= 400)
      .slice(-limit);
  }

  /**
   * Get performance statistics
   */
  static getPerformanceStats(): {
    averageResponseTime: number;
    slowestRequests: LogEntry[];
    errorRate: number;
    totalRequests: number;
  } {
    const validLogs = this.logs.filter(log => log.responseTime !== undefined);
    
    if (validLogs.length === 0) {
      return {
        averageResponseTime: 0,
        slowestRequests: [],
        errorRate: 0,
        totalRequests: 0
      };
    }
    
    const totalTime = validLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0);
    const averageResponseTime = totalTime / validLogs.length;
    
    const slowestRequests = validLogs
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
      .slice(0, 10);
    
    const errorCount = this.logs.filter(log => log.statusCode && log.statusCode >= 400).length;
    const errorRate = this.logs.length > 0 ? (errorCount / this.logs.length) * 100 : 0;
    
    return {
      averageResponseTime: Math.round(averageResponseTime),
      slowestRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: this.logs.length
    };
  }

  /**
   * Clear logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
}