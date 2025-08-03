// Centralized request logging middleware
// Consolidates request logging patterns found across server files

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface LogOptions {
  includeBody?: boolean;
  includeHeaders?: boolean;
  maxBodyLength?: number;
  excludePaths?: string[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Enhanced request logging middleware
 * Consolidates and improves the request logging found in server/index.ts
 */
export function createRequestLogger(options: LogOptions = {}) {
  const {
    includeBody = false,
    includeHeaders = false,
    maxBodyLength = 1000,
    excludePaths = ['/health', '/favicon.ico'],
    logLevel = 'info'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;
    const method = req.method;

    // Skip logging for excluded paths
    if (excludePaths.some(excludePath => path.startsWith(excludePath))) {
      return next();
    }

    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;
    let responseBody: string | undefined = undefined;

    // Capture response data
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    const originalResSend = res.send;
    res.send = function (body) {
      if (typeof body === 'string' && body.length <= maxBodyLength) {
        responseBody = body;
      }
      return originalResSend.apply(res, [body]);
    };

    // Log request details
    const requestData: Record<string, unknown> = {
      method,
      path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (includeHeaders) {
      requestData.headers = req.headers;
    }

    if (includeBody && req.body && Object.keys(req.body).length > 0) {
      requestData.body = JSON.stringify(req.body).substring(0, maxBodyLength);
    }

    // Log completion on response finish
    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      let logLine = `${method} ${path} ${status} in ${duration}ms`;
      
      // Add response data if available
      if (capturedJsonResponse) {
        const responseStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${responseStr.length > 80 ? responseStr.substring(0, 79) + "…" : responseStr}`;
      } else if (responseBody) {
        logLine += ` :: ${responseBody.length > 80 ? responseBody.substring(0, 79) + "…" : responseBody}`;
      }

      // Determine log level based on status code
      let actualLogLevel = logLevel;
      if (status >= 500) {
        actualLogLevel = 'error';
      } else if (status >= 400) {
        actualLogLevel = 'warn';
      }

      // Enhanced log object for structured logging
      const logData = {
        ...requestData,
        status,
        duration,
        responseSize: res.get('Content-Length'),
        ...(status >= 400 && { level: 'error' })
      };

      // Log using appropriate level
      if (path.startsWith("/api")) {
        logger[actualLogLevel](logLine, logData);
      }
    });

    next();
  };
}

/**
 * Simple request logger (backward compatibility)
 */
export const simpleRequestLogger = createRequestLogger({
  includeBody: false,
  includeHeaders: false,
  logLevel: 'info'
});

/**
 * Detailed request logger for debugging
 */
export const detailedRequestLogger = createRequestLogger({
  includeBody: true,
  includeHeaders: true,
  maxBodyLength: 2000,
  logLevel: 'debug'
});

/**
 * Error-focused request logger
 */
export const errorRequestLogger = createRequestLogger({
  includeBody: true,
  includeHeaders: false,
  excludePaths: [],
  logLevel: 'warn'
});