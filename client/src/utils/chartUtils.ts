// Consolidated chart utility functions
// Used across multiple chart components to reduce duplication

/**
 * Generate readable period labels for chart display
 * Converts period strings like "2025-07" to "Jul 2025"
 */
export function generatePeriodLabel(period: string): string {
  if (!period) return '';
  
  // Handle different period formats
  if (period.includes('-')) {
    const [year, month] = period.split('-');
    if (year && month) {
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
    }
  }
  
  return period; // Return as-is if format is unrecognized
}

/**
 * Common tooltip content style for consistent chart tooltips
 */
export const TOOLTIP_STYLES = {
  container: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
    padding: '8px 12px',
    fontSize: '12px'
  },
  label: {
    color: 'hsl(var(--foreground))',
    fontWeight: 'medium' as const,
    fontSize: '11px',
    marginBottom: '4px'
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2px'
  },
  indicator: {
    width: '8px',
    height: '8px',
    marginRight: '6px',
    borderRadius: '50%'
  },
  text: {
    color: 'hsl(var(--foreground))',
    fontSize: '11px'
  }
};

/**
 * Format metric values for display in tooltips and charts
 */
export function formatMetricValue(value: number, metricName: string): string {
  const roundedValue = Math.round(value * 10) / 10;
  
  if (metricName.includes('Rate')) {
    return `${roundedValue}%`;
  } else if (metricName.includes('Session Duration')) {
    return `${roundedValue} min`;
  }
  
  return `${roundedValue}`;
}

/**
 * Generate deterministic seeded random number for consistent chart variations
 */
export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) / 2147483647; // Normalize to 0-1
}

/**
 * Generate temporal variation for chart data (authentic data only)
 */
export function generateTemporalVariationSync(
  baseValue: number, 
  dates: string[], 
  metricName: string,
  seed: string = 'default'
): number[] {
  // Return empty array - authentic data only
  console.warn(`No authentic temporal data available for ${metricName}`);
  return [];
}