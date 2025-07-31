import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { DashedBar } from './dashed-bar';
import { useState, useMemo, useEffect } from 'react';

interface BarChartProps {
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

// Process time-series data for bar chart display
function processTimeSeriesForBar(
  timeSeriesData: Record<string, Array<{
    metricName: string;
    value: string;
    sourceType: string;
    competitorId?: string;
  }>>,
  periods: string[],
  competitors: any[],
  clientUrl?: string,
  metricName?: string
): any[] {
  const data: any[] = [];
  
  // Map period codes to display labels
  const periodLabels: Record<string, string> = {
    "2024-01": "Jan 24",
    "2024-10": "Oct 24",
    "2025-04": "Apr 25",
    "2025-05": "May 25",
    "2025-06": "Jun 25"
  };
  
  const clientKey = clientUrl || 'Client';
  
  periods.forEach(period => {
    const periodData = timeSeriesData[period] || [];
    const dataPoint: any = {
      period: periodLabels[period] || period
    };
    
    // Find data for each source type - filter by metric name too
    const clientMetric = periodData.find(m => m.sourceType === 'Client' && m.metricName === metricName);
    const industryMetric = periodData.find(m => m.sourceType === 'Industry_Avg' && m.metricName === metricName);
    const cdMetric = periodData.find(m => m.sourceType === 'CD_Avg' && m.metricName === metricName);
    
    dataPoint[clientKey] = clientMetric ? Math.round(parseFloat(clientMetric.value) * 10) / 10 : 0;
    dataPoint['Industry Avg'] = industryMetric ? Math.round(parseFloat(industryMetric.value) * 10) / 10 : 0;
    dataPoint['Clear Digital Clients Avg'] = cdMetric ? Math.round(parseFloat(cdMetric.value) * 10) / 10 : 0;
    
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

// Generate stable time series data for bar chart
function generateBarData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: any[], clientUrl?: string): any[] {
  const data: any[] = [];
  
  // Determine the date range based on time period
  let dates: string[] = [];
  
  if (timePeriod === "Last Month") {
    // Show June 2025 data points (ending in June) - daily intervals
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
  dates.forEach((period, index) => {
    const clientKey = clientUrl || 'Client';
    const point: any = {
      period,
      [clientKey]: Math.round(clientData * 10) / 10,
      'Industry Avg': Math.round(industryAvg * 10) / 10,
      'Clear Digital Clients Avg': Math.round(cdAvg * 10) / 10,
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

export default function MetricBarChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors, timeSeriesData, periods }: BarChartProps) {
  const clientKey = clientUrl || 'Client';
  
  // Check if we have any valid data
  const hasData = clientData !== undefined && clientData !== null && !isNaN(clientData);
  
  // Show no data state if no valid data
  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mb-2">📊</div>
          <div className="text-sm">No data available</div>
          <div className="text-xs text-slate-400 mt-1">Data will appear here once metrics are collected</div>
        </div>
      </div>
    );
  }
  
  // Use real time-series data if available, otherwise generate fallback data
  const data = useMemo(() => {
    if (timeSeriesData && periods && periods.length > 1) {
      return processTimeSeriesForBar(timeSeriesData, periods, competitors, clientUrl, metricName);
    }
    return generateBarData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl);
  }, [timeSeriesData, periods, timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl, metricName]);

  // Define colors for each bar series
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(318, 97%, 50%)', // Primary pink color
    'Industry Avg': '#9ca3af', // Light grey
    'Clear Digital Clients Avg': '#4b5563', // Dark grey (matching bounce rate chart)
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red
  
  // Add competitor colors to the main colors object
  competitors.forEach((comp, index) => {
    colors[comp.label] = competitorColors[index % competitorColors.length];
  });
  
  // Calculate fixed Y-axis domain based on all data (regardless of visibility)
  const allValues: number[] = [];
  data.forEach(point => {
    allValues.push(point[clientKey], point['Industry Avg'], point['Clear Digital Clients Avg']);
    competitors.forEach(comp => {
      if (point[comp.label] !== undefined) {
        allValues.push(point[comp.label]);
      }
    });
  });
  const maxValue = Math.max(...allValues);
  const padding = maxValue * 0.1; // 10% padding from top
  const yAxisDomain = [0, Math.ceil(maxValue + padding)];

  // State for toggling bars - ensure all competitors are visible by default
  const [visibleBars, setVisibleBars] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      [clientKey]: true,
      'Industry Avg': true,
      'Clear Digital Clients Avg': true,
    };
    competitors.forEach(comp => {
      initial[comp.label] = true;
    });
    return initial;
  });

  // Update visible bars whenever competitors change
  useEffect(() => {
    setVisibleBars(prev => {
      const updated = { ...prev };
      competitors.forEach(comp => {
        if (!(comp.label in updated)) {
          updated[comp.label] = true;
        }
      });
      return updated;
    });
  }, [competitors]);

  // Track if this is the initial render to allow animation only once
  const [isInitialRender, setIsInitialRender] = useState(true);

