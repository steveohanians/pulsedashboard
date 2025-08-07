/**
 * Utility functions for parsing metric values that can be either plain numbers or JSON objects
 */

export interface MetricValueObject {
  value: number;
  source?: string;
  percentage?: number;
  sessions?: number;
}

/**
 * Safely parse a metric value that could be a string number or JSON object
 */
export function parseMetricValue(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's already a number
  if (typeof value === 'number') {
    return value;
  }

  // If it's a string, try to parse as number first
  if (typeof value === 'string') {
    // Try parsing as JSON first (for SEMrush competitor metrics and CD_Avg metrics)
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
        const numValue = typeof parsed.value === 'number' ? parsed.value : parseFloat(parsed.value);
        // Debug successful JSON parsing
        console.log('✅ JSON PARSE SUCCESS:', { originalValue: value, parsedValue: numValue });
        return numValue;
      }
    } catch (e) {
      // Log failed JSON parsing attempts
      console.log('❌ JSON PARSE FAILED:', { value: typeof value === 'string' ? value.substring(0, 100) : value, error: e instanceof Error ? e.message : String(e) });
    }
    
    // Parse as plain number
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  // If it's already an object with value property
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return typeof value.value === 'number' ? value.value : parseFloat(value.value);
  }

  return null;
}

/**
 * Parse metric value for percentage data (traffic channels, device distribution)
 */
export function parseMetricPercentage(value: any): { percentage: number; sessions?: number } | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's a string, try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && 'percentage' in parsed) {
        return {
          percentage: typeof parsed.percentage === 'number' ? parsed.percentage : parseFloat(parsed.percentage),
          sessions: parsed.sessions ? (typeof parsed.sessions === 'number' ? parsed.sessions : parseFloat(parsed.sessions)) : undefined
        };
      }
    } catch {
      // Not JSON, try parsing as plain number (assume it's percentage)
      const num = parseFloat(value);
      return isNaN(num) ? null : { percentage: num };
    }
  }

  // If it's already an object with percentage property
  if (typeof value === 'object' && value !== null && 'percentage' in value) {
    return {
      percentage: typeof value.percentage === 'number' ? value.percentage : parseFloat(value.percentage),
      sessions: value.sessions ? (typeof value.sessions === 'number' ? value.sessions : parseFloat(value.sessions)) : undefined
    };
  }

  // If it's a plain number, assume it's percentage
  if (typeof value === 'number') {
    return { percentage: value };
  }

  return null;
}