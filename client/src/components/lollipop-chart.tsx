import React from 'react';

interface LollipopChartProps {
  data: {
    Desktop: number;
    Mobile: number;
    Tablet: number;
    Other?: number;
  };
  competitors: Array<{
    id: string;
    label: string;
    value: any;
  }>;
  clientUrl?: string;
  industryAvg: {
    Desktop: number;
    Mobile: number;
    Tablet: number;
    Other?: number;
  };
  cdAvg: {
    Desktop: number;
    Mobile: number;
    Tablet: number;
    Other?: number;
  };
}

const DEVICE_COLORS = {
  Desktop: '#3B82F6',   // Blue
  Mobile: '#EF4444',    // Red  
  Tablet: '#F59E0B',    // Amber
  Other: '#6B7280'      // Gray
};

export default function LollipopChart({ 
  data, 
  competitors, 
  clientUrl, 
  industryAvg, 
  cdAvg 
}: LollipopChartProps) {
  // Extract client name from URL or use fallback
  const getClientName = (url?: string) => {
    if (!url) return 'Demo Company';
    // Remove protocol and www, take first part before .com
    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const parts = cleanUrl.split('.');
    return parts[0] || 'Demo Company';
  };
  // Convert percentages to proportions (0-1 scale)
  const normalizeData = (deviceData: any) => ({
    Desktop: (deviceData.Desktop || 0) / 100,
    Mobile: (deviceData.Mobile || 0) / 100,
    Tablet: (deviceData.Tablet || 0) / 100,
    Other: (deviceData.Other || 0) / 100,
  });

  // Prepare chart data
  const chartEntities = [
    {
      label: getClientName(clientUrl),
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
      data: normalizeData(comp.value || { Desktop: 55, Mobile: 35, Tablet: 10 }),
      type: 'competitor'
    }))
  ];

  const devices = ['Desktop', 'Mobile', 'Tablet'] as const;

  // Calculate dynamic width based on longest entity name, with more space
  const maxLabelLength = Math.max(...chartEntities.map(entity => entity.label.length));
  const labelWidth = Math.max(160, Math.min(280, maxLabelLength * 10)); // More generous spacing

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main chart area with legend on right */}
      <div className="flex-1 px-2 py-2 flex">
        {/* Chart section */}
        <div className="flex-1 relative h-full mr-4">
          {/* Combined layout - labels and chart rows in sync */}
          <div className="h-full flex">
            {/* Y-axis labels column */}
            <div className="flex flex-col justify-center" style={{ width: `${labelWidth}px` }}>
              {chartEntities.map((entity, index) => (
                <div 
                  key={index} 
                  className="text-xs text-gray-600 text-right pr-4 flex items-center justify-end border-b border-gray-200 last:border-b-0"
                  style={{ height: '48px' }}
                >
                  <span className={entity.type === 'client' ? 'font-semibold text-pink-600' : 'font-medium'}>
                    {entity.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Chart area */}
            <div className="flex-1 relative">
              {/* Vertical grid lines */}
              <div className="absolute inset-0">
                {[0, 20, 40, 60, 80, 100].map(tick => (
                  <div
                    key={tick}
                    className="absolute top-0 bottom-0 border-l border-gray-200"
                    style={{ left: `${tick}%` }}
                  />
                ))}
              </div>

              {/* Lollipop chart rows */}
              <div className="h-full flex flex-col justify-center">
                {chartEntities.map((entity, entityIndex) => (
                  <div 
                    key={entityIndex} 
                    className="relative flex items-center border-b border-gray-200 last:border-b-0"
                    style={{ height: '48px' }}
                  >
                    {devices.map((device, deviceIndex) => {
                      const value = entity.data[device];
                      const color = DEVICE_COLORS[device];
                      const percentage = Math.round(value * 100);
                      
                      return (
                        <div key={device} className="absolute w-full" style={{ top: `${24 + deviceIndex * 4 - 6}px` }}>
                          {/* Lollipop stick */}
                          <div
                            className="h-0.5"
                            style={{
                              backgroundColor: color,
                              width: `${percentage}%`,
                              position: 'relative'
                            }}
                          />
                          {/* Lollipop dot */}
                          <div
                            className="absolute w-2 h-2 rounded-full border border-white shadow-sm"
                            style={{
                              backgroundColor: color,
                              left: `${percentage}%`,
                              top: '-3px',
                              transform: 'translateX(-50%)'
                            }}
                          />
                          {/* Value label */}
                          <div
                            className="absolute text-xs text-gray-500"
                            style={{
                              left: `${percentage}%`,
                              top: '-8px',
                              transform: 'translateX(0%)',
                              paddingLeft: '8px'
                            }}
                          >
                            {percentage}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* X-axis labels */}
              <div className="absolute -bottom-2 left-0 right-0 flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>20%</span>
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend on the right */}
        <div className="flex flex-col justify-center gap-3 pl-4 border-l border-gray-200 min-w-20">
          {devices.map(device => (
            <div key={device} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: DEVICE_COLORS[device] }}
              />
              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">{device}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}