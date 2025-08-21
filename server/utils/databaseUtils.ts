// Centralized database utility functions
// Consolidates common database patterns found across storage operations

import { db } from '../db';
import { eq, and, or, sql, SQL, inArray } from 'drizzle-orm';
import logger from './logging/logger';

/**
 * Generic CRUD operations builder
 * Consolidates repeated database operation patterns
 */
export class DatabaseRepository<T extends Record<string, unknown>, InsertT> {
  constructor(private table: any, private entityName: string) {}

  async findById(id: string): Promise<T | undefined> {
    try {
      const [entity] = await db.select().from(this.table).where(eq(this.table.id, id));
      return (entity as T) || undefined;
    } catch (error) {
      logger.error(`Failed to find ${this.entityName} by ID`, { id, error: (error as Error).message });
      throw error;
    }
  }

  async findAll(filters?: Record<string, unknown>): Promise<T[]> {
    try {
      let query = db.select().from(this.table);
      
      if (filters) {
        const conditions = Object.entries(filters).map(([key, value]) => 
          eq(this.table[key], value)
        );
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
      }
      
      const results = await query;
      return results as T[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to find all ${this.entityName}`, { filters, error: errorMessage });
      throw error;
    }
  }

  async create(data: InsertT): Promise<T> {
    try {
      const result = await db
        .insert(this.table)
        .values(data as any)
        .returning();
      const [entity] = result as any[];
      logger.info(`Created ${this.entityName}`, { id: (entity as any).id });
      return entity as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create ${this.entityName}`, { data, error: errorMessage });
      throw error;
    }
  }

  async update(id: string, data: Partial<InsertT>): Promise<T | undefined> {
    try {
      const [entity] = await db
        .update(this.table)
        .set(data as any)
        .where(eq(this.table.id, id))
        .returning();
      
      if (entity) {
        logger.info(`Updated ${this.entityName}`, { id });
      } else {
        logger.warn(`${this.entityName} not found for update`, { id });
      }
      
      return (entity as T) || undefined;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to update ${this.entityName}`, { id, data, error: errorMessage });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(this.table)
        .where(eq(this.table.id, id))
        .returning();
      
      const deleted = (result as any).length > 0;
      if (deleted) {
        logger.info(`Deleted ${this.entityName}`, { id });
      } else {
        logger.warn(`${this.entityName} not found for deletion`, { id });
      }
      
      return deleted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to delete ${this.entityName}`, { id, error: errorMessage });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const [entity] = await db
        .select({ id: this.table.id })
        .from(this.table)
        .where(eq(this.table.id, id))
        .limit(1);
      return !!entity;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to check ${this.entityName} existence`, { id, error: errorMessage });
      throw error;
    }
  }

  async count(filters?: Record<string, any>): Promise<number> {
    try {
      let query = db.select({ count: sql<number>`count(*)` }).from(this.table);
      
      if (filters) {
        const conditions = Object.entries(filters).map(([key, value]) => 
          eq(this.table[key], value)
        );
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
      }
      
      const [result] = await query;
      return Number(result.count);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to count ${this.entityName}`, { filters, error: errorMessage });
      throw error;
    }
  }
}

/**
 * Transaction wrapper utility
 * Consolidates transaction handling patterns
 */
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>,
  context: string = 'Database operation'
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      logger.debug(`Starting transaction: ${context}`);
      const result = await operation(tx as any);
      logger.debug(`Transaction completed: ${context}`);
      return result;
    });
  } catch (error: any) {
    logger.error(`Transaction failed: ${context}`, { 
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Batch operation utility
 * Handles batch inserts/updates efficiently
 */
export async function batchInsert<T>(
  table: any,
  data: T[],
  batchSize: number = 100,
  entityName: string = 'records'
): Promise<void> {
  if (data.length === 0) return;

  try {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(table).values(batch);
      logger.debug(`Inserted batch of ${batch.length} ${entityName}`, { 
        batch: Math.floor(i / batchSize) + 1,
        total: Math.ceil(data.length / batchSize)
      });
    }
    logger.info(`Completed batch insert of ${data.length} ${entityName}`);
  } catch (error: any) {
    logger.error(`Batch insert failed for ${entityName}`, { 
      totalRecords: data.length,
      error: error.message
    });
    throw error;
  }
}

/**
 * Query builder utility for complex filters
 * Standardizes complex query construction
 */
export class QueryBuilder {
  private conditions: SQL[] = [];

  addCondition(condition: SQL): this {
    this.conditions.push(condition);
    return this;
  }

  addEqualsCondition(column: any, value: any): this {
    if (value !== undefined && value !== null) {
      this.conditions.push(eq(column, value));
    }
    return this;
  }

  addInCondition(column: any, values: any[]): this {
    if (values && values.length > 0) {
      this.conditions.push(inArray(column, values));
    }
    return this;
  }

  build(): SQL | undefined {
    if (this.conditions.length === 0) return undefined;
    if (this.conditions.length === 1) return this.conditions[0];
    return and(...this.conditions);
  }

  buildOr(): SQL | undefined {
    if (this.conditions.length === 0) return undefined;
    if (this.conditions.length === 1) return this.conditions[0];
    return or(...this.conditions);
  }
}