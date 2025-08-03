import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartOptimizer, MemoryOptimizer } from '../utils/frontend-optimizer';

interface MetricsChartProps {
  metricName: string;
  data: Record<string, number>;
}

const COLORS = {
  Client: 'hsl(var(--color-client))',
  CD_Avg: 'hsl(var(--color-cd-avg))',
  Industry_Avg: 'hsl(var(--color-industry-avg))',
  Industry: 'hsl(var(--color-industry-avg))', // fallback
  Competitor: 'hsl(var(--color-competitor-1))'
};

export default function MetricsChart({ metricName, data }: MetricsChartProps) {
  const isTrafficOrDevice = metricName.includes('Traffic') || metricName.includes('Device');
  
  // Apply chart optimization with memoization
  const optimizedRender = MemoryOptimizer.memoize(() => {
    if (isTrafficOrDevice) {
      // Mock data for pie charts - optimized for performance
      const pieData = metricName.includes('Traffic') 
        ? [
            { name: 'Organic Search', value: 35, fill: 'hsl(var(--color-client))' },
            { name: 'Direct', value: 28, fill: 'hsl(var(--color-competitor-1))' },
            { name: 'Social Media', value: 15, fill: 'hsl(var(--chart-3))' },
            { name: 'Referral', value: 12, fill: 'hsl(var(--chart-4))' },
            { name: 'Email', value: 6, fill: 'hsl(var(--chart-5))' },
            { name: 'Paid Search', value: 4, fill: 'hsl(var(--color-competitor-2))' }
          ]
        : [
            { name: 'Mobile', value: 58, fill: 'hsl(var(--color-device-mobile))' },
            { name: 'Desktop', value: 35, fill: 'hsl(var(--color-device-desktop))' },
            { name: 'Tablet', value: 7, fill: 'hsl(var(--color-device-tablet))' }
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
              animationDuration={0}
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

    // Optimize bar chart data points
    const chartDataPoints = Object.entries(data).map(([key, value]) => ({
      name: key,
      value: Math.round(value * 10) / 10,
      fill: COLORS[key as keyof typeof COLORS] || 'hsl(var(--color-default))'
    }));
    
    const optimizedData = ChartOptimizer.optimizeDataPoints(chartDataPoints);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={optimizedData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="name" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickMargin={10}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickMargin={10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
            labelStyle={{ fontWeight: 'bold' }}
            animationDuration={0}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={0} />
        </BarChart>
      </ResponsiveContainer>
    );
  }, [metricName, data]);
  
  return optimizedRender();
}