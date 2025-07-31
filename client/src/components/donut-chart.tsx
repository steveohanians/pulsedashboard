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
  // Calculate the maximum label width needed
  const maxLabelLength = Math.max(...data.map(item => item.label.length));
  const labelWidth = Math.min(Math.max(maxLabelLength * 8, 120), 200); // 8px per char, min 120px, max 200px

  // Group data into non-competitors and competitors
  const nonCompetitors = data.filter(item => !item.sourceType.startsWith('Competitor'));
  const competitors = data.filter(item => item.sourceType.startsWith('Competitor'));

  return (
    <div className="w-full h-full">
      {/* First row: Client, CD Client Avg, Industry Avg */}
      <div className="flex justify-evenly items-center mb-2">
        {nonCompetitors.map((item, index) => (
          <div key={`${item.sourceType}-${index}`} className="flex flex-col items-center space-y-1">
            <h4 className={`text-xs ${
              item.sourceType === 'Client' 
                ? 'font-bold text-primary' 
                : 'font-medium text-gray-700'
            }`}>
              {item.label}
            </h4>
            
            <div className="w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={item.devices}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
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

      {/* Second row: Competitors */}
      {competitors.length > 0 && (
        <div className="flex justify-center items-center gap-32">
          {competitors.map((item, index) => (
            <div key={`${item.sourceType}-${index}`} className="flex flex-col items-center space-y-1">
              <h4 className="text-xs font-medium text-gray-700">
                {item.label}
              </h4>
              
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={item.devices}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
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
      )}
      
      {/* Centered legend */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 pt-3 mt-3 border-t border-gray-200">
        {Object.entries(DEVICE_COLORS).map(([device, color]) => (
          <div key={device} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600">{device}</span>
          </div>
        ))}
      </div>
    </div>
  );
}