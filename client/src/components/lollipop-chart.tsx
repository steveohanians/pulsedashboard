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
  clientName?: string;
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
  clientName,
  industryAvg, 
  cdAvg 
}: LollipopChartProps) {
  // Use provided client name or extract from URL as fallback
  const getClientDisplayName = () => {
    if (clientName) return clientName;
    if (!clientUrl) return 'Demo Company';
    // Remove protocol and www, take first part before .com
    const cleanUrl = clientUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
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
      data: normalizeData(comp.value || { Desktop: 55, Mobile: 35, Tablet: 10 }),
      type: 'competitor'
    }))
  ];

  const devices = ['Desktop', 'Mobile', 'Tablet'] as const;



  // Calculate dynamic width based on longest entity name with responsive sizing
  const maxLabelLength = Math.max(...chartEntities.map(entity => entity.label.length));
  const labelWidth = Math.max(80, Math.min(160, maxLabelLength * 6)); // Responsive width

  return (
    <div className="w-full flex flex-col">
      {/* Main chart area with legend on right/bottom */}
      <div className="flex-1 px-1 sm:px-2 py-1 flex flex-col lg:flex-row" style={{ minHeight: `${chartEntities.length * 48 + 50}px` }}>
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
              <div className="flex flex-col" style={{ height: `${chartEntities.length * 48}px` }}>
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
                          {/* Lollipop dot with tooltip */}
                          <div
                            className="absolute w-2 h-2 rounded-full border border-white shadow-sm group hover:scale-125 transition-transform duration-200"
                            style={{
                              backgroundColor: color,
                              left: `${percentage}%`,
                              top: '-3px',
                              transform: 'translateX(-50%)'
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

              {/* X-axis labels */}
              <div className="absolute left-0 right-0 flex justify-between text-xs text-gray-500" style={{ top: `${chartEntities.length * 48 + 8}px` }}>
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

        {/* Legend - responsive positioning with proper spacing */}
        <div className="flex lg:flex-col justify-center lg:justify-start gap-4 lg:gap-2 lg:ml-3 lg:w-20 mt-4 lg:mt-0 lg:pt-4 pb-2">
          {devices.map((device) => (
            <div key={device} className="flex items-center space-x-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                style={{ backgroundColor: DEVICE_COLORS[device] }}
              />
              <span className="text-xs text-gray-600 whitespace-nowrap">{device}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}