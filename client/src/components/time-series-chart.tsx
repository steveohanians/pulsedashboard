import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useMemo, useEffect } from 'react';

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
  clientUrl?: string;
  competitors: Array<{
    id: string;
    label: string;
    value: number;
  }>;
  timeSeriesData?: Record<string, Array<{
    metricName: string;
    value: string;
    sourceType: string;
    competitorId?: string;
  }>>;
  periods?: string[];
}

// Generate deterministic seeded random number
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate time series data from database or fallback to current behavior
function generateTimeSeriesData(
  timePeriod: string, 
  clientData: number, 
  industryAvg: number, 
  cdAvg: number, 
  competitors: any[], 
  clientUrl?: string,
  timeSeriesData?: Record<string, any[]>,
  periods?: string[]
): any[] {
  // If we have actual time-series data, use it
  if (timeSeriesData && periods && periods.length > 1) {
    return generateRealTimeSeriesData(timeSeriesData, periods, competitors, clientUrl, timePeriod);
  }
  
  // Otherwise, fallback to single-point data (current behavior for single periods)
  return generateFallbackTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl);
}

// Generate real time-series data from database
function generateRealTimeSeriesData(
  timeSeriesData: Record<string, any[]>,
  periods: string[],
  competitors: any[],
  clientUrl?: string,
  metricName?: string
): any[] {
  const data: any[] = [];
  
  // Map period codes to display labels
  const periodLabels: Record<string, string> = {
    "2024-01": "Jan 24",
    "2024-Q4": "Q4 24",
    "2025-04": "Apr 25",
    "2025-05": "May 25",
    "2025-06": "Jun 25"
  };
  
  const clientKey = clientUrl || 'Client';
  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const dataPoint: any = {
      date: periodLabels[period] || period
    };
    
    // Find data for each source type - filter by metric name too
    const clientMetric = periodData.find(m => m.sourceType === 'Client' && m.metricName === metricName);
    const industryMetric = periodData.find(m => m.sourceType === 'Industry_Avg' && m.metricName === metricName);
    const cdMetric = periodData.find(m => m.sourceType === 'CD_Avg' && m.metricName === metricName);
    
    dataPoint[clientKey] = clientMetric ? Math.round(parseFloat(clientMetric.value) * 10) / 10 : 0;
    dataPoint['Industry Avg'] = industryMetric ? Math.round(parseFloat(industryMetric.value) * 10) / 10 : 0;
    dataPoint['CD Client Avg'] = cdMetric ? Math.round(parseFloat(cdMetric.value) * 10) / 10 : 0;
    
    // Add competitor data
    competitors.forEach(competitor => {
      const competitorMetric = periodData.find(m => 
        m.sourceType === 'Competitor' && m.competitorId === competitor.id && m.metricName === metricName
      );
      dataPoint[competitor.label] = competitorMetric ? Math.round(parseFloat(competitorMetric.value) * 10) / 10 : 0;
    });
    
    data.push(dataPoint);
  });
  
  return data;
}

// Generate fallback time series data (current behavior)
function generateFallbackTimeSeriesData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: any[], clientUrl?: string): any[] {
  const data: any[] = [];
  
  // Determine the date range and intervals based on time period
  let dates: string[] = [];
  
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

  // Use actual averaged values for all data points (no artificial variance for tooltips)
  dates.forEach((date, index) => {
    const clientKey = clientUrl || 'Client';
    const point: any = {
      date,
      [clientKey]: Math.round(clientData * 10) / 10,
      'Industry Avg': Math.round(industryAvg * 10) / 10,
      'CD Client Avg': Math.round(cdAvg * 10) / 10,
    };

    // Add competitor data with actual values
    competitors.forEach((competitor, compIndex) => {
      const baseValue = competitor.value || clientData;
      point[competitor.label] = Math.round(baseValue * 10) / 10;
    });

    data.push(point);
  });

  return data;
}

