/**
 * Device Distribution Processing Service
 * Handles all device distribution data aggregation and transformation
 */

import { debugLog } from '@/config/dataSourceConfig';

interface DeviceMetric {
  metricName: string;
  value: any;
  sourceType: string;
  channel?: string;
  competitorId?: string;
}

interface DeviceData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ProcessedDeviceData {
  sourceType: string;
  label: string;
  devices: DeviceData[];
}

export class DeviceDistributionService {
  private static instance: DeviceDistributionService;

  static getInstance(): DeviceDistributionService {
    if (!this.instance) {
      this.instance = new DeviceDistributionService();
    }
    return this.instance;
  }

  private readonly DEVICE_COLORS = {
    Desktop: '#3b82f6',
    Mobile: '#10b981',
    Tablet: '#84cc16',
    Other: '#64748b'
  };

  /**
   * Process device distribution data for lollipop charts
   * Extracted from dashboard.tsx processDeviceDistributionData function
   */
  processDevices(
    metrics: DeviceMetric[],
    competitors: Array<{ id: string; domain: string }>,
    client: { name?: string } | undefined
  ): ProcessedDeviceData[] {
    const deviceMetrics = metrics.filter(m => m.metricName === "Device Distribution");
    
    debugLog('DEVICE', 'Processing device distribution', {
      totalMetrics: deviceMetrics.length,
      sources: Array.from(new Set(deviceMetrics.map(m => m.sourceType)))
    });

    const result: ProcessedDeviceData[] = [];

    // Process Client data
    const clientDeviceData = deviceMetrics.filter(m => m.sourceType === "Client");
    if (clientDeviceData.length > 0) {
      result.push({
        sourceType: "Client",
        label: client?.name || "Client",
        devices: this.aggregateDeviceData(clientDeviceData)
      });
    }

    // Process CD Average data
    const cdDeviceData = deviceMetrics.filter(m => m.sourceType === "CD_Avg");
    if (cdDeviceData.length > 0) {
      result.push({
        sourceType: "CD_Avg",
        label: "Clear Digital Client Avg",
        devices: this.aggregateDeviceData(cdDeviceData)
      });
    }

    // Process Industry Average data
    const industryDeviceData = deviceMetrics.filter(m => m.sourceType === "Industry_Avg");
    if (industryDeviceData.length > 0) {
      result.push({
        sourceType: "Industry_Avg",
        label: "Industry Avg",
        devices: this.aggregateDeviceData(industryDeviceData)
      });
    }

    // Note: Not processing competitors for device distribution as per original logic
    // Competitors device data will come from actual data sources in the future

    debugLog('DEVICE', 'Processed device distribution', {
      resultCount: result.length,
      sources: result.map(r => r.sourceType)
    });

    return result;
  }

  /**
   * Aggregate device data from various formats
   */
  private aggregateDeviceData(sourceMetrics: DeviceMetric[]): DeviceData[] {
    const deviceSums = new Map<string, number>();
    const deviceCounts = new Map<string, number>();

    sourceMetrics.forEach(metric => {
      // Handle individual device records (competitors/averages format)
      if (metric.channel) {
        const deviceName = metric.channel;
        const value = parseFloat(String(metric.value));
        this.addDeviceValue(deviceSums, deviceCounts, deviceName, value);
      } 
      // Handle array format (GA4 format)
      else if (Array.isArray(metric.value)) {
        metric.value.forEach((device: any) => {
          const deviceName = device.device || device.name || device.category;
          const value = parseFloat(device.percentage || device.value || device.sessions);
          if (deviceName && !isNaN(value)) {
            this.addDeviceValue(deviceSums, deviceCounts, deviceName, value);
          }
        });
      }
      // Handle JSON string format
      else if (typeof metric.value === 'string') {
        try {
          let jsonString = metric.value;
          
          // Remove outer quotes if present
          if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
            jsonString = jsonString.slice(1, -1);
          }
          
          // Unescape JSON
          jsonString = jsonString.replace(/\\"/g, '"');
          
          const deviceData = JSON.parse(jsonString);
          if (Array.isArray(deviceData)) {
            deviceData.forEach((device: any) => {
              const deviceName = device.device || device.name || device.category;
              const value = parseFloat(device.percentage || device.value || device.sessions);
              if (deviceName && !isNaN(value)) {
                this.addDeviceValue(deviceSums, deviceCounts, deviceName, value);
              }
            });
          }
        } catch (e) {
          debugLog('ERROR', 'Invalid device JSON data', { error: e, value: metric.value?.substring?.(0, 100) });
        }
      }
    });

    // Calculate averages and normalize
    const devices = this.calculateDeviceAverages(deviceSums, deviceCounts);
    return this.normalizeDevicePercentages(devices);
  }

