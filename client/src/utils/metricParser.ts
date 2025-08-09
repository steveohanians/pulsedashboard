/**
 * Client-side utility functions for parsing metric values that can be either plain numbers or JSON objects
 */

export interface MetricValueObject {
  value: number;
  source?: string;
  percentage?: number;
  sessions?: number;
}

/**
 * Client-side parseMetricValue that maintains UI compatibility.
 * Duplicated from server logic but converts null to 0 for display purposes.
 * 
 * @param value - Raw metric value to parse
 * @returns Parsed number value (0 fallback for UI display)
 */
export function parseMetricValue(value: any): number {
  if (value === null || value === undefined) {
    return 0; // UI fallback
  }

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
        return typeof parsed.value === 'number' ? parsed.value : parseFloat(parsed.value) || 0;
      }
      return parseFloat(value) || 0;
    } catch {
      return parseFloat(value) || 0;
    }
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    return typeof value.value === 'number' ? value.value : parseFloat(value.value) || 0;
  }

  return 0; // UI fallback
}

/**
 * Parse metric value for percentage data (traffic channels, device distribution)
 */
export function parseMetricPercentage(value: any): { percentage: number; sessions?: number } {
  if (value === null || value === undefined) {
    return { percentage: 0 };
  }

  // If it's a string, try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && 'percentage' in parsed) {
        return {
          percentage: typeof parsed.percentage === 'number' ? parsed.percentage : parseFloat(parsed.percentage) || 0,
          sessions: parsed.sessions ? (typeof parsed.sessions === 'number' ? parsed.sessions : parseFloat(parsed.sessions) || 0) : undefined
        };
      }
    } catch {
      // Not JSON, try parsing as plain number (assume it's percentage)
      const num = parseFloat(value);
      return { percentage: isNaN(num) ? 0 : num };
    }
  }

  // If it's already an object with percentage property
  if (typeof value === 'object' && value !== null && 'percentage' in value) {
    return {
      percentage: typeof value.percentage === 'number' ? value.percentage : parseFloat(value.percentage) || 0,
      sessions: value.sessions ? (typeof value.sessions === 'number' ? value.sessions : parseFloat(value.sessions) || 0) : undefined
    };
  }

  // If it's a plain number, assume it's percentage
  if (typeof value === 'number') {
    return { percentage: value };
  }

  // Fallback
  return { percentage: 0 };
}