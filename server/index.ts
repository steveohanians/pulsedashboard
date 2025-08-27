// PERFORMANCE TIMER - Start immediately at server boot
const SERVER_BOOT_TIME = Date.now();
console.log(`🚀 [SERVER-BOOT] Server starting at: ${new Date(SERVER_BOOT_TIME).toISOString()}`);

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurityHeaders } from "./middleware/security";
import { setupHealthCheck } from "./middleware/healthCheck";
import { generalLimiter } from "./middleware/rateLimiter";
import { setupPreloading } from "./middleware/preload";
// Compression handled by Vite in production
import logger from "./utils/logging/logger";

// Make boot time available globally
(global as any).SERVER_BOOT_TIME = SERVER_BOOT_TIME;

const app = express();

// Security headers (must be early in middleware stack)
setupSecurityHeaders(app);

// Compression will be handled by deployment CDN

// Resource preloading for performance
setupPreloading(app);

// Health checks (before rate limiting)
setupHealthCheck(app);

// Rate limiting (after health checks)
app.use('/api', generalLimiter);

// Increase body size limit for PDF export HTML payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Serve screenshot files statically
app.use('/screenshots', express.static('uploads/screenshots'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Test database connection first
    const { testDatabaseConnection } = await import('./db');
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      logger.warn('Database connection failed - continuing with limited functionality');
    }

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      logger.error('Request error', { 
        status, 
        message, 
        path: _req.path,
        method: _req.method 
      });
      
      res.status(status).json({ message });
    });

    // Set NODE_ENV to development if not set
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development';
      app.set('env', 'development');
    }

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const { APP_CONFIG, validateConfig } = await import('./config');
    
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.valid) {
      logger.error("Configuration validation failed", { errors: configValidation.errors });
      process.exit(1);
    }
    
    const port = APP_CONFIG.PORT;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received: starting graceful shutdown`);
      
      // Close the server to stop accepting new connections
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle different termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { promise, reason });
      process.exit(1);
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start server', { error: errorMessage });
    logger.error('Server startup error:', error);
    process.exit(1);
  }
})();
