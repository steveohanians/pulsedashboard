// Database connection pooling optimization
import { logger } from '../utils/logger';

interface PoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}

class DatabaseConnectionPool {
  private pool: any | null = null;
  private readonly config: PoolConfig;

  constructor() {
    this.config = {
      max: 20, // Maximum number of connections
      min: 2,  // Minimum number of connections to maintain
      idleTimeoutMillis: 30000, // 30 seconds before closing idle connections
      connectionTimeoutMillis: 2000, // 2 seconds to get connection from pool
      allowExitOnIdle: true
    };
  }

  // Initialize the connection pool
  initialize(databaseUrl: string): any {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      ...this.config,
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Pool event handlers for monitoring
    this.pool.on('connect', (client) => {
      logger.database('New database connection established');
    });

    this.pool.on('acquire', (client) => {
      logger.database('Connection acquired from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error:', err);
    });

    this.pool.on('remove', (client) => {
      logger.database('Connection removed from pool');
    });

    logger.info(`Database connection pool initialized with max: ${this.config.max}, min: ${this.config.min}`);
    return this.pool;
  }

  // Get the pool instance
  getPool(): any {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  // Get pool statistics
  getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      config: this.config
    };
  }

  // Graceful shutdown
  async close(): Promise<void> {
    if (this.pool) {
      logger.info('Closing database connection pool...');
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const dbConnectionPool = new DatabaseConnectionPool();