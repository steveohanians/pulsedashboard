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
 * Generate traffic channel distribution data
 * Consolidated from duplicate implementations in sampleDataGenerator.ts and other files
 */
export function generateTrafficChannels(seed: number) {
  const channels: ChannelConfig[] = [
    { name: "Organic Search", base: 45, variance: 15 },
    { name: "Direct", base: 25, variance: 10 },
    { name: "Social Media", base: 15, variance: 8 },
    { name: "Paid Search", base: 10, variance: 5 },
    { name: "Email", base: 5, variance: 3 }
  ];

  const values = channels.map(channel => {
    const variance = (Math.sin(seed * channel.base) - 0.5) * channel.variance;
    return Math.max(1, channel.base + variance);
  });

  // Normalize to 100%
  const total = values.reduce((sum, val) => sum + val, 0);
  const normalized = values.map(val => Math.round((val / total) * 100));

  return channels.map((channel, index) => ({
    name: channel.name,
    value: normalized[index],
    percentage: normalized[index],
    // Use CSS variable references instead of hardcoded colors
    color: getChannelColor(channel.name)
  }));
}

/**
 * Generate device distribution data  
 * Consolidated from duplicate implementations
 */
export function generateDeviceDistribution(seed: number) {
  const configs: DeviceConfig[] = [
    { name: "Desktop", basePercentage: 50, variance: 15 },
    { name: "Mobile", basePercentage: 40, variance: 12 },
    { name: "Tablet", basePercentage: 10, variance: 3 }
  ];
  
  const values = configs.map(config => 
    config.basePercentage + (Math.sin(seed * (config.basePercentage / 10)) * config.variance)
  );
  
  const total = values.reduce((sum, val) => sum + val, 0);
  const normalized = values.map(val => Math.round((val / total) * 100));
  
  // Ensure total is exactly 100%
  const adjustedTotal = normalized.reduce((sum, val) => sum + val, 0);
  if (adjustedTotal !== 100) {
    normalized[0] += (100 - adjustedTotal);
  }

  return configs.map((config, index) => ({
    name: config.name,
    value: normalized[index],
    percentage: normalized[index],
    // Use CSS variable references
    color: getDeviceColor(config.name)
  }));
}

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