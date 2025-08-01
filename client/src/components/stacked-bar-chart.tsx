import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

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

  // Transform data for Recharts horizontal stacked bars
  const chartData = data.map(item => {
    const rowData: any = { 
      name: item.label,
      // Add a total for reference
      total: item.channels.reduce((sum, channel) => sum + channel.value, 0)
    };
    
    // Add each channel as a property
    item.channels.forEach(channel => {
      rowData[channel.name] = channel.value;
    });
    
    return rowData;
  });

  // Get all unique channel names in consistent order
  const allChannels = Object.keys(CHANNEL_COLORS).filter(channel => 
    data.some(item => item.channels.some(ch => ch.name === channel))
  );

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs max-w-xs">
          <p className="font-semibold mb-2 text-gray-800">{label}</p>
          {payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-gray-700">{entry.dataKey}</span>
                </div>
                <span className="font-medium text-gray-800">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full space-y-4">
      {/* Recharts horizontal stacked bar chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={75}
              tick={{ fontSize: 12, fill: '#374151' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {allChannels.map(channelName => (
              <Bar
                key={channelName}
                dataKey={channelName}
                stackId="channels"
                fill={CHANNEL_COLORS[channelName]}
                radius={channelName === allChannels[0] ? [4, 0, 0, 4] : 
                        channelName === allChannels[allChannels.length - 1] ? [0, 4, 4, 0] : 
                        [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
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