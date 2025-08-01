import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.max(maxLabelLength * 8, 120); // 8px per char, min 120px, no max limit

  return (
    <div className="w-full h-full space-y-3 sm:space-y-4 relative" style={{ overflow: 'visible', paddingTop: '50px', paddingRight: '8px', paddingLeft: '4px', zIndex: 1 }}>
      <div className="space-y-2 sm:space-y-3 relative" style={{ overflow: 'visible', zIndex: 1 }}>
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 relative">
            <div className="flex-shrink-0" style={{ width: `${labelWidth}px` }}>
              <span className={`text-xs sm:text-sm block ${
                item.sourceType === 'Client' 
                  ? 'font-bold text-primary' 
                  : 'font-medium text-gray-700'
              }`}>
                {item.label}
              </span>
            </div>
            
            <div className="flex-1 h-6 sm:h-7 flex rounded-md bg-gray-100 relative min-w-0" style={{ overflow: 'visible' }}>
              {item.channels.map((channel, channelIndex) => {
                const isFirst = channelIndex === 0;
                const isLast = channelIndex === item.channels.length - 1;
                
                return (
                  <div
                    key={channelIndex}
                    className={`flex items-center justify-center text-xs font-medium text-white hover:brightness-110 transition-all cursor-pointer relative group ${
                      isFirst ? 'rounded-l-md' : ''
                    } ${isLast ? 'rounded-r-md' : ''}`}
                    style={{
                      width: `${channel.percentage}%`,
                      backgroundColor: channel.color
                    }}
                    title={`${channel.name}: ${channel.value}%`}
                  >
                    {channel.percentage >= 3 ? `${Math.round(channel.value)}%` : ''}
                    
                    {/* Simple tooltip that appears directly above */}
                    <div 
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-white border border-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
                      style={{
                        fontSize: '11px',
                        color: '#374151'
                      }}
                    >
                      <div className="flex items-center">
                        <div 
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: channel.color }}
                        />
                        {channel.name}: {channel.value}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-3 border-t border-gray-200">
        {Object.entries(CHANNEL_COLORS).map(([channel, color]) => (
          <div key={channel} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600">{channel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}