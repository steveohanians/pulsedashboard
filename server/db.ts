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

// Optimized pool configuration for long-running effectiveness analysis
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Extended timeout for long effectiveness runs (4-6 minutes)
  connectionTimeoutMillis: 60000, // 60s
  // Larger pool for concurrent client + competitor analysis
  max: 8,
  // Keep connections alive longer during long runs
  idleTimeoutMillis: 120000, // 2 minutes
  // Allow connection reuse for efficiency
  maxUses: Infinity,
  // Don't exit on idle to maintain stability during long operations
  allowExitOnIdle: false,
  // Add query timeout for individual queries
  query_timeout: 30000 // 30s per query
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
