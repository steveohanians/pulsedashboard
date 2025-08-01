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
      <div className="flex-1 px-2 py-6">
        <div className="relative h-full">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 w-32 flex flex-col justify-between py-4">
            {chartEntities.map((entity, index) => (
              <div key={index} className="text-xs text-gray-600 text-right pr-4 flex items-center justify-end h-12">
                <span className={entity.type === 'client' ? 'font-semibold text-primary' : 'font-medium'}>
                  {entity.label}
                </span>
              </div>
            ))}
          </div>

          {/* Chart grid and lollipops */}
          <div className="ml-32 h-full relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-4">
              {chartEntities.map((_, index) => (
                <div key={index} className="h-12 border-b border-gray-200 last:border-b-0" />
              ))}
            </div>

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

            {/* Lollipop chart */}
            <div className="absolute inset-0 py-4">
              {chartEntities.map((entity, entityIndex) => (
                <div key={entityIndex} className="relative h-12 flex items-center">
                  {devices.map((device, deviceIndex) => {
                    const value = entity.data[device];
                    const color = DEVICE_COLORS[device];
                    const percentage = Math.round(value * 100);
                    
                    return (
                      <div key={device} className="absolute w-full" style={{ top: `${deviceIndex * 4}px` }}>
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
                          className="absolute text-xs font-medium text-gray-700"
                          style={{
                            left: `${percentage}%`,
                            top: '-16px',
                            transform: 'translateX(-50%)'
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
            <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-xs text-gray-500">
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