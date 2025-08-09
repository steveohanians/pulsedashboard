/**
 * Robust utilities for parsing heterogeneous metric data from GA4, SEMrush, and internal calculations.
 * Handles mixed data types (numbers, JSON objects, strings) with null-safe operations.
 */

import logger from './logging/logger';

export interface MetricValueObject {
  value: number;
  source?: string;
  percentage?: number; // For traffic/device metrics
  sessions?: number; // For percentage-based metrics
}

function safeNumberConversion(value: any): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function safeJsonParse(jsonString: string, originalValue: any): any | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Log successful parsing for debugging
    if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
      logger.debug('Metric JSON parsing successful', {
        hasValueProperty: 'value' in parsed,
        parsedType: typeof parsed.value
      });
    }
    
    return parsed;
  } catch (error) {
    // Log parsing failures with context
    logger.debug('Metric JSON parsing failed', {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    return null;
  }
}

/**
 * Safely parses metric values from heterogeneous data sources into numeric format.
 * Handles GA4 (numbers), SEMrush (JSON objects), and CD_Avg (aggregated JSON) formats.
 * 
 * Features:
 * - Multi-format support: numbers, strings, JSON objects
 * - JSON parsing for SEMrush competitor metrics and CD_Avg calculations
 * - Fallback to plain numeric parsing for simple values
 * - Null-safe operations with comprehensive error handling
 * - Structured logging for debugging and monitoring
 * 
 * Supported Input Formats:
 * - Direct numbers: 42.5
 * - Numeric strings: "42.5"
 * - JSON objects: '{"value": 42.5, "source": "semrush"}'
 * - Value objects: {value: 42.5, percentage: 85}
 * 
 * @param value - Raw metric value from any supported data source
 * @returns Parsed numeric value or null if parsing fails
 */
export function parseMetricValue(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle direct numeric values
  if (typeof value === 'number') {
    return value;
  }

  // Handle string inputs (most common case for stored metrics)
  if (typeof value === 'string') {
    // Attempt JSON parsing first (for SEMrush competitor metrics and CD_Avg metrics)
    const parsed = safeJsonParse(value, value);
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      return safeNumberConversion(parsed.value);
    }
    
    // Fallback to plain numeric parsing
    return safeNumberConversion(value);
  }

  // Handle pre-parsed objects with value property
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return safeNumberConversion(value.value);
  }

  return null;
}

// ============================
// PERCENTAGE DATA PARSING FUNCTIONS
// ============================

/**
 * Parses metric values specifically designed for percentage-based analytics data.
 * Optimized for traffic channel distribution and device breakdown metrics.
 * 
 * Features:
 * - Percentage value extraction with optional session counts
 * - JSON object support for detailed traffic/device analytics
 * - Fallback to plain percentage parsing for simple numeric inputs
 * - Session count preservation for detailed analytics
 * - Comprehensive error handling with structured logging
 * 
 * Supported Input Formats:
 * - Plain percentages: 85.2
 * - Percentage strings: "85.2"
 * - JSON objects: '{"percentage": 85.2, "sessions": 1250}'
 * - Percentage objects: {percentage: 85.2, sessions: 1250}
 * 
 * Use Cases:
 * - Traffic channel distribution (Organic: 45%, Paid: 30%, Direct: 25%)
 * - Device breakdown (Desktop: 70%, Mobile: 25%, Tablet: 5%)
 * - Geographic distribution with session counts
 * 
 * @param value - Raw percentage metric from analytics data source
 * @returns Structured percentage object with optional session count, or null if parsing fails
 */
export function parseMetricPercentage(value: any): { percentage: number; sessions?: number } | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle string inputs (JSON or plain numeric)
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, value);
    if (parsed && typeof parsed === 'object' && 'percentage' in parsed) {
      const percentage = safeNumberConversion(parsed.percentage);
      const sessions = parsed.sessions ? safeNumberConversion(parsed.sessions) ?? undefined : undefined;
      
      return percentage !== null ? { percentage, sessions } : null;
    }
    
    // Fallback to plain numeric parsing (assume it's a percentage value)
    const percentage = safeNumberConversion(value);
    return percentage !== null ? { percentage } : null;
  }

  // Handle pre-parsed objects with percentage property
  if (typeof value === 'object' && value !== null && 'percentage' in value) {
    const percentage = safeNumberConversion(value.percentage);
    const sessions = value.sessions ? safeNumberConversion(value.sessions) ?? undefined : undefined;
    
    return percentage !== null ? { percentage, sessions } : null;
  }

  // Handle direct numeric values (assume percentage)
  if (typeof value === 'number') {
    return { percentage: value };
  }

  return null;
}