import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DATA_SOURCE_COLORS } from '@/utils/chartUtils';

interface MetricsChartProps {
  metricName: string;
  data: Record<string, number>;
}

export default function MetricsChart({ metricName, data }: MetricsChartProps) {
  const isTrafficOrDevice = metricName.includes('Traffic') || metricName.includes('Device');
  
  if (isTrafficOrDevice) {
    // NO FALLBACK DATA - show authentic data only
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📊</div>
          <div className="text-sm">Authentic data only</div>
          <div className="text-xs text-slate-400 mt-1">
            {metricName.includes('Traffic') ? 'Traffic channel data' : 'Device distribution data'} sourced from GA4
          </div>
        </div>
      </div>
    );
  }

  // Process bar chart data points (Session Duration already converted in groupedMetrics)
  const chartDataPoints = Object.entries(data).map(([key, value]) => ({
    name: key,
    value: Math.round(value * 10) / 10,
    fill: DATA_SOURCE_COLORS[key as keyof typeof DATA_SOURCE_COLORS] || 'hsl(var(--color-default))'
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartDataPoints} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
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
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
        />
        <Bar dataKey="value" />
      </BarChart>
    </ResponsiveContainer>
  );
}