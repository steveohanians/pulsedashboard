import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TimeSeriesChartProps {
  metricName: string;
  timePeriod: string;
  clientData: number;
  industryAvg: number;
  cdAvg: number;
  competitors: Array<{
    id: string;
    label: string;
    value: number;
  }>;
}

// Generate mock time series data based on the selected time period
function generateTimeSeriesData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: any[]): any[] {
  const data: any[] = [];
  const now = new Date();
  
  // Determine the date range and intervals based on time period
  let dates: string[] = [];
  let format: string = '';
  
  if (timePeriod === "Last Month") {
    // Show last 6 data points for the month (weekly)
    format = 'MMM dd';
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (i * 5)); // Every 5 days
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (timePeriod === "Last Quarter") {
    // Show last 3 months
    format = 'MMM yy';
    for (let i = 2; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }
  } else if (timePeriod === "Last Year") {
    // Show last 6 months
    format = 'MMM yy';
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }
  } else {
    // Custom date range - show 6 points
    format = 'MMM dd';
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (i * 7)); // Weekly
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }

  // Generate realistic variance around the base values with consistent trends
  dates.forEach((date, index) => {
    const variance = 0.1; // 10% variance for more realistic data
    const trendFactor = (index / dates.length) * 0.1; // Small trend over time
    
    const point: any = {
      date,
      Client: Math.round((clientData + (Math.random() - 0.5) * clientData * variance - trendFactor * clientData) * 10) / 10,
      'Industry Avg': Math.round((industryAvg + (Math.random() - 0.5) * industryAvg * variance) * 10) / 10,
      'CD Client Avg': Math.round((cdAvg + (Math.random() - 0.5) * cdAvg * variance) * 10) / 10,
    };

    // Add competitor data with distinct performance patterns
    competitors.forEach((competitor, compIndex) => {
      const baseValue = competitor.value || (clientData + 10 + compIndex * 5);
      const competitorVariance = variance * (1 + compIndex * 0.2); // Different variance per competitor
      point[competitor.label] = Math.round((baseValue + (Math.random() - 0.5) * baseValue * competitorVariance) * 10) / 10;
    });

    data.push(point);
  });

  return data;
}

export default function TimeSeriesChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, competitors }: TimeSeriesChartProps) {
  const data = generateTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors);
  
  // Define colors for each line
  const colors = {
    'Client': '#FF1493', // Primary pink color
    'Industry Avg': '#10b981', // Green
    'CD Client Avg': '#f59e0b', // Orange/yellow
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          fontSize={11} 
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis 
          fontSize={11}
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          domain={['dataMin - 5', 'dataMax + 5']}
          tickFormatter={(value) => Math.round(value).toString()}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value: number, name: string) => [
            `${Math.round(value * 10) / 10}${metricName.includes('Rate') ? '%' : ''}`,
            name
          ]}
          labelStyle={{ color: '#374151', fontWeight: 'medium' }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '15px' }}
          iconType="line"
          textStyle={{ fontSize: '11px', color: '#64748b' }}
        />
        
        {/* Client line (primary pink) */}
        <Line 
          type="monotone" 
          dataKey="Client" 
          stroke={colors.Client}
          strokeWidth={3}
          dot={{ fill: colors.Client, r: 4 }}
          activeDot={{ r: 6, stroke: colors.Client, strokeWidth: 2, fill: 'white' }}
        />
        
        {/* Industry Average line */}
        <Line 
          type="monotone" 
          dataKey="Industry Avg" 
          stroke={colors['Industry Avg']}
          strokeWidth={2}
          dot={{ fill: colors['Industry Avg'], r: 3 }}
          strokeDasharray="5 5"
        />
        
        {/* CD Client Average line */}
        <Line 
          type="monotone" 
          dataKey="CD Client Avg" 
          stroke={colors['CD Client Avg']}
          strokeWidth={2}
          dot={{ fill: colors['CD Client Avg'], r: 3 }}
          strokeDasharray="8 4"
        />
        
        {/* Competitor lines */}
        {competitors.map((competitor, index) => (
          <Line 
            key={competitor.id}
            type="monotone" 
            dataKey={competitor.label} 
            stroke={competitorColors[index % competitorColors.length]}
            strokeWidth={2}
            dot={{ fill: competitorColors[index % competitorColors.length], r: 3 }}
            strokeOpacity={0.8}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}