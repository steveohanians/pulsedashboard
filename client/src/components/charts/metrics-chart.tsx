import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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

  const chartData = React.useMemo(() => {
    // Create a single data point with all metrics as properties
    const dataPoint: any = { name: metricName || 'Metrics' };
    
    Object.entries(data || {}).forEach(([key, value]) => {
      if (key !== 'Client') {
        let finalValue = value || 0;
        
        // Apply percentage conversion for rate metrics
        if (shouldConvertToPercentage(metricName)) {
          if (key === 'Industry_Avg' || key === 'CD_Avg' || key.includes('Avg')) {
            finalValue = finalValue * 100;
          }
        }
        
        // Add each metric as a property of the single data point
        dataPoint[key] = finalValue;
      }
    });
    
    // Return array with single data point containing all metrics
    return [dataPoint];
  }, [data, metricName]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
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
        <Legend />
        
        {/* Create a Bar for each average type */}
        <Bar dataKey="Industry_Avg" fill="#8b5cf6" name="Industry Avg" />
        <Bar dataKey="CD_Avg" fill="#3b82f6" name="CD Avg" />
        <Bar dataKey="Competitor_Avg" fill="#ef4444" name="Competitor Avg" />
        
        {/* Add bars for any competitor names dynamically */}
        {Object.keys(data || {})
          .filter(key => key !== 'Client' && !key.includes('Avg'))
          .map(key => (
            <Bar key={key} dataKey={key} fill="#94a3b8" name={key} />
          ))
        }
      </BarChart>
    </ResponsiveContainer>
  );
}