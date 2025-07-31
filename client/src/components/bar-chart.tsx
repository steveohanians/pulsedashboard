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
}

// Generate deterministic seeded random number
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate stable time series data for bar chart
function generateBarData(timePeriod: string, clientData: number, industryAvg: number, cdAvg: number, competitors: any[], clientUrl?: string): any[] {
  const data: any[] = [];
  
  // Determine the date range based on time period
  let dates: string[] = [];
  
  if (timePeriod === "Last Month") {
    dates = ["2024-01", "2024-Q4", "2025-01", "2025-06"];
  } else if (timePeriod === "Last Quarter") {
    dates = ["2024-01", "2024-Q4", "2025-01"];
  } else if (timePeriod === "Last Year") {
    dates = ["2024-01", "2024-Q4", "2025-01", "2025-06"];
  } else {
    dates = ["2024-01", "2024-Q4", "2025-01", "2025-06"];
  }

  // Generate stable variance around the base values
  dates.forEach((period, index) => {
    const variance = 0.15;
    const trendFactor = (index / dates.length) * 0.1;
    
    // Use seeded random based on period and metric for consistent values
    const seed1 = period.charCodeAt(0) + clientData * 100;
    const seed2 = period.charCodeAt(1) + industryAvg * 100;
    const seed3 = period.charCodeAt(2) + cdAvg * 100;
    
    const clientKey = clientUrl || 'Client';
    const point: any = {
      period,
      [clientKey]: Math.round((clientData + (seededRandom(seed1) - 0.5) * clientData * variance + trendFactor * clientData) * 10) / 10,
      'Industry Avg': Math.round((industryAvg + (seededRandom(seed2) - 0.5) * industryAvg * variance) * 10) / 10,
      'CD Client Avg': Math.round((cdAvg + (seededRandom(seed3) - 0.5) * cdAvg * variance) * 10) / 10,
    };

    // Add competitor data
    competitors.forEach((competitor, compIndex) => {
      const baseValue = competitor.value || (clientData + 0.2 + compIndex * 0.1);
      const competitorVariance = variance * (1 + compIndex * 0.05);
      const competitorSeed = period.charCodeAt(0) + baseValue * 100 + compIndex * 1000;
      point[competitor.label] = Math.round((baseValue + (seededRandom(competitorSeed) - 0.5) * baseValue * competitorVariance) * 10) / 10;
    });

    data.push(point);
  });

  return data;
}

export default function MetricBarChart({ metricName, timePeriod, clientData, industryAvg, cdAvg, clientUrl, competitors }: BarChartProps) {
  const clientKey = clientUrl || 'Client';
  
  // Memoize data generation to prevent re-calculation on every render
  const data = useMemo(() => 
    generateBarData(timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl),
    [timePeriod, clientData, industryAvg, cdAvg, competitors, clientUrl]
  );

  // Define colors for each bar series
  const colors: Record<string, string> = {
    [clientKey]: 'hsl(318, 97%, 50%)', // Primary pink color
    'Industry Avg': '#9ca3af', // Light grey
    'CD Client Avg': '#4b5563', // Dark grey
  };

  // Additional colors for competitors
  const competitorColors = ['#8b5cf6', '#06b6d4', '#ef4444']; // Purple, cyan, red
  
  // State for toggling bars
  const [visibleBars, setVisibleBars] = useState<Record<string, boolean>>(() => {
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

  const toggleBar = (barKey: string) => {
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
          margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
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
            tickFormatter={(value) => `${Math.round(value * 10) / 10}${metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? 'min' : ''}`}
            width={45}
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
                          borderRadius: '2px'
                        }} 
                      />
                      <span style={{ 
                        fontWeight: entry.dataKey === clientKey ? 'bold' : 'normal',
                        color: entry.dataKey === clientKey ? colors[clientKey] : '#374151'
                      }}>
                        {entry.dataKey}: {Math.round(entry.value * 10) / 10}{metricName.includes('Rate') ? '%' : metricName.includes('Duration') ? 'min' : ''}
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
            />
          )}
          
          {/* Industry Average bars - dashed outline */}
          {visibleBars['Industry Avg'] && (
            <Bar 
              dataKey="Industry Avg" 
              fill="none"
              stroke={colors['Industry Avg']}
              strokeWidth={2}
              strokeDasharray="5,5"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke={colors['Industry Avg']} strokeDasharray="5,5" />}
            />
          )}
          
          {/* CD Client Average bars - dashed outline */}
          {visibleBars['CD Client Avg'] && (
            <Bar 
              dataKey="CD Client Avg" 
              fill="none"
              stroke={colors['CD Client Avg']}
              strokeWidth={2}
              strokeDasharray="8,4"
              radius={[2, 2, 0, 0]}
              shape={(props: any) => <DashedBar {...props} stroke={colors['CD Client Avg']} strokeDasharray="8,4" />}
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
                shape={(props: any) => <DashedBar {...props} stroke={competitorColors[index % competitorColors.length]} strokeDasharray="none" />}
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

        {/* CD Client Average checkbox */}
        <label className="flex items-center cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={visibleBars['CD Client Avg']}
            onChange={() => toggleBar('CD Client Avg')}
            className="sr-only"
          />
          <div 
            className={`w-3 h-3 mr-2 border-2 rounded-sm flex items-center justify-center transition-colors ${
              visibleBars['CD Client Avg'] ? 'bg-gray-600 border-gray-600' : 'border-gray-300'
            }`}
          >
            {visibleBars['CD Client Avg'] && (
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