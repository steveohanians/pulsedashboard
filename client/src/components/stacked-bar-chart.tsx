import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface StackedBarData {
  sourceType: string;
  label: string;
  channels: {
    name: string;
    value: number;
    percentage: number;
    color: string;
  }[];
}

interface StackedBarChartProps {
  data: StackedBarData[];
  title: string;
  description?: string;
}

const CHANNEL_COLORS = {
  'Organic Search': '#10b981', // emerald-500
  'Direct': '#3b82f6', // blue-500
  'Social Media': '#8b5cf6', // violet-500
  'Paid Search': '#f59e0b', // amber-500
  'Email': '#ec4899', // pink-500
  'Other': '#6b7280', // gray-500
};

export function StackedBarChart({ data, title, description }: StackedBarChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<{
    channelName: string;
    value: number;
    barIndex: number;
  } | null>(null);



  // Check if we have any valid data
  const hasData = data && data.length > 0;
  
  // Show no data state if no valid data
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📊</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Channel data will appear here once collected</div>
        </div>
      </div>
    );
  }

  // Calculate the maximum label width needed for proper alignment
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.max(maxLabelLength * 8, 120); // 8px per char, min 120px

  // Calculate dynamic height based on content
  const barHeight = 32; // Height per bar including spacing
  const legendHeight = 60; // Height for legend area
  const containerHeight = data.length * barHeight + legendHeight;

  return (
    <div className="w-full space-y-2 relative pb-4" style={{ height: `${containerHeight}px` }}>
      <div className="space-y-2 sm:space-y-1.5 mb-4">
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-shrink-0" style={{ width: `${labelWidth}px` }}>
              <span className={`text-sm block truncate ${
                item.sourceType === 'Client' ? 'font-bold text-primary' : 'font-medium text-gray-700'
              }`}>
                {item.label}
              </span>
            </div>
            
            <div className="flex-1 h-6 sm:h-7 md:h-8 flex rounded-md bg-gray-100 relative min-w-0">
              {/* Inline tooltip for this bar - positioned below to avoid clipping */}
              {hoveredSegment && hoveredSegment.barIndex === index && (
                <div 
                  className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50 whitespace-nowrap"
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                    padding: '8px 12px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        backgroundColor: CHANNEL_COLORS[hoveredSegment.channelName as keyof typeof CHANNEL_COLORS] || '#6b7280',
                        borderRadius: '50%'
                      }}
                    />
                    <span style={{ color: '#374151' }}>
                      {hoveredSegment.channelName}: {Math.round(hoveredSegment.value)}%
                    </span>
                  </div>
                </div>
              )}
              
              {item.channels.map((channel, channelIndex) => {
                const isFirst = channelIndex === 0;
                const isLast = channelIndex === item.channels.length - 1;
                
                return (
                  <div
                    key={channelIndex}
                    className={`flex items-center justify-center text-xs font-medium text-white hover:brightness-110 transition-all cursor-pointer ${
                      isFirst ? 'rounded-l-md' : ''
                    } ${isLast ? 'rounded-r-md' : ''}`}
                    style={{
                      width: `${channel.percentage}%`,
                      backgroundColor: CHANNEL_COLORS[channel.name as keyof typeof CHANNEL_COLORS] || channel.color
                    }}
                    onMouseEnter={() => {
                      setHoveredSegment({
                        channelName: channel.name,
                        value: channel.value,
                        barIndex: index
                      });
                    }}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    {channel.percentage >= 3 ? `${Math.round(channel.value)}%` : ''}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2 pt-4 sm:pt-6 border-t border-gray-200 mt-4">
        {Object.entries(CHANNEL_COLORS).map(([channel, color]) => (
          <div key={channel} className="flex items-center gap-1.5 sm:gap-2">
            <div 
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600 whitespace-nowrap">{channel}</span>
          </div>
        ))}
      </div>

    </div>
  );
}