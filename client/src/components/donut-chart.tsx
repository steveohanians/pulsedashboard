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
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '8px', 
            height: '8px', 
            backgroundColor: data.color, 
            marginRight: '8px',
            borderRadius: '50%'
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
  // Check if we have any valid data
  const hasData = data && data.length > 0;
  
  // Show no data state if no valid data
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">🍩</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Distribution data will appear here once collected</div>
        </div>
      </div>
    );
  }
  
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.min(Math.max(maxLabelLength * 8, 120), 200); // 8px per char, min 120px, max 200px

  // Group data into non-competitors and competitors
  const nonCompetitors = data.filter(item => !item.sourceType.startsWith('Competitor'));
  const competitors = data.filter(item => item.sourceType.startsWith('Competitor'));

  // Create a balanced grid layout
  const totalItems = data.length;
  
  return (
    <div className="w-full min-h-0 flex flex-col">
      {/* Grid layout with responsive columns */}
      <div className="grid grid-cols-3 gap-x-0.5 gap-y-0.5 sm:gap-x-1 sm:gap-y-1 md:gap-x-2 md:gap-y-1 place-items-center flex-shrink-0">
        {data.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col items-center space-y-0">
            <h4 className={`text-xs text-center leading-tight ${
              item.sourceType === 'Client' 
                ? 'font-bold text-primary' 
                : 'font-medium text-gray-700'
            } max-w-[90px] sm:max-w-[100px]`}>
              {item.label}
            </h4>
            
            <div className="w-18 h-18 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={item.devices}
                    cx="50%"
                    cy="50%"
                    innerRadius={15}
                    outerRadius={32}
                    paddingAngle={1}
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
                  <Tooltip content={CustomTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      
      {/* Centered legend - always visible */}
      <div className="flex flex-wrap justify-center gap-x-1 gap-y-0 sm:gap-x-2 md:gap-x-3 pt-2 border-t border-gray-200 flex-shrink-0">
        {Object.entries(DEVICE_COLORS).map(([device, color]) => (
          <div key={device} className="flex items-center gap-0.5 sm:gap-1">
            <div 
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600 whitespace-nowrap">{device}</span>
          </div>
        ))}
      </div>
    </div>
  );
}