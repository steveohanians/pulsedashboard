import { memo, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OptimizedChartProps {
  data: any[];
  dataKey: string;
  color: string;
  height?: number;
}

/**
 * Performance-optimized line chart component that uses React.memo and useMemo
 * to prevent unnecessary re-renders. Includes reduced animation duration and
 * memoized configuration for better performance in dashboard environments.
 * 
 * @param data - Array of data points for the chart
 * @param dataKey - Key name for accessing values in data objects
 * @param color - Color string for the line stroke
 * @param height - Optional height in pixels (default: 200)
 */
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
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
            padding: '8px 12px',
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