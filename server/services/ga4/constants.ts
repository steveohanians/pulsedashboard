/**
 * GA4 API Constants and Configuration
 */

export const GA4_ENDPOINTS = {
  ANALYTICS_DATA: 'https://analyticsdata.googleapis.com/v1beta',
  OAUTH_TOKEN: 'https://oauth2.googleapis.com/token',
  OAUTH_REFRESH: 'https://oauth2.googleapis.com/token'
} as const;

export const GA4_METRICS = {
  BOUNCE_RATE: 'bounceRate',
  SESSION_DURATION: 'averageSessionDuration',
  PAGES_PER_SESSION: 'screenPageViewsPerSession',
  SESSIONS_PER_USER: 'sessionsPerUser',
  SESSIONS: 'sessions',
  TOTAL_USERS: 'totalUsers'
} as const;

export const GA4_DIMENSIONS = {
  DATE: 'date',
  TRAFFIC_CHANNEL: 'sessionDefaultChannelGrouping',
  DEVICE_CATEGORY: 'deviceCategory'
} as const;

export const DATA_MANAGEMENT = {
  DEFAULT_PERIODS: 15,
  DAILY_DATA_THRESHOLD_MONTHS: 2, // Fetch daily data for Last Month AND current month
  MAX_BATCH_SIZE: 5,
  CACHE_TTL_MINUTES: 15
} as const;

export const METRIC_NAMES = {
  BOUNCE_RATE: 'Bounce Rate',
  SESSION_DURATION: 'Session Duration',
  PAGES_PER_SESSION: 'Pages per Session',
  SESSIONS_PER_USER: 'Sessions per User',
  TRAFFIC_CHANNELS: 'Traffic Channels',
  DEVICE_DISTRIBUTION: 'Device Distribution'
} as const;