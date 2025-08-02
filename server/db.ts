import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

// Handle database connection with better error handling
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced pool configuration with timeout and error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection timeout to prevent hanging
  connectionTimeoutMillis: 5000,
  // Allow some retries
  max: 10,
  // Prevent idle connections from hanging
  idleTimeoutMillis: 30000
});

export const db = drizzle({ client: pool, schema });

// Test database connection function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    await pool.query('SELECT 1');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
