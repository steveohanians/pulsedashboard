/**
 * Metric Parser - Robust utilities for parsing heterogeneous metric data from multiple sources.
 * Handles conversion between different metric value formats (numbers, JSON objects, strings) 
 * commonly encountered in analytics data from GA4, SEMrush, and internal calculations.
 * 
 * Core Features:
 * - Safe parsing of mixed data types (numbers, strings, JSON objects)
 * - Percentage data extraction with optional session counts
 * - Comprehensive error handling with structured logging
 * - Null-safe operations with fallback strategies
 * - Support for SEMrush competitor metrics and CD_Avg aggregated data
 * 
 * Data Sources Support:
 * - GA4 Analytics: Plain numeric values and percentage objects
 * - SEMrush: JSON-encoded metric objects with value/percentage properties
 * - CD_Avg: Calculated average metrics in JSON format
 * - Competitor Data: Various formats depending on data provider
 * 
 * @module MetricParser
 */

import logger from './logger';

// ============================
// TYPE DEFINITIONS
// ============================

/**
 * Structured metric value object for JSON-encoded metrics.
 * Commonly used by SEMrush API responses and internal aggregated calculations.
 */
export interface MetricValueObject {
  /** Primary numeric value of the metric */
  value: number;
  /** Optional data source identifier */
  source?: string;
  /** Optional percentage representation (for traffic/device metrics) */
  percentage?: number;
  /** Optional session count (for percentage-based metrics) */
  sessions?: number;
}

// ============================
// INTERNAL HELPER FUNCTIONS
// ============================

/**
 * Safely converts a numeric value to a valid number, handling edge cases.
 * 
 * @param value - Value to convert to number
 * @returns Valid number or null if conversion fails
 */
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

/**
 * Attempts to parse a string as JSON with structured error handling.
 * 
 * @param jsonString - String to parse as JSON
 * @param originalValue - Original value for logging context
 * @returns Parsed object or null if parsing fails
 */
function safeJsonParse(jsonString: string, originalValue: any): any | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Log successful parsing for debugging
    if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
      logger.debug('Metric JSON parsing successful', {
        originalValue: typeof originalValue === 'string' ? originalValue.substring(0, 50) + '...' : originalValue,
        hasValueProperty: 'value' in parsed,
        parsedType: typeof parsed.value
      });
    }
    
    return parsed;
  } catch (error) {
    // Log parsing failures with context
    logger.debug('Metric JSON parsing failed', {
      originalValue: typeof originalValue === 'string' ? originalValue.substring(0, 100) + '...' : originalValue,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    return null;
  }
}

// ============================
// NUMERIC VALUE PARSING FUNCTIONS
// ============================

/**
 * Safely parses metric values from heterogeneous data sources into numeric format.
 * Handles multiple input formats commonly encountered in analytics data processing.
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