import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getMetricsColors, normalizeChartData, safeNumericValue, safeTooltipProps, shouldConvertToPercentage } from '@/utils/chartUtils';

interface MetricsChartProps {
  metricName: string;
  data: Record<string, number>;
}

/**
 * Metrics chart component that renders bar charts for performance metrics.
 * Handles special cases for traffic and device distribution data by showing
 * authentic data placeholders instead of fallback synthetic data.
 * 
 * @param metricName - Name of the metric being displayed
 * @param data - Record of data source names to numeric values
 */
export function MetricsChart({ metricName, data }: MetricsChartProps) {
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

  // Process bar chart data points with null-safe handling and percentage conversion
  const rawDataPoints = Object.entries(data).map(([key, value]) => {
    let processedValue = safeNumericValue(value, 0) ?? 0;
    
    // Apply percentage conversion for Rate metrics (e.g., Bounce Rate)
    // Convert Industry_Avg and CD_Avg from decimal to percentage
    if (shouldConvertToPercentage(metricName)) {
      if (key === 'Industry Avg' || key === 'CD_Avg' || key.includes('Avg')) {
        processedValue = processedValue * 100;
      }
    }
    
    return {
      name: key,
      value: processedValue,
      fill: getMetricsColors()[key] || getMetricsColors()['Default']
    };
  });

  // Normalize chart data
  const chartDataPoints = normalizeChartData(rawDataPoints, {
    gapOnNull: false,
    defaultValue: 0,
    requiredKeys: ['name', 'value', 'fill']
  });

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
          {...safeTooltipProps(chartDataPoints)}
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