import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Custom diamond dot component
const DiamondDot = (props: any) => {
  const { cx, cy, fill, stroke, strokeWidth } = props;
  const size = 3;
  
  return (
    <polygon
      points={`${cx},${cy-size} ${cx+size},${cy} ${cx},${cy+size} ${cx-size},${cy}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};

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
    // Show June 2025 data points (ending in June)
    const endDate = new Date(2025, 5, 30); // June 30, 2025 (month is 0-indexed)
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 5)); // Every 5 days
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  } else if (timePeriod === "Last Quarter") {
    // Show Q2 2025 (Apr, May, Jun) - ending in June 2025
    dates = ["Apr 25", "May 25", "Jun 25"];
  } else if (timePeriod === "Last Year") {
    // Show 12 months ending June 2025 (July 2024 - June 2025)
    const months = [
      "Jul 24", "Aug 24", "Sep 24", "Oct 24", "Nov 24", "Dec 24",
      "Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25"
    ];
    // Take every other month for display clarity (6 points)
    dates = [months[0], months[2], months[4], months[6], months[8], months[10], months[11]];
  } else {
    // Custom date range - show 6 points ending in June 2025
    const endDate = new Date(2025, 5, 30); // June 30, 2025
    for (let i = 5; i >= 0; i--) {
      const date = new Date(endDate);
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
    'Client': 'hsl(318, 97%, 50%)', // Primary pink color (exact match to CSS variable)
    'Industry Avg': '#9ca3af', // Light grey
    'CD Client Avg': '#4b5563', // Dark grey
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 15, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          fontSize={9} 
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          interval="preserveStartEnd"
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          fontSize={9}
          tick={{ fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          domain={['dataMin - 5', 'dataMax + 5']}
          tickFormatter={(value) => Math.round(value).toString()}
          width={40}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
            fontSize: '12px'
          }}
          formatter={(value: number, name: string) => [
            `${Math.round(value * 10) / 10}${metricName.includes('Rate') ? '%' : ''}`,
            name
          ]}
          labelStyle={{ color: '#374151', fontWeight: 'medium', fontSize: '11px' }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '12px', fontSize: '9px', color: '#64748b' }}
          iconType="rect"
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconSize={8}
        />
        
        {/* Client line (primary pink) */}
        <Line 
          type="monotone" 
          dataKey="Client" 
          stroke={colors.Client}
          strokeWidth={3}
          dot={{ fill: colors.Client, r: 3 }}
          activeDot={{ r: 5, stroke: colors.Client, strokeWidth: 2, fill: 'white' }}
        />
        
        {/* Industry Average line */}
        <Line 
          type="monotone" 
          dataKey="Industry Avg" 
          stroke={colors['Industry Avg']}
          strokeWidth={2}
          dot={<DiamondDot fill={colors['Industry Avg']} stroke={colors['Industry Avg']} strokeWidth={1} />}
          strokeDasharray="5 5"
        />
        
        {/* CD Client Average line */}
        <Line 
          type="monotone" 
          dataKey="CD Client Avg" 
          stroke={colors['CD Client Avg']}
          strokeWidth={2}
          dot={<DiamondDot fill={colors['CD Client Avg']} stroke={colors['CD Client Avg']} strokeWidth={1} />}
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
            dot={<DiamondDot fill={competitorColors[index % competitorColors.length]} stroke={competitorColors[index % competitorColors.length]} strokeWidth={1} />}
            strokeOpacity={0.8}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}