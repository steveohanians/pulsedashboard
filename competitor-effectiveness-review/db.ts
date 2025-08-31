import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import logger from "./utils/logging/logger";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

// Handle database connection with better error handling
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized pool configuration for Neon serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Longer timeout for more reliable connections
  connectionTimeoutMillis: 30000,
  // Moderate pool size for Neon serverless
  max: 3,
  // Keep connections alive briefly to reduce overhead
  idleTimeoutMillis: 30000,
  // Allow connection reuse
  maxUses: Infinity,
  // Don't exit on idle to maintain stability
  allowExitOnIdle: false
});

export const db = drizzle({ client: pool, schema });

// Test database connection function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    await pool.query('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
}
