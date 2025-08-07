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
  Tablet: 'hsl(var(--color-device-tablet))',
  Other: 'hsl(var(--color-device-other))',
  
  // Traffic channel colors
  'Organic Search': 'hsl(var(--color-competitor-1))',
  'Direct': 'hsl(var(--color-client))', 
  'Social Media': 'hsl(var(--color-competitor-1))',
  'Paid Search': 'hsl(var(--chart-3))',
  'Email': 'hsl(var(--chart-5))',
  'Referral': 'hsl(var(--chart-4))',
  
  // Default fallback
  Default: 'hsl(var(--color-default))'
};

// Specific device colors for device distribution charts
export const DEVICE_COLORS = {
  Desktop: CHART_COLORS.Desktop,
  Mobile: CHART_COLORS.Mobile,
  Tablet: CHART_COLORS.Tablet,
  Other: CHART_COLORS.Other
};

// Traffic channel colors for channel distribution charts
export const TRAFFIC_CHANNEL_COLORS = {
  'Organic Search': CHART_COLORS['Organic Search'],
  'Direct': CHART_COLORS['Direct'],
  'Social Media': CHART_COLORS['Social Media'],
  'Paid Search': CHART_COLORS['Paid Search'],
  'Email': CHART_COLORS['Email'],
  'Referral': CHART_COLORS['Referral'],
  'Other': CHART_COLORS.Other
};

// Data source colors for metrics charts
export const DATA_SOURCE_COLORS = {
  Client: CHART_COLORS.Client,
  CD_Avg: CHART_COLORS.CD_Avg,
  Industry_Avg: CHART_COLORS.Industry_Avg,
  Industry: CHART_COLORS.Industry,
  Competitor: CHART_COLORS.Competitor
};