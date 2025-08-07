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