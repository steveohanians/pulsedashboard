import { Express } from "express";
import { db } from "../db";

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'healthy' | 'unhealthy';
    memory: 'healthy' | 'unhealthy';
    environment: 'healthy' | 'unhealthy';
  };
  version: string;
}

export function setupHealthCheck(app: Express) {
  app.get('/health', async (req, res) => {
    const startTime = Date.now();
    
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: 'unhealthy',
        memory: 'unhealthy',
        environment: 'unhealthy'
      },
      version: '1.0.0'
    };
    
    try {
      // Database check
      await db.execute('SELECT 1');
      healthStatus.checks.database = 'healthy';
    } catch (error) {
      healthStatus.status = 'unhealthy';
      healthStatus.checks.database = 'unhealthy';
    }
    
    // Memory check (flag if using > 500MB)
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    healthStatus.checks.memory = memUsageMB < 500 ? 'healthy' : 'unhealthy';
    
    if (healthStatus.checks.memory === 'unhealthy') {
      healthStatus.status = 'unhealthy';
    }
    
    // Environment check
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    healthStatus.checks.environment = missingEnvVars.length === 0 ? 'healthy' : 'unhealthy';
    
    if (healthStatus.checks.environment === 'unhealthy') {
      healthStatus.status = 'unhealthy';
    }
    
    const responseTime = Date.now() - startTime;
    
    // Return appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      ...healthStatus,
      responseTime: `${responseTime}ms`
    });
  });
  
  // Readiness check for load balancers
  app.get('/ready', async (req, res) => {
    try {
      await db.execute('SELECT 1');
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: 'Database connection failed' });
    }
  });
  
  // Liveness check
  app.get('/live', (req, res) => {
    res.status(200).json({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
}