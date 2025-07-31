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
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0];
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      padding: '8px 12px',
      fontSize: '12px',
      display: 'inline-block',
      whiteSpace: 'nowrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '8px', 
            height: '8px', 
            backgroundColor: data.color, 
            marginRight: '6px',
            borderRadius: '50%',
            flexShrink: 0
          }} 
        />
        <span style={{ color: '#374151', fontWeight: 'normal', fontSize: '11px' }}>
          {data.name}: {data.value}%
        </span>
      </div>
    </div>
  );
};

export function DonutChart({ data, title, description }: DonutChartProps) {
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.min(Math.max(maxLabelLength * 8, 120), 200); // 8px per char, min 120px, max 200px

  return (
    <div className="w-full h-full">
      <div className="flex flex-wrap justify-center gap-8">
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col items-center space-y-3">
            <h4 className={`text-sm ${
              item.sourceType === 'Client' 
                ? 'font-bold text-primary' 
                : 'font-medium text-gray-700'
            }`}>
              {item.label}
            </h4>
            
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={item.devices}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
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
          </div>
        ))}
      </div>
      
      {/* Centered legend */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-6 mt-6 border-t border-gray-200">
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