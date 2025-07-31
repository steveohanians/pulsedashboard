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
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.min(Math.max(maxLabelLength * 8, 120), 200); // 8px per char, min 120px, max 200px

  return (
    <div className="w-full h-full space-y-4">
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex items-center gap-4">
            <div className="flex-shrink-0" style={{ width: `${labelWidth}px` }}>
              <span className={`text-sm block ${
                item.sourceType === 'Client' 
                  ? 'font-bold text-primary' 
                  : 'font-medium text-gray-700'
              }`}>
                {item.label}
              </span>
            </div>
            
            <div className="flex-1 h-7 flex rounded-md overflow-hidden bg-gray-100">
              {item.channels.map((channel, channelIndex) => (
                <div
                  key={channelIndex}
                  className="flex items-center justify-center text-xs font-medium text-white hover:brightness-110 transition-all cursor-pointer relative group"
                  style={{
                    width: `${channel.percentage}%`,
                    backgroundColor: channel.color
                  }}
                >
                  {channel.percentage >= 3 ? `${Math.round(channel.value)}%` : ''}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span>{channel.name}: {channel.value}%</span>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              ))}
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