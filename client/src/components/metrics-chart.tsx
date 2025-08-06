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

  // Optimize bar chart data points with Session Duration conversion
  const chartDataPoints = Object.entries(data).map(([key, value]) => {
    let processedValue = value;
    
    // Debug Session Duration processing
    if (metricName === 'Session Duration') {
      console.log(`🔍 METRICS CHART ${key}: raw value=${value}, converting=${value > 60 ? 'YES' : 'NO'}`);
    }
    
    // Convert Session Duration from seconds to minutes for competitor data
    if (metricName === 'Session Duration' && value > 60) {
      processedValue = value / 60;
      console.log(`🔍 METRICS CHART ${key}: converted to ${processedValue} minutes`);
    }
    
    return {
      name: key,
      value: Math.round(processedValue * 10) / 10,
      fill: COLORS[key as keyof typeof COLORS] || 'hsl(var(--color-default))'
    };
  });
  
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