  const toggleBar = (barKey: string) => {
    setIsInitialRender(false); // Disable animation after first interaction
    setVisibleBars(prev => ({
      ...prev,
      [barKey]: !prev[barKey]
    }));
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="85%">
        <BarChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="period"
            fontSize={9}
            tick={{ fill: '#64748b' }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis 
            fontSize={9}
            tick={{ fill: '#64748b' }}
            axisLine={{ stroke: '#cbd5e1' }}
            domain={yAxisDomain}
            tickFormatter={(value) => {
              if (metricName.includes('Rate')) {
                return `${Math.round(value * 10) / 10}%`;
              } else if (metricName.includes('Session Duration')) {
                // Convert seconds to minutes for display
                const minutes = Math.round((value / 60) * 10) / 10;
                return `${minutes}min`;
              }
              return `${Math.round(value * 10) / 10}`;
            }}
            width={45}
            type="number"
          />
          <Tooltip 
            cursor={{ fill: '#d1d5db', fillOpacity: 0.3 }}
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
                          backgroundColor: colors[entry.dataKey] || entry.color, 
                          marginRight: '6px',
                          borderRadius: '50%'
                        }} 
                      />
                      <span style={{ 
                        color: '#374151',
                        fontSize: '11px'
                      }}>
                        {entry.dataKey === clientKey ? (
                          <strong style={{ color: colors[clientKey] }}>
                            {entry.dataKey}: {
                              metricName.includes('Rate') 
                                ? `${Math.round(entry.value * 10) / 10}%`
                                : metricName.includes('Session Duration')
                                  ? `${Math.round((entry.value / 60) * 10) / 10} min`
                                  : `${Math.round(entry.value * 10) / 10}`
                            }
                          </strong>
                        ) : (
                          `${entry.dataKey}: ${
                            metricName.includes('Rate') 
                              ? `${Math.round(entry.value * 10) / 10}%`
                              : metricName.includes('Session Duration')
                                ? `${Math.round((entry.value / 60) * 10) / 10} min`
                                : `${Math.round(entry.value * 10) / 10}`
                          }`
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />

          {/* Client bars */}
          {visibleBars[clientKey] && (
            <Bar 
              dataKey={clientKey} 
              fill={colors[clientKey]}
              radius={[2, 2, 0, 0]}
              stroke="transparent"
              strokeWidth={1}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Industry Average bars - dashed outline */}
          {visibleBars['Industry Avg'] && (
            <Bar 
              dataKey="Industry Avg" 
              fill="none"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5,5"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke="#9ca3af" strokeDasharray="5,5" hideBottomBorder={true} />}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Clear Digital Clients Average bars - dashed outline */}
          {visibleBars['Clear Digital Clients Avg'] && (
            <Bar 
              dataKey="Clear Digital Clients Avg" 
              fill="none"
              stroke="#4b5563"
              strokeWidth={2}
              strokeDasharray="8,4"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke="#4b5563" strokeDasharray="8,4" hideBottomBorder={true} />}
              isAnimationActive={isInitialRender}
            />
          )}
          
          {/* Competitor bars - solid outline with no fill */}
          {competitors.map((competitor, index) => (
            visibleBars[competitor.label] && (
              <Bar 
                key={competitor.id}
                dataKey={competitor.label} 
                fill="none"
                stroke={competitorColors[index % competitorColors.length]}
                strokeWidth={2}
                radius={[2, 2, 0, 0]}
                shape={(props: any) => <DashedBar {...props} stroke={competitorColors[index % competitorColors.length]} strokeDasharray="none" hideBottomBorder={true} />}
                isAnimationActive={isInitialRender}
              />
            )
          ))}
        </BarChart>
      </ResponsiveContainer>
      
      {/* Interactive Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-3 pb-1">
        {/* Client checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleBars[clientKey] || false}
            onChange={() => toggleBar(clientKey)}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars[clientKey] ? 'bg-pink-500 border-pink-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: visibleBars[clientKey] ? colors[clientKey] : 'transparent' }}
          >
            {visibleBars[clientKey] && (
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
            checked={visibleBars['Industry Avg']}
            onChange={() => toggleBar('Industry Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars['Industry Avg'] ? 'bg-gray-400 border-gray-400' : 'border-gray-300'
            }`}
          >
            {visibleBars['Industry Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">Industry Avg</span>
        </label>

        {/* Clear Digital Clients Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleBars['Clear Digital Clients Avg']}
            onChange={() => toggleBar('Clear Digital Clients Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars['Clear Digital Clients Avg'] ? 'bg-gray-600 border-gray-600' : 'border-gray-300'
            }`}
          >
            {visibleBars['Clear Digital Clients Avg'] && (
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className="text-slate-700">Clear Digital Clients Avg</span>
        </label>

        {/* Competitor checkboxes */}
        {competitors.map((competitor, index) => (
          <label key={competitor.id} className="flex items-center cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={visibleBars[competitor.label]}
              onChange={() => toggleBar(competitor.label)}
              className="sr-only"
            />
            <div 
              className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors`}
              style={{ 
                backgroundColor: visibleBars[competitor.label] ? competitorColors[index % competitorColors.length] : 'transparent',
                borderColor: visibleBars[competitor.label] ? competitorColors[index % competitorColors.length] : '#d1d5db'
              }}
            >
              {visibleBars[competitor.label] && (
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