// Centralized traffic channel and device distribution generation
// This file consolidates duplicate generation logic found across multiple files

interface ChannelConfig {
  name: string;
  base: number;
  variance: number;
}

interface DeviceConfig {
  name: string;
  basePercentage: number;
  variance: number;
}

/**
 * DEPRECATED: Traffic channel generation removed to ensure data authenticity
 * All Traffic Channels data must come from authentic GA4 sources only
 */
// export function generateTrafficChannels() - REMOVED for data integrity

/**
 * DEPRECATED: Device distribution generation removed to ensure data authenticity
 * All Device Distribution data must come from authentic GA4 sources only
 */
// export function generateDeviceDistribution() - REMOVED for data integrity

/**
 * Get channel color using CSS variables instead of hardcoded values
 */
function getChannelColor(channelName: string): string {
  const colorMap: Record<string, string> = {
    'Organic Search': 'hsl(var(--color-competitor-1))',
    'Direct': 'hsl(var(--color-client))',
    'Social Media': 'hsl(var(--color-competitor-1))',
    'Paid Search': 'hsl(var(--chart-3))', 
    'Email': 'hsl(var(--chart-5))',
    'Other': 'hsl(var(--color-device-other))'
  };
  return colorMap[channelName] || 'hsl(var(--color-device-other))';
}

/**
 * Get device color using CSS variables
 */
function getDeviceColor(deviceName: string): string {
  const colorMap: Record<string, string> = {
    'Desktop': 'hsl(var(--color-device-desktop))',
    'Mobile': 'hsl(var(--color-device-mobile))',
    'Tablet': 'hsl(var(--color-device-tablet))',
    'Other': 'hsl(var(--color-device-other))'
  };
  return colorMap[deviceName] || 'hsl(var(--color-device-other))';
}