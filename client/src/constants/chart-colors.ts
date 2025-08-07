// Consolidated chart color constants
// Used across multiple chart components for consistent styling

export const CHART_COLORS = {
  // Data source colors
  Client: 'hsl(var(--color-client))',
  CD_Avg: 'hsl(var(--color-cd-avg))',
  Industry_Avg: 'hsl(var(--color-industry-avg))',
  Industry: 'hsl(var(--color-industry-avg))', // fallback
  Competitor: 'hsl(var(--color-competitor-1))',
  
  // Device distribution colors
  Desktop: 'hsl(var(--color-device-desktop))',
  Mobile: 'hsl(var(--color-device-mobile))',
  
  // Default fallback
  Default: 'hsl(var(--color-default))'
};

// Specific device colors for device distribution charts
export const DEVICE_COLORS = {
  Desktop: CHART_COLORS.Desktop,
  Mobile: CHART_COLORS.Mobile
};

// Data source colors for metrics charts
export const DATA_SOURCE_COLORS = {
  Client: CHART_COLORS.Client,
  CD_Avg: CHART_COLORS.CD_Avg,
  Industry_Avg: CHART_COLORS.Industry_Avg,
  Industry: CHART_COLORS.Industry,
  Competitor: CHART_COLORS.Competitor
};