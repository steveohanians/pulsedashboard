import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DonutData {
  sourceType: string;
  label: string;
  devices: {
    name: string;
    value: number;
    percentage: number;
    color: string;
  }[];
}

interface DonutChartProps {
  data: DonutData[];
  title: string;
  description?: string;
}

const DEVICE_COLORS = {
  'Desktop': '#3b82f6', // blue-500
  'Mobile': '#10b981', // emerald-500
  'Tablet': '#8b5cf6', // violet-500
  'Other': '#6b7280', // gray-500
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-medium">{data.name}: {data.value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export function DonutChart({ data, title, description }: DonutChartProps) {
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.min(Math.max(maxLabelLength * 8, 120), 200); // 8px per char, min 120px, max 200px

  return (
    <div className="w-full h-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col items-center space-y-3">
            <h4 className={`text-sm font-medium ${
              item.sourceType === 'Client' 
                ? 'font-bold text-primary' 
                : 'text-gray-700'
            }`}>
              {item.label}
            </h4>
            
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={item.devices}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {item.devices.map((device, deviceIndex) => (
                      <Cell 
                        key={`cell-${deviceIndex}`} 
                        fill={device.color}
                        className="hover:brightness-110 transition-all cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Device percentages in center */}
            <div className="text-center space-y-1">
              {item.devices.map((device, deviceIndex) => (
                <div key={deviceIndex} className="flex items-center justify-center gap-2 text-xs">
                  <div 
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: device.color }}
                  />
                  <span className="text-gray-600">{device.name}: {device.value}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Centered legend */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-3 border-t border-gray-200">
        {Object.entries(DEVICE_COLORS).map(([device, color]) => (
          <div key={device} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600">{device}</span>
          </div>
        ))}
      </div>
    </div>
  );
}