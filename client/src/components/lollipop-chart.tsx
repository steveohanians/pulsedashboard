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
  Mobile: '#10B981',    // Green
  Tablet: '#8B5CF6',    // Purple
  Other: '#6B7280'      // Gray
};

export default function LollipopChart({ 
  data, 
  competitors, 
  clientUrl, 
  industryAvg, 
  cdAvg 
}: LollipopChartProps) {
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
      label: clientUrl || 'Demo Company',
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
    ...competitors.slice(0, 2).map(comp => ({
      label: comp.label,
      data: normalizeData(comp.value || { Desktop: 55, Mobile: 35, Tablet: 10 }),
      type: 'competitor'
    }))
  ];

  const devices = ['Desktop', 'Mobile', 'Tablet'] as const;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart area */}
      <div className="flex-1 px-2 py-4">
        <div className="relative h-full">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-32 flex flex-col justify-between py-6">
            {chartEntities.map((entity, index) => (
              <div key={index} className="text-xs text-gray-600 text-right pr-4 flex items-center justify-end h-8">
                <span className={entity.type === 'client' ? 'font-semibold text-primary' : 'font-medium'}>
                  {entity.label}
                </span>
              </div>
            ))}
          </div>

          {/* Chart grid and lollipops */}
          <div className="ml-32 h-full relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-6">
              {chartEntities.map((_, index) => (
                <div key={index} className="h-8 border-b border-gray-200 last:border-b-0" />
              ))}
            </div>

            {/* Vertical grid lines */}
            <div className="absolute inset-0">
              {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(tick => (
                <div
                  key={tick}
                  className="absolute top-0 bottom-0 border-l border-gray-200"
                  style={{ left: `${tick * 100}%` }}
                />
              ))}
            </div>

            {/* Lollipop chart */}
            <div className="absolute inset-0 py-6">
              {chartEntities.map((entity, entityIndex) => (
                <div key={entityIndex} className="relative h-8 flex items-center">
                  {devices.map((device, deviceIndex) => {
                    const value = entity.data[device];
                    const color = DEVICE_COLORS[device];
                    
                    return (
                      <div key={device} className="absolute w-full" style={{ top: `${deviceIndex * 2.5}px` }}>
                        {/* Lollipop stick */}
                        <div
                          className="h-0.5"
                          style={{
                            backgroundColor: color,
                            width: `${value * 100}%`,
                            position: 'relative'
                          }}
                        />
                        {/* Lollipop dot */}
                        <div
                          className="absolute w-2 h-2 rounded-full border border-white shadow-sm"
                          style={{
                            backgroundColor: color,
                            left: `${value * 100}%`,
                            top: '-3px',
                            transform: 'translateX(-50%)'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* X-axis labels */}
            <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-xs text-gray-500">
              <span>0.0</span>
              <span>0.2</span>
              <span>0.4</span>
              <span>0.6</span>
              <span>0.8</span>
              <span>1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* X-axis title */}
      <div className="text-center text-xs text-gray-500 pt-2 pb-1">
        Proportion of Traffic
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 pt-6 border-t border-gray-200">
        {devices.map(device => (
          <div key={device} className="flex items-center gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: DEVICE_COLORS[device] }}
            />
            <span className="text-xs text-gray-600 font-medium">{device}</span>
          </div>
        ))}
      </div>
    </div>
  );
}