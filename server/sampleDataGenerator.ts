// Comprehensive sample data generator for all metrics and time periods
import { storage } from "./storage";

interface MetricConfig {
  name: string;
  clientRange: [number, number];
  industryRange: [number, number];
  cdRange: [number, number];
  unit: string;
  isPercentage?: boolean;
  isComplex?: boolean;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    name: "Bounce Rate",
    clientRange: [35, 55],
    industryRange: [45, 65],
    cdRange: [40, 60],
    unit: "%",
    isPercentage: true
  },
  {
    name: "Session Duration",
    clientRange: [180, 300], // 3-5 minutes in seconds
    industryRange: [150, 270],
    cdRange: [160, 280],
    unit: "seconds"
  },
  {
    name: "Pages per Session",
    clientRange: [2.1, 3.5],
    industryRange: [1.8, 3.2],
    cdRange: [1.9, 3.3],
    unit: "pages"
  },
  {
    name: "Sessions per User",
    clientRange: [1.3, 2.1],
    industryRange: [1.1, 1.9],
    cdRange: [1.2, 2.0],
    unit: "sessions"
  }
];

const TIME_PERIODS = ["2025-06", "2025-05", "2025-04", "2024-10", "2024-01"];
const SOURCE_TYPES = ["Client", "Industry_Avg", "CD_Avg"];

// Generate realistic variance around base value
function generateValue(baseRange: [number, number], seed: number, timeVariance = 0.1): number {
  const [min, max] = baseRange;
  const baseValue = min + (max - min) * (0.3 + seed * 0.4); // Use seed for consistency
  const variance = (Math.sin(seed * 123.456) * timeVariance * baseValue);
  return Math.max(min, Math.min(max, baseValue + variance));
}

// Generate traffic channel data
function generateTrafficChannels(seed: number) {
  const channels = [
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
    color: getChannelColor(channel.name)
  }));
}

// Generate device distribution data
function generateDeviceDistribution(seed: number) {
  const desktop = 50 + (Math.sin(seed * 1.1) * 15);
  const mobile = 40 + (Math.sin(seed * 2.2) * 12);
  const tablet = 10 + (Math.sin(seed * 3.3) * 3);
  
  const total = desktop + mobile + tablet;
  const desktopNorm = Math.round((desktop / total) * 100);
  const mobileNorm = Math.round((mobile / total) * 100);
  const tabletNorm = 100 - desktopNorm - mobileNorm;

  return [
    { name: "Desktop", value: desktopNorm, percentage: desktopNorm, color: "#3b82f6" },
    { name: "Mobile", value: mobileNorm, percentage: mobileNorm, color: "#10b981" },
    { name: "Tablet", value: tabletNorm, percentage: tabletNorm, color: "#8b5cf6" }
  ];
}

function getChannelColor(channelName: string): string {
  const colors: Record<string, string> = {
    "Organic Search": "#10b981",
    "Direct": "#3b82f6", 
    "Social Media": "#8b5cf6",
    "Paid Search": "#f59e0b",
    "Email": "#ec4899"
  };
  return colors[channelName] || "#6b7280";
}

export async function generateComprehensiveSampleData() {
  console.log("Generating comprehensive sample data...");
  
  const clientId = "demo-client-id";
  
  try {
    // Generate standard metrics for all time periods and source types
    for (const timePeriod of TIME_PERIODS) {
      const periodSeed = timePeriod.charCodeAt(0) + timePeriod.charCodeAt(1);
      
      for (const sourceType of SOURCE_TYPES) {
        const sourceSeed = periodSeed + sourceType.charCodeAt(0);
        
        // Generate standard metrics
        for (const config of METRIC_CONFIGS) {
          let range: [number, number];
          if (sourceType === "Client") range = config.clientRange;
          else if (sourceType === "Industry_Avg") range = config.industryRange;
          else range = config.cdRange;
          
          const value = generateValue(range, sourceSeed + config.name.charCodeAt(0));
          const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
            ? Math.round(value * 10) / 10 
            : Math.round(value);
          
          await storage.createMetric({
            clientId,
            metricName: config.name,
            value: finalValue,
            sourceType: sourceType as any,
            timePeriod
          });
        }
        
        // Generate Traffic Channels data
        const trafficChannels = generateTrafficChannels(sourceSeed + 100);
        for (const channel of trafficChannels) {
          await storage.createMetric({
            clientId,
            metricName: "Traffic Channels",
            value: channel.value,
            sourceType: sourceType as any,
            timePeriod,
            channel: channel.name
          });
        }
        
        // Generate Device Distribution data
        const deviceData = generateDeviceDistribution(sourceSeed + 200);
        for (const device of deviceData) {
          await storage.createMetric({
            clientId,
            metricName: "Device Distribution",
            value: device.value,
            sourceType: sourceType as any,
            timePeriod,
            channel: device.name
          });
        }
      }
    }
    
    console.log("Sample data generation completed successfully");
    return { success: true, message: "Comprehensive sample data generated" };
    
  } catch (error) {
    console.error("Error generating sample data:", error);
    throw error;
  }
}