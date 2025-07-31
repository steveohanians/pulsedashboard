import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MetricsChartProps {
  metricName: string;
  data: Record<string, number>;
}

const COLORS = {
  Client: '#2563eb',
  CD_Avg: '#4b5563', // Dark grey
  Industry_Avg: '#9ca3af', // Light grey  
  Industry: '#9ca3af', // Light grey (fallback)
  Competitor: '#10b981'
};

export default function MetricsChart({ metricName, data }: MetricsChartProps) {
  const isTrafficOrDevice = metricName.includes('Traffic') || metricName.includes('Device');
  
  if (isTrafficOrDevice) {
    // Mock data for pie charts
    const pieData = metricName.includes('Traffic') 
      ? [
          { name: 'Organic Search', value: 35, fill: '#2563eb' },
          { name: 'Direct', value: 28, fill: '#10b981' },
          { name: 'Social Media', value: 15, fill: '#f59e0b' },
          { name: 'Referral', value: 12, fill: '#ef4444' },
          { name: 'Email', value: 6, fill: '#8b5cf6' },
          { name: 'Paid Search', value: 4, fill: '#06b6d4' }
        ]
      : [
          { name: 'Mobile', value: 58, fill: '#10b981' },
          { name: 'Desktop', value: 35, fill: '#2563eb' },
          { name: 'Tablet', value: 7, fill: '#f59e0b' }
        ];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart for other metrics
  const chartData = Object.entries(data).map(([sourceType, value]) => ({
    name: sourceType.replace('_', ' '),
    value: value,
    fill: COLORS[sourceType as keyof typeof COLORS] || '#64748b'
  }));

  // Add some default data if empty
  if (chartData.length === 0) {
    chartData.push(
      { name: 'Your Site', value: 0, fill: COLORS.Client },
      { name: 'CD Average', value: 0, fill: COLORS.CD_Avg },
      { name: 'Industry Avg', value: 0, fill: COLORS.Industry }
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="name" 
          fontSize={10} 
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis 
          fontSize={10}
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          width={35}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            fontSize: '12px'
          }}
          formatter={(value: number) => [
            `${Math.round(value * 10) / 10}${metricName.includes('Rate') ? '%' : ''}`,
            'Value'
          ]}
        />
        <Bar 
          dataKey="value" 
          fill="#FF1493" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}