import { memo, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OptimizedChartProps {
  data: any[];
  dataKey: string;
  color: string;
  height?: number;
}

// Memoized chart component to prevent unnecessary re-renders
const OptimizedChart = memo(({ data, dataKey, color, height = 200 }: OptimizedChartProps) => {
  // Memoize chart configuration
  const chartConfig = useMemo(() => ({
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
    dot: false,
    strokeWidth: 2,
    animationDuration: 300, // Reduced animation time
  }), []);

  // Skip rendering if no data
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} {...chartConfig}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="period" 
          axisLine={false}
          tickLine={false}
          fontSize={12}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          fontSize={12}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color} 
          strokeWidth={chartConfig.strokeWidth}
          dot={chartConfig.dot}
          animationDuration={chartConfig.animationDuration}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export { OptimizedChart };