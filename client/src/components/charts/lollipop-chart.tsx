import React from 'react';
import { CHART_COLORS } from '@/utils/chartUtils';

/** Device distribution data structure for Desktop and Mobile percentages */
interface DeviceDistribution {
  /** Desktop device percentage (0-100) */
  Desktop: number;
  /** Mobile device percentage (0-100) */
  Mobile: number;
}

/** Competitor data for comparative visualization */
interface CompetitorData {
  /** Unique competitor identifier */
  id: string;
  /** Display label for competitor */
  label: string;
  /** Device distribution values */
  value: DeviceDistribution;
}

interface LollipopChartProps {
  /** Client's device distribution data */
  data: DeviceDistribution;
  /** Array of competitor data for benchmarking */
  competitors: Array<CompetitorData>;
  /** Optional client URL for name extraction */
  clientUrl?: string;
  /** Optional explicit client name */
  clientName?: string;
  /** Industry average benchmarks */
  industryAvg: DeviceDistribution;
  /** Clear Digital portfolio average */
  cdAvg: DeviceDistribution;
}

/**
 * Interactive lollipop chart for device distribution visualization.
 * Displays comparative device usage (Desktop vs Mobile) across client data,
 * competitors, industry averages, and portfolio benchmarks. Features horizontal
 * bars with circular endpoints, responsive design, and color-coded legend.
 * 
 * Key features:
 * - Horizontal lollipop visualization with proportional bars
 * - Comparative benchmarking across multiple data sources
 * - Responsive design with mobile-optimized layout
 * - Dynamic client name extraction from URL or explicit naming
 * - Color-coded device differentiation using theme colors
 * - Interactive legend with device type indicators
 * - Normalized scale display (0-100% range)
 * - Automatic competitor data fallback handling
 * 
 * Used for device distribution analysis in analytics dashboard to help
 * users understand their audience device preferences relative to competitors.
 * 
 * @param data - Client's device distribution percentages
 * @param competitors - Array of competitor benchmark data
 * @param clientUrl - Client URL for automatic name extraction
 * @param clientName - Explicit client name override
 * @param industryAvg - Industry benchmark averages
 * @param cdAvg - Clear Digital portfolio averages
 */