  /**
   * Add device value to aggregation maps
   */
  private addDeviceValue(
    sums: Map<string, number>,
    counts: Map<string, number>,
    deviceName: string,
    value: number
  ): void {
    if (!isNaN(value)) {
      if (sums.has(deviceName)) {
        sums.set(deviceName, sums.get(deviceName)! + value);
        counts.set(deviceName, counts.get(deviceName)! + 1);
      } else {
        sums.set(deviceName, value);
        counts.set(deviceName, 1);
      }
    }
  }

  /**
   * Calculate average values from sums and counts
   */
  private calculateDeviceAverages(
    sums: Map<string, number>,
    counts: Map<string, number>
  ): DeviceData[] {
    const devices: DeviceData[] = [];
    
    Array.from(sums.entries()).forEach(([deviceName, sum]) => {
      const count = counts.get(deviceName) || 1;
      const average = sum / count;
      
      // Normalize device names
      const normalizedName = deviceName.charAt(0).toUpperCase() + deviceName.slice(1).toLowerCase();
      
      devices.push({
        name: normalizedName,
        value: Math.round(average),
        percentage: Math.round(average),
        color: this.DEVICE_COLORS[normalizedName as keyof typeof this.DEVICE_COLORS] || this.DEVICE_COLORS.Other
      });
    });

    return devices;
  }

  /**
   * Normalize device percentages to sum to 100%
   */
  private normalizeDevicePercentages(devices: DeviceData[]): DeviceData[] {
    const total = devices.reduce((sum, device) => sum + device.value, 0);
    
    if (total === 0) {
      // Return default distribution if no data
      return [
        { name: 'Desktop', value: 55, percentage: 55, color: this.DEVICE_COLORS.Desktop },
        { name: 'Mobile', value: 45, percentage: 45, color: this.DEVICE_COLORS.Mobile }
      ];
    }

    let runningTotal = 0;
    devices.forEach((device, index) => {
      if (index === devices.length - 1) {
        // Last device gets the remainder to ensure exactly 100%
        device.value = 100 - runningTotal;
        device.percentage = 100 - runningTotal;
      } else {
        const normalizedValue = Math.round((device.value / total) * 100);
        device.value = normalizedValue;
        device.percentage = normalizedValue;
        runningTotal += normalizedValue;
      }
    });

    return devices;
  }

  /**
   * Get simplified device data for specific source
   */
  getSimplifiedDeviceData(
    processedData: ProcessedDeviceData[],
    sourceType: string
  ): { Desktop: number; Mobile: number } {
    const sourceData = processedData.find(d => d.sourceType === sourceType);
    const result = { Desktop: 0, Mobile: 0 };
    
    if (sourceData) {
      sourceData.devices.forEach(device => {
        if (device.name === 'Desktop' || device.name === 'Mobile') {
          result[device.name as keyof typeof result] = device.percentage;
        }
      });
    }

    // Ensure we have valid percentages
    if (result.Desktop === 0 && result.Mobile === 0) {
      return { Desktop: 55, Mobile: 45 }; // Default fallback
    }

    return result;
  }
}

// Export singleton instance
export const deviceDistributionService = DeviceDistributionService.getInstance();