export default function TimeSeriesChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: TimeSeriesChartProps) {
  
  // Debug log to see what data we're getting
  console.log('TimeSeriesChart received:', { metricName, timePeriod, timeSeriesData, periods });
  
  // Check if we have any valid data
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  
  // Show no data state if no valid data
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📈</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Trend data will appear here once metrics are collected</div>
        </div>
      </div>
    );
  }
  
  // Memoize data generation to prevent re-calculation on every render
  const data = useMemo(() => 
    generateTimeSeriesData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods),
    [timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, timeSeriesData, periods]
  );

  const clientKey = clientUrl || 'Client';
  
  // Define colors for each line
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(318, 97%, 50%)', // Primary pink color (exact match to CSS variable)
    'Industry Avg': '#9ca3af', // Light grey
    'CD Client Avg': '#4b5563', // Dark grey
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red

  // Calculate optimized Y-axis domain based on all data with better scaling
  const allValues: number[] = [];
  data.forEach(point => {
    allValues.push(point[clientKey], point['Industry Avg'], point['CD Client Avg']);
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(point[comp.label]);
      }
    });
  });
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  
  // Always start from 0 for better visual context and comparison
  const padding = maxValue * 0.1; // 10% padding from top
  const yAxisDomain = [0, Math.ceil(maxValue + padding)];

  // State for toggling lines - ensure all competitors are visible by default
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      [clientKey]: true,
      'Industry Avg': true,
      'CD Client Avg': true,
    };
    competitors.forEach(comp => {
      initial[comp.label] = true;
    });
    return initial;
  });

  // Update visible lines whenever competitors change to include new ones
  useEffect(() => {
    setVisibleLines(prev => {
      const updated = { ...prev };
      competitors.forEach(comp => {
        if (!(comp.label in updated)) {
          updated[comp.label] = true; // Default new competitors to visible
        }
      });
      return updated;
    });
  }, [competitors]);

  // Track if this is the initial render to allow animation only once
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleLine = (lineKey: string) => {
    setIsInitialRender(false); // Disable animation after first interaction
    setVisibleLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        <LineChart 
          data={data} 
          margin={{ top: 20, right: 5, left: 5, bottom: 5 }}
        >
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
          domain={yAxisDomain}
          tickFormatter={(value) => {
            if (metricName === "Pages per Session" || metricName === "Sessions per User") {
              return value.toFixed(1);
            }
            return Math.round(value).toString();
          }}
          width={35}
          type="number"
        />
        <Tooltip 
          content={({ active, payload, label }) => {
            if (!active || !payload || !label) return null;
            
            return (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                padding: '8px 12px',
                fontSize: '12px'
              }}>
                <div style={{ color: '#374151', fontWeight: 'medium', fontSize: '11px', marginBottom: '4px' }}>
                  {label}
                </div>
                {payload.map((entry: any, index: number) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                    <div 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        backgroundColor: entry.color, 
                        marginRight: '6px',
                        borderRadius: '50%'
                      }} 
                    />
                    <span style={{ 
                      fontWeight: entry.name === clientKey ? 'bold' : 'normal',
                      color: entry.name === clientKey ? colors[clientKey] : '#374151'
                    }}>
                      {entry.name}: {Math.round(entry.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Pages per Session') ? ' pages' : metricName.includes('Sessions per User') ? ' sessions' : ''}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />

        
        {/* Client line (primary pink) */}
        {visibleLines[clientKey] && (
          <Line 
            type="monotone" 
            dataKey={clientKey} 
            stroke={colors[clientKey]}
            strokeWidth={3}
            dot={{ fill: colors[clientKey], r: 3 }}
            activeDot={{ r: 5, stroke: colors[clientKey], strokeWidth: 2, fill: 'white' }}
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* Industry Average line */}
        {visibleLines['Industry Avg'] && (
          <Line 
            type="monotone" 
            dataKey="Industry Avg" 
            stroke={colors['Industry Avg']}
            strokeWidth={2}
            dot={<DiamondDot fill={colors['Industry Avg']} stroke={colors['Industry Avg']} strokeWidth={1} />}
            strokeDasharray="5 5"
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* CD Client Average line */}
        {visibleLines['CD Client Avg'] && (
          <Line 
            type="monotone" 
            dataKey="CD Client Avg" 
            stroke={colors['CD Client Avg']}
            strokeWidth={2}
            dot={<DiamondDot fill={colors['CD Client Avg']} stroke={colors['CD Client Avg']} strokeWidth={1} />}
            strokeDasharray="8 4"
            animationDuration={isInitialRender ? 800 : 0}
          />
        )}
        
        {/* Competitor lines */}
        {competitors.map((competitor, index) => (
          visibleLines[competitor.label] && (
            <Line 
              key={competitor.id}
              type="monotone" 
              dataKey={competitor.label} 
              stroke={competitorColors[index % competitorColors.length]}
              strokeWidth={2}
              dot={<DiamondDot fill={competitorColors[index % competitorColors.length]} stroke={competitorColors[index % competitorColors.length]} strokeWidth={1} />}
              animationDuration={isInitialRender ? 800 : 0}
            />
          )
        ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Custom Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-3 pb-1">
        {/* Client checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines[clientKey] || false}
            onChange={() => toggleLine(clientKey)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines[clientKey] ? 'bg-pink-500 border-pink-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines[clientKey] ? colors[clientKey] : 'transparent' }}
          >
            {visibleLines[clientKey] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700 font-medium">{clientKey}</span>
        </label>

        {/* Industry Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines['Industry Avg']}
            onChange={() => toggleLine('Industry Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines['Industry Avg'] ? 'border-gray-400' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines['Industry Avg'] ? colors['Industry Avg'] : 'transparent' }}
          >
            {visibleLines['Industry Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">Industry Avg</span>
        </label>

        {/* CD Client Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleLines['CD Client Avg']}
            onChange={() => toggleLine('CD Client Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleLines['CD Client Avg'] ? 'border-gray-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleLines['CD Client Avg'] ? colors['CD Client Avg'] : 'transparent' }}
          >
            {visibleLines['CD Client Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">CD Client Avg</span>
        </label>

        {/* Competitor checkboxes */}
        {competitors.map((competitor, index) => (
          <label key={competitor.id} className="flex items-center cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={visibleLines[competitor.label]}
              onChange={() => toggleLine(competitor.label)}
              className="sr-only"
            />
            <div 
              className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
                visibleLines[competitor.label] ? 'border-gray-400' : 'border-gray-300'
              }`}
              style={{ 
                backgroundColor: visibleLines[competitor.label] 
                  ? competitorColors[index % competitorColors.length] 
                  : 'transparent' 
              }}
            >
              {visibleLines[competitor.label] && (
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-slate-700">{competitor.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}