export function LollipopChart({ 
  data, 
  competitors, 
  clientUrl, 
  clientName,
  industryAvg, 
  cdAvg 
}: LollipopChartProps) {
  /**
   * Extracts display name from client name or URL with fallback handling.
   * Prioritizes explicit client name, then extracts domain name from URL.
   */
  const getClientDisplayName = () => {
    if (clientName) return clientName;
    if (!clientUrl) return 'Demo Company';
    // Remove protocol and www, take first part before .com
    const cleanUrl = clientUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const parts = cleanUrl.split('.');
    return parts[0] || 'Demo Company';
  };
  
  /**
   * Converts percentage values (0-100) to proportions (0-1) for chart scaling.
   * Handles missing data with zero fallback for consistent visualization.
   */
  const normalizeData = (deviceData: DeviceDistribution): DeviceDistribution => ({
    Desktop: (deviceData.Desktop || 0) / 100,
    Mobile: (deviceData.Mobile || 0) / 100
  });

  // Prepare chart data
  const chartEntities = [
    {
      label: getClientDisplayName(),
      data: normalizeData(data),
      type: 'client'
    },
    {
      label: 'Clear Digital Avg',
      data: normalizeData(cdAvg),
      type: 'cd'
    },
    {
      label: 'Industry Avg',
      data: normalizeData(industryAvg),
      type: 'industry'
    },
    ...competitors.map(comp => ({
      label: comp.label,
      data: normalizeData(comp.value || { Desktop: 55, Mobile: 45 }),
      type: 'competitor'
    }))
  ];

  const devices = ['Desktop', 'Mobile'] as const;



  // Calculate dynamic width based on longest entity name
  const maxLabelLength = Math.max(...chartEntities.map(entity => entity.label.length));
  const labelWidth = Math.max(120, maxLabelLength * 8); // Dynamic width based on content
  
  // Calculate maximum value for dynamic scale
  const maxValue = Math.max(...chartEntities.flatMap(entity => 
    devices.map(device => entity.data[device])
  ));
  const scaleMax = Math.ceil(maxValue * 1.1 * 10) / 10; // Add 10% padding, round to nearest 0.1
  const showFullScale = scaleMax >= 0.95; // Show 100% if data goes above 95%

  return (
    <div className="w-full flex flex-col">
      {/* Main chart area with legend on right/bottom */}
      <div className="flex-1 px-1 sm:px-2 py-1 flex flex-col lg:flex-row" style={{ height: `${chartEntities.length * 48 + 80}px` }}>
        {/* Chart section */}
        <div className="flex-1 relative lg:mr-4 mb-4 lg:mb-0">
          {/* Combined layout - labels and chart rows in sync */}
          <div className="flex" style={{ height: `${chartEntities.length * 48}px` }}>
            {/* Y-axis labels column - responsive text size */}
            <div className="flex flex-col" style={{ width: `${labelWidth}px` }}>
              {chartEntities.map((entity, index) => (
                <div 
                  key={index} 
                  className="text-xs sm:text-sm text-gray-600 text-right pr-2 sm:pr-4 flex items-center justify-end border-b border-gray-200 last:border-b-0"
                  style={{ height: '48px' }}
                >
                  <span className={`${entity.type === 'client' ? 'font-semibold text-primary' : 'font-medium'} truncate`}>
                    {entity.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Chart area */}
            <div className="flex-1 relative">
              {/* Vertical grid lines - dynamic based on scale */}
              <div className="absolute inset-0">
                {(() => {
                  const maxScale = showFullScale ? 1 : scaleMax;
                  const step = maxScale <= 0.6 ? 0.1 : maxScale <= 0.8 ? 0.2 : 0.2;
                  const ticks = [];
                  for (let i = 0; i <= maxScale; i += step) {
                    ticks.push(i);
                  }
                  return ticks.map(tick => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 border-l border-gray-200"
                      style={{ left: `${(tick / maxScale) * 100}%` }}
                    />
                  ));
                })()}
              </div>

              {/* Lollipop chart rows */}
              <div className="flex flex-col" style={{ height: `${chartEntities.length * 48}px` }}>
                {chartEntities.map((entity, entityIndex) => (
                  <div 
                    key={entityIndex} 
                    className="relative flex items-center border-b border-gray-200 last:border-b-0"
                    style={{ height: '48px' }}
                  >
                    {devices.map((device, deviceIndex) => {
                      const value = entity.data[device];
                      const color = CHART_COLORS[device];
                      const percentage = Math.round(value * 100);
                      
                      return (
                        <div key={device} className="absolute w-full" style={{ top: `${24 + deviceIndex * 8 - 6}px` }}>
                          {/* Line from start to dot */}
                          <div 
                            className="absolute h-1 top-1/2 transform -translate-y-1/2"
                            style={{ 
                              left: '0%',
                              width: `${(value / (showFullScale ? 1 : scaleMax)) * 100}%`,
                              backgroundColor: color,
                              opacity: 0.3
                            }}
                          />
                          {/* Dot at the end */}
                          <div
                            className="absolute w-2 h-2 rounded-full border border-white shadow-sm group hover:scale-125 transition-transform duration-200"
                            style={{
                              backgroundColor: color,
                              left: `${(value / (showFullScale ? 1 : scaleMax)) * 100}%`,
                              top: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            {/* Tooltip */}
                            <div 
                              className="absolute invisible group-hover:visible z-10 -top-12 left-1/2 transform -translate-x-1/2 pointer-events-none whitespace-nowrap"
                              style={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                                padding: '8px 12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <div 
                                style={{ 
                                  width: '8px', 
                                  height: '8px', 
                                  backgroundColor: color, 
                                  marginRight: '8px',
                                  borderRadius: '50%'
                                }} 
                              />
                              <span style={{ color: '#374151', fontWeight: 'normal' }}>
                                {device}: {percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* X-axis labels - dynamic based on scale */}
              <div className="absolute left-0 right-0 flex justify-between text-xs text-gray-500" style={{ top: `${chartEntities.length * 48 + 8}px` }}>
                {(() => {
                  const maxScale = showFullScale ? 1 : scaleMax;
                  const step = maxScale <= 0.6 ? 0.1 : maxScale <= 0.8 ? 0.2 : 0.2;
                  const ticks = [];
                  for (let i = 0; i <= maxScale; i += step) {
                    ticks.push(i);
                  }
                  return ticks.map((tick, index) => (
                    <span key={tick} style={{ 
                      position: 'absolute',
                      left: `${(tick / maxScale) * 100}%`,
                      transform: 'translateX(-50%)'
                    }}>
                      {Math.round(tick * 100)}%
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Legend - responsive positioning with proper spacing */}
        <div className="flex lg:flex-col justify-center lg:justify-start gap-4 lg:gap-2 lg:ml-3 lg:w-20 mt-4 lg:mt-0 lg:pt-4 pb-2">
          {devices.map((device) => (
            <div key={device} className="flex items-center space-x-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                style={{ backgroundColor: CHART_COLORS[device] }}
              />
              <span className="text-xs text-gray-600 whitespace-nowrap">{device}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}