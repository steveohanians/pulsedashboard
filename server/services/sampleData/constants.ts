/**
 * Sample Data Configuration and Constants
 */

export const SAMPLE_DATA_CONFIG = {
  DEFAULT_PERIODS: 15,
  MAX_COMPETITORS: 3,
  MIN_COMPETITORS: 1,
  VARIATION_RANGE: 0.1, // 10% variation
  SEASONAL_FACTOR: 0.05, // 5% seasonal variation
} as const;

export const METRIC_RANGES = {
  BOUNCE_RATE: { min: 25, max: 75 },
  SESSION_DURATION: { min: 120, max: 400 },
  PAGES_PER_SESSION: { min: 1.5, max: 4.5 },
  SESSIONS_PER_USER: { min: 1.1, max: 2.8 }
} as const;

export const TREND_PATTERNS = {
  IMPROVING: {
    magnitude: 0.15, // 15% improvement over 15 months
    volatility: 0.03 // 3% month-to-month variation
  },
  DECLINING: {
    magnitude: -0.08, // 8% decline over 15 months
    volatility: 0.05 // 5% month-to-month variation
  },
  STABLE: {
    magnitude: 0.02, // 2% variation over 15 months
    volatility: 0.02 // 2% month-to-month variation
  },
  VOLATILE: {
    magnitude: 0.05, // 5% net change over 15 months
    volatility: 0.08 // 8% month-to-month variation
  }
} as const;

export const COMPETITOR_DOMAINS = [
  'herodigital.com',
  'focuslab.agency',
  'digitalbrand.co',
  'webstrategy.io',
  'marketingpro.net',
  'brandbuilders.com',
  'digitalcraft.agency',
  'growthhub.co',
  'innovatemarketing.com',
  'nextleveldigital.io'
] as const;

export const TRAFFIC_CHANNEL_BASELINES = {
  'Organic Search': 35,
  'Direct': 25,
  'Social Media': 15,
  'Paid Search': 12,
  'Email': 8,
  'Referral': 3,
  'Other': 2
} as const;

export const DEVICE_DISTRIBUTION_BASELINE = {
  'Desktop': 45,
  'Mobile': 45,
  'Tablet': 10
} as const;

export const METRIC_NAMES = {
  BOUNCE_RATE: 'Bounce Rate',
  SESSION_DURATION: 'Session Duration',
  PAGES_PER_SESSION: 'Pages per Session',
  SESSIONS_PER_USER: 'Sessions per User',
  TRAFFIC_CHANNELS: 'Traffic Channels',
  DEVICE_DISTRIBUTION: 'Device Distribution'
} as const;