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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <span className="text-xs text-gray-500">100%</span>
              </div>
              
              <div className="relative">
                <div className="flex h-6 rounded-md overflow-hidden bg-gray-100">
                  {item.channels.map((channel, channelIndex) => (
                    <div
                      key={channelIndex}
                      className="flex items-center justify-center text-xs font-medium text-white transition-all hover:brightness-110"
                      style={{
                        width: `${channel.percentage}%`,
                        backgroundColor: channel.color,
                        minWidth: channel.percentage > 8 ? 'auto' : '0px'
                      }}
                      title={`${channel.name}: ${channel.value}%`}
                    >
                      {channel.percentage > 12 && (
                        <span className="truncate px-1">
                          {channel.percentage > 20 ? channel.name : `${channel.value}%`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
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
      </CardContent>
    </Card>
  );
}