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

// Simplified pool configuration for better reliability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Shorter timeout to fail fast
  connectionTimeoutMillis: 5000,
  // Single connection for simplicity
  max: 1,
  // Don't keep idle connections
  idleTimeoutMillis: 1000,
  // Allow connection reuse
  maxUses: Infinity,
  // Exit when idle
  allowExitOnIdle: true
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
